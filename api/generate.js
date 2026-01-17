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
        "HTTP-Referer": "https://hasnain-ai.vercel.app",
        "X-Title": "Reply Assistant"
      },
      body: JSON.stringify({
        "model": "nvidia/nemotron-nano-9b-v2:free",
        "messages": [
          { 
            "role": "system", 
            "content": "Output ONLY the raw reply text. No quotes. No markdown." 
          },
          { "role": "user", "content": `Write a ${tone} ${format} in ${level} English. Length: ${length}. Message: "${input}"` }
        ]
      })
    });

    const data = await response.json();
    
    // --- ROBUST LIMIT COUNTING ---
    // We check multiple header names because they sometimes change
    const dayRemaining = response.headers.get("x-ratelimit-remaining") 
                      || response.headers.get("x-ratelimit-requests-remaining") 
                      || "Unknown";
    
    const limitInfo = {
        remaining_day: dayRemaining,
        limit_day: response.headers.get("x-ratelimit-limit") || "200"
    };

    if (!response.ok) {
        return new Response(JSON.stringify({ 
            error: data.error?.message || "Error",
            isLimit: response.status === 429,
            limits: limitInfo
        }), { status: response.status, headers });
    }

    let reply = data.choices[0].message.content;
    reply = reply.replace(/^"|"$/g, '').replace(/\*\*/g, '').trim();

    return new Response(JSON.stringify({ 
        reply: reply,
        usage: data.usage || { total_tokens: 0 },
        limits: limitInfo 
    }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
}
