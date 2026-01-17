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
            "content": "You are a communication expert. Output ONLY the raw reply text. Do NOT use markdown bolding (like **Text**). Do NOT wrap the reply in quotes." 
          },
          { "role": "user", "content": `Write a ${tone} ${format} in ${level} English. Length: ${length}. Message: "${input}"` }
        ]
      })
    });

    const data = await response.json();
    
    // --- 📊 REAL GLOBAL REMAINING COUNT ---
    // x-ratelimit-remaining = The exact number of requests LEFT for the day
    const limitInfo = {
        remaining: response.headers.get("x-ratelimit-remaining") || "200", // Default to 200 if unknown
        limit: response.headers.get("x-ratelimit-limit") || "200"
    };

    if (!response.ok) {
        let errorMsg = data.error?.message || "Limit Reached";
        if (response.status === 429) errorMsg = "⚠️ Daily Limit Reached. Try again tomorrow.";
        
        return new Response(JSON.stringify({ 
            error: errorMsg,
            isLimit: response.status === 429,
            limits: limitInfo
        }), { status: response.status, headers });
    }

    let reply = data.choices[0].message.content;
    // CLEANING: Remove accidental quotes or bold stars
    reply = reply.replace(/^"|"$/g, '').replace(/\*\*/g, '').trim();

    return new Response(JSON.stringify({ 
        reply: reply,
        usage: data.usage,
        limits: limitInfo 
    }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Connection Failed" }), { status: 500, headers });
  }
}
