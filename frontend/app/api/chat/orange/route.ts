import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fwqoutllbbwyhrucsvly.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const maxDuration = 60;

interface MatchBreakdown {
  preference: number;
  embedding: number;
  orangeToApple: { score: number; satisfied: string[]; violated: string[] };
  appleToOrange: { score: number; satisfied: string[]; violated: string[] };
}

interface RankedCandidate {
  rank: number;
  appleId: string;
  appleName: string;
  score: number;
  breakdown: { preference: number; embedding: number };
}

interface EdgeFunctionResponse {
  message: string;
  orange: {
    id: string;
    name: string;
    description: string;
    attributes: Record<string, unknown>;
    preferences: Record<string, unknown>;
  };
  match: {
    appleId: string;
    appleName: string;
    appleDescription?: string;
    score: number;
    breakdown: MatchBreakdown;
  } | null;
  rankedCandidates: RankedCandidate[];
}

export async function POST() {
  try {
    // 1. Call edge function to create orange + find match (returns raw data only)
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

    const data: EdgeFunctionResponse = await edgeResponse.json();

    // 2. Build system prompt for Claude
    const systemPrompt = buildOrangeSystemPrompt(data);

    // 3. Stream the LLM response
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Announce the match result.' }],
      async onFinish({ text }) {
        // 4. After streaming completes, broadcast to Realtime for both panels
        if (data.match && SUPABASE_ANON_KEY) {
          await broadcastMatch(data, text);
        }
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Error in chat/orange route:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function buildOrangeSystemPrompt(data: EdgeFunctionResponse): string {
  const { orange, match, rankedCandidates } = data;

  if (!match) {
    return `You are a witty matchmaker for fruits. A new orange named "${orange.name}" just joined the matchmaking pool but no apples are available yet.

Announce that ${orange.name} has joined and is waiting for their perfect apple match. Be playful and encouraging. Keep it to 2-3 sentences.`;
  }

  const { breakdown } = match;
  
  // Format preferences with emojis
  const preferenceEmojis: Record<string, string> = {
    hasWorm: '🐛',
    shineFactor: '✨',
    sweetness: '🍯',
    tartness: '🍋',
    juiciness: '💧',
    ripeness: '🌟',
    size: '📏',
    color: '🎨',
    texture: '🤚',
    organic: '🌱'
  };

  const formatPreferences = (prefs: string[]) => {
    if (prefs.length === 0) return '';
    return prefs.map(p => {
      const emoji = preferenceEmojis[p] || '✓';
      // Convert camelCase to readable format
      const readable = p.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      return `${readable} ${emoji}`;
    }).join(' • ');
  };

  const orangePrefsMatched = formatPreferences(breakdown.orangeToApple.satisfied);
  const applePrefsMatched = formatPreferences(breakdown.appleToOrange.satisfied);

  return `You are a witty matchmaker for fruits. Output ONLY the formatted announcement below, with no additional commentary. Use exact markdown formatting.

🍎✨ **Great news, ${orange.name}!**

A new apple named **${match.appleName}** just found YOU as their perfect match!

**Compatibility: ${(match.score * 100).toFixed(1)}%**

• Preference match: ${(breakdown.preference * 100).toFixed(1)}% • Vibe match: ${(breakdown.embedding * 100).toFixed(1)}%

${orangePrefsMatched ? `**Your preferences met:** • ${orangePrefsMatched}` : '**This apple checks all your boxes!** ✨'}

${applePrefsMatched ? `**${match.appleName}'s preferences you satisfy:** • ${applePrefsMatched}` : ''}

Add one short playful closing line with fruit puns/emojis.`;
}

async function broadcastMatch(data: EdgeFunctionResponse, orangeAnnouncement: string) {
  if (!data.match) return;

  const { orange, match } = data;
  const { breakdown } = match;

  // Format preferences with emojis
  const preferenceEmojis: Record<string, string> = {
    hasWorm: '🐛',
    shineFactor: '✨',
    sweetness: '🍯',
    tartness: '🍋',
    juiciness: '💧',
    ripeness: '🌟',
    size: '📏',
    color: '🎨',
    texture: '🤚',
    organic: '🌱'
  };

  const formatPreferences = (prefs: string[]) => {
    if (prefs.length === 0) return '';
    return prefs.map(p => {
      const emoji = preferenceEmojis[p] || '✓';
      const readable = p.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      return `${readable} ${emoji}`;
    }).join(' • ');
  };

  const applePrefsMatched = formatPreferences(breakdown.appleToOrange.satisfied);
  const orangePrefsMatched = formatPreferences(breakdown.orangeToApple.satisfied);

  // Generate the apple's announcement (they're receiving the match notification)
  const appleAnnouncement = `🍊✨ **Great news, ${match.appleName}!** 

A new orange named **${orange.name}** just found YOU as their perfect match!

**Compatibility: ${(match.score * 100).toFixed(1)}%**

• Preference match: ${(breakdown.preference * 100).toFixed(1)}% • Vibe match: ${(breakdown.embedding * 100).toFixed(1)}%

${applePrefsMatched ? `**Your preferences met:** • ${applePrefsMatched}` : '**This orange checks all your boxes!** ✨'}

${orangePrefsMatched ? `**${orange.name}'s preferences you satisfy:** • ${orangePrefsMatched}\n` : ''}
Looks like your apple appeal caught someone's eye! 🍎💕`;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const channel = supabase.channel('matches', {
      config: { broadcast: { self: true } },
    });

    await new Promise<void>((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
        else if (status === 'CHANNEL_ERROR') reject(new Error('Channel subscription failed'));
      });
    });

    await channel.send({
      type: 'broadcast',
      event: 'new_match',
      payload: {
        appleId: match.appleId,
        appleName: match.appleName,
        orangeId: orange.id,
        orangeName: orange.name,
        score: match.score,
        triggeredBy: "orange",
        announcements: {
          forApple: appleAnnouncement,
          forOrange: orangeAnnouncement,
        },
      },
    });

    await supabase.removeChannel(channel);
  } catch (broadcastError) {
    console.error('Broadcast failed:', broadcastError);
  }
}
