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

  try {
    const { input, level, tone, length, format } = await req.json();

    const prompt = `Write a ${tone} ${format} in ${level} English. Reply to: "${input}". 
    Format: Use Subject line, Greeting, and Sign-off.`;

    // 👇 A4F Unified Endpoint
    const response = await fetch("https://api.a4f.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.A4F_API_KEY}` // Use your ddc-a4f... key here
      },
      body: JSON.stringify({
        "model": "provider-5/gemini-2.5-flash-lite", // The model you picked
        "messages": [
          { "role": "system", "content": "You are a professional email assistant." },
          { "role": "user", "content": prompt }
        ],
        "temperature": 0.7
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
        return new Response(JSON.stringify({ error: data.error?.message || "A4F Error" }), { status: response.status, headers });
    }

    return new Response(JSON.stringify({ reply: data.choices[0].message.content }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
}
