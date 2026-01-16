export const config = {
  runtime: 'edge', // Vercel Edge Runtime is faster for API calls
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

    // Simplify the prompt to avoid formatting errors
    const prompt = `Write a ${tone} ${format} in ${level} English. Reply to this: "${input}". 
    Important: Use a clear Subject, Greeting, and Sign-off.`;

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        "model": "deepseek-chat", // V3.2 is automatically used by this ID
        "messages": [
          { "role": "system", "content": "You are a helpful assistant." },
          { "role": "user", "content": prompt }
        ],
        "stream": false
      })
    });

    if (!response.ok) {
        // This will tell us EXACTLY what the error is
        const errorData = await response.text();
        return new Response(JSON.stringify({ error: `DeepSeek Server Error: ${response.status}. Details: ${errorData.substring(0, 100)}` }), { status: 500, headers });
    }

    const data = await response.json();
    return new Response(JSON.stringify({ reply: data.choices[0].message.content }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: `Connection Error: ${error.message}` }), { status: 500, headers });
  }
}
