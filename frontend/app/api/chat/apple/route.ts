import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fwqoutllbbwyhrucsvly.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const maxDuration = 60;

interface MatchBreakdown {
  preference: number;
  embedding: number;
  appleToOrange: { score: number; satisfied: string[]; violated: string[] };
  orangeToApple: { score: number; satisfied: string[]; violated: string[] };
}

interface RankedCandidate {
  rank: number;
  orangeId: string;
  orangeName: string;
  score: number;
  breakdown: { preference: number; embedding: number };
}

interface EdgeFunctionResponse {
  message: string;
  apple: {
    id: string;
    name: string;
    description: string;
    attributes: Record<string, unknown>;
    preferences: Record<string, unknown>;
  };
  match: {
    orangeId: string;
    orangeName: string;
    orangeDescription?: string;
    score: number;
    breakdown: MatchBreakdown;
  } | null;
  rankedCandidates: RankedCandidate[];
}

export async function POST() {
  try {
    // 1. Call edge function to create apple + find match (returns raw data only)
    const edgeResponse = await fetch(`${SUPABASE_URL}/functions/v1/get-incoming-apple`, {
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
    const systemPrompt = buildAppleSystemPrompt(data);

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
    console.error('Error in chat/apple route:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function buildAppleSystemPrompt(data: EdgeFunctionResponse): string {
  const { apple, match, rankedCandidates } = data;

  if (!match) {
    return `You are a witty matchmaker for fruits. A new apple named "${apple.name}" just joined the matchmaking pool but no oranges are available yet.

Announce that ${apple.name} has joined and is waiting for their perfect orange match. Be playful and encouraging. Keep it to 2-3 sentences.`;
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
      return `• ${readable} ${emoji}`;
    }).join('\n\n');
  };

  const applePrefsMatched = formatPreferences(breakdown.appleToOrange.satisfied);
  const orangePrefsMatched = formatPreferences(breakdown.orangeToApple.satisfied);

  return `You are a witty matchmaker for fruits. Output ONLY the formatted announcement below, with no additional commentary. Use exact markdown formatting.

🍊✨ **Great news, ${apple.name}!**

A new orange named **${match.orangeName}** just found YOU as their perfect match!

**Compatibility: ${(match.score * 100).toFixed(1)}%**

• Preference match: ${(breakdown.preference * 100).toFixed(1)}%

• Vibe match: ${(breakdown.embedding * 100).toFixed(1)}%

${applePrefsMatched ? `**Your preferences met:**

${applePrefsMatched}` : '**This orange checks all your boxes!** ✨'}

${orangePrefsMatched ? `**${match.orangeName}'s preferences you satisfy:**

${orangePrefsMatched}` : ''}

Add one short playful closing line with fruit puns/emojis.`;
}

async function broadcastMatch(data: EdgeFunctionResponse, appleAnnouncement: string) {
  if (!data.match) return;

  const { apple, match } = data;
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
      return `• ${readable} ${emoji}`;
    }).join('\n\n');
  };

  const orangePrefsMatched = formatPreferences(breakdown.orangeToApple.satisfied);
  const applePrefsMatched = formatPreferences(breakdown.appleToOrange.satisfied);

  // Generate the orange's announcement (they're receiving the match notification)
  const orangeAnnouncement = `🍎✨ **Great news, ${match.orangeName}!** 

A new apple named **${apple.name}** just found YOU as their perfect match!

**Compatibility: ${(match.score * 100).toFixed(1)}%**

• Preference match: ${(breakdown.preference * 100).toFixed(1)}%

• Vibe match: ${(breakdown.embedding * 100).toFixed(1)}%

${orangePrefsMatched ? `**Your preferences met:**

${orangePrefsMatched}` : '**This apple checks all your boxes!** ✨'}

${applePrefsMatched ? `**${apple.name}'s preferences you satisfy:**

${applePrefsMatched}` : ''}

Looks like your citrus charm caught someone's eye! 🍊💕`;

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
        appleId: apple.id,
        appleName: apple.name,
        orangeId: match.orangeId,
        orangeName: match.orangeName,
        score: match.score,
        triggeredBy: "apple",
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
