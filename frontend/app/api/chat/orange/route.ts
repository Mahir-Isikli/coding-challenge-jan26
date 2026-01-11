import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fwqoutllbbwyhrucsvly.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const maxDuration = 60;

interface PreferenceSatisfaction {
  score: number;
  satisfied: string[];
  violated: string[];
}

interface MatchBreakdown {
  orangeToApple: PreferenceSatisfaction;
  appleToOrange: PreferenceSatisfaction;
}

interface RankedCandidate {
  rank: number;
  appleId: string;
  appleName: string;
  score: number;
  breakdown: MatchBreakdown;
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
  otherOrangesForApple: { orangeId: string; orangeName: string; score: number }[];
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
      model: anthropic('claude-sonnet-4-5-20250929'),
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
      return `• ${readable} ${emoji}`;
    }).join('\n\n');
  };

  const orangePrefsMatched = formatPreferences(breakdown.orangeToApple.satisfied);
  const applePrefsMatched = formatPreferences(breakdown.appleToOrange.satisfied);
  
  // Format violated preferences (what's NOT being met)
  const formatViolated = (violations: string[]) => {
    if (violations.length === 0) return '';
    return violations.map(v => {
      // Extract just the preference name (before the parenthesis with details)
      const prefName = v.split(' (')[0];
      const readable = prefName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      return `• ${readable} ❌`;
    }).join('\n\n');
  };
  
  const orangePrefsViolated = formatViolated(breakdown.orangeToApple.violated);
  const applePrefsViolated = formatViolated(breakdown.appleToOrange.violated);

  // Format other candidates (skip the first one which is the best match)
  const otherCandidates = rankedCandidates.slice(1, 4);
  const hasMultipleMatches = otherCandidates.length > 0;
  const otherCandidatesText = hasMultipleMatches
    ? `**Other compatible apples:**\n\n${otherCandidates.map(c => 
        `• ${c.appleName} (${(c.score * 100).toFixed(0)}%)`
      ).join('\n\n')}`
    : '';

  // Adjust messaging based on whether there are multiple matches
  const matchIntro = hasMultipleMatches
    ? `We found you great matches! The most compatible is **${match.appleName}**:`
    : `We found you a great match: **${match.appleName}**!`;

  return `You are a witty matchmaker for fruits. Output ONLY the formatted announcement below, with no additional commentary. Use exact markdown formatting.

🍎✨ **Great news, ${orange.name}!**

${matchIntro}

**Compatibility: ${(match.score * 100).toFixed(1)}%**

${orangePrefsMatched ? `**Your preferences met:**

${orangePrefsMatched}` : '**This apple checks all your boxes!** ✨'}

${orangePrefsViolated ? `**Your preferences not met:**

${orangePrefsViolated}` : ''}

${applePrefsMatched ? `**${match.appleName}'s preferences you satisfy:**

${applePrefsMatched}` : ''}

${applePrefsViolated ? `**${match.appleName}'s preferences you don't meet:**

${applePrefsViolated}` : ''}

${otherCandidatesText}

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
      return `• ${readable} ${emoji}`;
    }).join('\n\n');
  };

  const applePrefsMatched = formatPreferences(breakdown.appleToOrange.satisfied);
  const orangePrefsMatched = formatPreferences(breakdown.orangeToApple.satisfied);
  
  // Format violated preferences
  const formatViolated = (violations: string[]) => {
    if (violations.length === 0) return '';
    return violations.map(v => {
      const prefName = v.split(' (')[0];
      const readable = prefName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      return `• ${readable} ❌`;
    }).join('\n\n');
  };
  
  const applePrefsViolated = formatViolated(breakdown.appleToOrange.violated);
  const orangePrefsViolated = formatViolated(breakdown.orangeToApple.violated);

  // Format other oranges that could also match this apple (from the apple's perspective)
  const otherOranges = data.otherOrangesForApple || [];
  const hasMultipleOranges = otherOranges.length > 0;
  const otherOrangesText = hasMultipleOranges
    ? `**Other compatible oranges:**\n\n${otherOranges.map(o => 
        `• ${o.orangeName} (${(o.score * 100).toFixed(0)}%)`
      ).join('\n\n')}`
    : '';

  // Adjust messaging based on whether there are multiple matches
  const matchIntro = hasMultipleOranges
    ? `We found you great matches! The most compatible is **${orange.name}**:`
    : `We found you a great match: **${orange.name}**!`;

  // Generate the apple's announcement (they're receiving the match notification)
  const appleAnnouncement = `🍊✨ **Great news, ${match.appleName}!** 

${matchIntro}

**Compatibility: ${(match.score * 100).toFixed(1)}%**

${applePrefsMatched ? `**Your preferences met:**

${applePrefsMatched}` : '**This orange checks all your boxes!** ✨'}

${applePrefsViolated ? `**Your preferences not met:**

${applePrefsViolated}` : ''}

${orangePrefsMatched ? `**${orange.name}'s preferences you satisfy:**

${orangePrefsMatched}` : ''}

${orangePrefsViolated ? `**${orange.name}'s preferences you don't meet:**

${orangePrefsViolated}` : ''}

${otherOrangesText}

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
