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

  // Use your OpenRouter Key from Vercel Environment Variables
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey || apiKey === "undefined") {
      return new Response(JSON.stringify({ 
        error: "Configuration Error: API Key is missing in Vercel settings." 
      }), { status: 500, headers });
  }

  try {
    const { input, level, tone, length, format } = await req.json();

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "X-Title": "Multi-User Reply Assistant"
      },
      body: JSON.stringify({
        "model": "nvidia/nemotron-nano-9b-v2:free",
        "messages": [
          { "role": "system", "content": "You are a professional humanized reply assistant. Output only the message text." },
          { "role": "user", "content": `Write a ${tone} ${format} in ${level} English (${length} length) for this: ${input}` }
        ]
      })
    });

    const data = await response.json();
    
    // 🚨 SMART ERROR HANDLING
    if (!response.ok) {
        // This picks up "Rate limit exceeded" or "Daily quota reached" directly from OpenRouter
        const errorMessage = data.error?.message || "The AI service is currently busy.";
        return new Response(JSON.stringify({ 
            error: errorMessage,
            status: response.status 
        }), { status: response.status, headers });
    }

    return new Response(JSON.stringify({ reply: data.choices[0].message.content }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Server error: " + error.message }), { status: 500, headers });
  }
}
