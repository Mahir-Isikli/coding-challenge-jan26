import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fwqoutllbbwyhrucsvly.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    // 1. Call edge function to create orange + find match
    const edgeResponse = await fetch(`${SUPABASE_URL}/functions/v1/get-incoming-orange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (!edgeResponse.ok) {
      const errorText = await edgeResponse.text();
      return new Response(JSON.stringify({ error: `Edge function failed: ${errorText}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await edgeResponse.json();

    // 2. Build system context with the fruit data
    const systemPrompt = `You are announcing fruits joining a matchmaking system. Be concise and playful.

A new orange just joined! Here's their profile:
${data.orange?.description || 'No description available'}

${data.match ? `
MATCH FOUND!
- Matched with: ${data.match.appleId}
- Compatibility: ${(data.match.score * 100).toFixed(0)}%
- Original announcement: ${data.match.announcement}

Create a brief, engaging summary that:
1. Welcomes the orange (1 sentence)
2. Announces the match with the apple (1-2 sentences)
3. Mentions the compatibility score

Keep it under 100 words total.
` : `
No match found yet. Acknowledge the orange joined and is waiting for their perfect apple match. Keep it brief and encouraging.
`}`;

    // 3. Broadcast match to both panels via Realtime (server-side)
    if (data.match && SUPABASE_ANON_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const channel = supabase.channel('matches', {
          config: { broadcast: { self: true } },
        });
        
        // Subscribe first, then send
        await new Promise<void>((resolve, reject) => {
          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              resolve();
            } else if (status === 'CHANNEL_ERROR') {
              reject(new Error('Channel subscription failed'));
            }
          });
        });

        await channel.send({
          type: 'broadcast',
          event: 'new_match',
          payload: {
            appleId: data.match.appleId,
            orangeId: data.orange?.id,
            score: data.match.score,
            announcements: {
              forApple: data.match.appleAnnouncement,
              forOrange: data.match.announcement,
            },
          },
        });
        
        await supabase.removeChannel(channel);
      } catch (broadcastError) {
        console.error('Broadcast failed:', broadcastError);
      }
    }

    // 4. Stream the response
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Error in chat/orange route:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
