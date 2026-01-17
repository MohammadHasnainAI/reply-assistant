export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
      return new Response(JSON.stringify({ error: "Configuration Error: API Key missing." }), { status: 500, headers });
  }

  try {
    const { input, level, tone, length, format } = await req.json();

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://hasnain-ai.vercel.app", // Optional
        "X-Title": "Professional Reply Assistant"
      },
      body: JSON.stringify({
        "model": "nvidia/nemotron-nano-9b-v2:free",
        "messages": [
          { 
            "role": "system", 
            "content": "You are a communication expert. Output ONLY the raw reply text. No markdown, no quotes, no placeholders like [Name]." 
          },
          { "role": "user", "content": `Write a ${tone} ${format} in ${level} English. Length: ${length}. Message: "${input}"` }
        ]
      })
    });

    const data = await response.json();
    
    // --- 📊 CAPTURE GLOBAL LIMITS FROM HEADERS ---
    // These headers tell us the ACTUAL usage for your Key across ALL users
    const limitInfo = {
        remaining_day: response.headers.get("x-ratelimit-remaining") || "Unknown",
        limit_day: response.headers.get("x-ratelimit-limit") || "200",
        reset_time: response.headers.get("x-ratelimit-reset") || "0"
    };

    if (!response.ok) {
        let friendlyMessage = "Unable to generate reply.";
        
        // 429 = Rate Limit Hit
        if (response.status === 429) {
            friendlyMessage = "⚠️ High Traffic: The Daily or Minute limit has been reached. Please wait a moment.";
        } else if (data.error && data.error.message) {
             friendlyMessage = `System Notice: ${data.error.message}`;
        }

        return new Response(JSON.stringify({ 
            error: friendlyMessage,
            isLimit: response.status === 429,
            limits: limitInfo // Send limits even on error
        }), { status: response.status, headers });
    }

    let reply = data.choices[0].message.content;
    // CLEANING: Remove accidental quotes or bold stars
    reply = reply.replace(/^"|"$/g, '').replace(/\*\*/g, '').trim();

    return new Response(JSON.stringify({ 
        reply: reply,
        usage: data.usage || { total_tokens: 0 },
        limits: limitInfo 
    }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Connection Error: " + error.message }), { status: 500, headers });
  }
}
