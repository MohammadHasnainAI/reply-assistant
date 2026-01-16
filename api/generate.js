export const config = {
  runtime: 'edge', // Keeps connection alive for long replies
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

    const prompt = `
    Role: Professional Communication Assistant.
    Task: Write a reply to: "${input}"
    Settings: Tone=${tone}, Level=${level}, Format=${format}, Length=${length}.

    ${format === 'email' ? `
    STRICT EMAIL TEMPLATE:
    Subject: [Professional Topic]
    
    Dear [Name],
    
    [Detailed paragraph expanding the reply professionally]
    
    Best regards,
    [Your Name]
    ` : `Write a direct chat message. No subject or formal sign-off.`}
    
    Return ONLY raw JSON: {"reply": "content"}
    `;

    // 👇 Official DeepSeek API Connection
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        "model": "deepseek-chat", // V3.2 is the default for deepseek-chat in 2026
        "messages": [
          { "role": "system", "content": "You are a professional assistant that outputs only valid JSON." },
          { "role": "user", "content": prompt }
        ],
        "temperature": 0.7,
        "response_format": { "type": "json_object" } // DeepSeek supports native JSON mode
      })
    });

    if (!response.ok) {
        const err = await response.text();
        return new Response(JSON.stringify({ error: `DeepSeek Error: ${err}` }), { status: 500, headers });
    }

    const data = await response.json();
    const resultText = JSON.parse(data.choices[0].message.content).reply;

    return new Response(JSON.stringify({ reply: resultText }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
}
