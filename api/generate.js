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

  // 🚨 NEW CHECK: This prevents the "****ined" error
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey === "undefined") {
      return new Response(JSON.stringify({ error: "System Configuration Error: API Key is missing in Vercel settings." }), { status: 500, headers });
  }

  try {
    const { input, level, tone, length, format } = await req.json();

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        "model": "deepseek-chat",
        "messages": [
          { "role": "system", "content": "You are a professional assistant." },
          { "role": "user", "content": `Write a ${tone} ${format} in ${level} English for: ${input}` }
        ]
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
        return new Response(JSON.stringify({ error: data.error?.message || "DeepSeek rejected the request" }), { status: response.status, headers });
    }

    return new Response(JSON.stringify({ reply: data.choices[0].message.content }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
}
