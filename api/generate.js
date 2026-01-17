export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // CORS Headers to allow your website to talk to this backend
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
      return new Response(JSON.stringify({ error: "System Error: API Key is missing in Vercel." }), { status: 500, headers });
  }

  try {
    const { input, level, tone, length, format } = await req.json();

    // --- SMART PROMPT ---
    // Forces the model to speak naturally and format correctly based on selection
    let systemInstruction = "You are a communication expert. Write in NATURAL, HUMAN English. Use contractions (e.g., 'I'm'). Output ONLY the raw reply text. Do NOT use markdown bolding (**). Do NOT wrap in quotes.";
    
    let userInstruction = "";
    if (format === "email") {
        userInstruction = `Write a ${tone} EMAIL reply. Level: ${level}. Length: ${length}. Incoming: "${input}". 
        RULES: Include a Subject line. Use proper salutation/sign-off.`;
    } else {
        userInstruction = `Write a ${tone} CHAT reply. Level: ${level}. Length: ${length}. Incoming: "${input}". 
        RULES: Direct answer. No subject. Sound casual.`;
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://reply-assistant.vercel.app",
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

    // --- BUG FIX: SAFE JSON PARSING ---
    // We read text first to prevent crashing if API returns HTML error pages
    const rawText = await response.text();
    let data;
    try {
        data = JSON.parse(rawText);
    } catch (e) {
        // If parsing fails, it's likely a server error from OpenRouter
        return new Response(JSON.stringify({ error: "External API Error: The AI service is temporarily down." }), { status: 502, headers });
    }
    
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
    return new Response(JSON.stringify({ error: "Connection Failed: " + error.message }), { status: 500, headers });
  }
}
