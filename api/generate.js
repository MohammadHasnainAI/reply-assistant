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

    // --- SMART PROMPT ENGINEERING ---
    let systemInstruction = "You are a communication expert. Write in NATURAL, HUMAN English. Use contractions (e.g., 'I'm' instead of 'I am') and conversational flow. Do NOT use AI buzzwords.";
    let userInstruction = "";

    if (format === "email") {
        userInstruction = `Write a ${tone} EMAIL reply to this message: "${input}". 
        English Level: ${level}. Length: ${length}.
        RULES: 
        1. Must include a professional "Subject:" line at the top.
        2. Use a proper salutation (e.g., Hi [Name], Dear [Name]).
        3. Use a proper sign-off (e.g., Best regards, Thanks).
        4. Leave placeholders like [Your Name] blank or generic.`;
    } else {
        userInstruction = `Write a ${tone} CHAT MESSAGE reply to this: "${input}". 
        English Level: ${level}. Length: ${length}.
        RULES: 
        1. Direct answer only. NO subject line. NO salutation. 
        2. Sound casual and human.`;
    }

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
          { "role": "system", "content": systemInstruction },
          { "role": "user", "content": userInstruction }
        ]
      })
    });

    const data = await response.json();
    
    // --- REAL GLOBAL LIMITS ---
    const limitInfo = {
        remaining: response.headers.get("x-ratelimit-remaining") || "200",
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
