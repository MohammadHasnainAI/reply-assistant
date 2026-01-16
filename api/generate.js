export const config = {
  runtime: 'edge', // ✅ Keystone: Allows up to 25s execution (fixes timeouts)
};

export default async function handler(req) {
  // 1. CORS Headers (Fixes "Network Error")
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle Pre-flight Check
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    // 2. Parse Input (Safe Way)
    const { input, level, tone, length, format, type } = await req.json();

    const prompt = `
    Act as a professional communication assistant.
    Task: Write a reply to this message: "${input}"

    SETTINGS:
    - Tone: ${tone}
    - Level: ${level}
    - Length: ${length}
    - Format: ${format}

    IMPORTANT:
    1. If Format is "Email", start with "Subject: [Topic]" followed by TWO blank lines.
    2. OUTPUT ONLY RAW JSON. No markdown.
    
    JSON FORMAT:
    {"reply": "Your text here"}
    `;

    // 3. The "Smart" Fetch (Retry Logic)
    let modelToUse = "meta-llama/llama-3.2-3b-instruct:free"; // Primary (Fast)

    const fetchReply = async (model) => {
        return await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "HTTP-Referer": "https://pro-reply-assistant.vercel.app",
                "X-Title": "Humanized Reply Assistant"
            },
            body: JSON.stringify({
                "model": model,
                "max_tokens": 1000,
                "messages": [
                    { "role": "system", "content": "You are a JSON-only API." },
                    { "role": "user", "content": prompt }
                ]
            })
        });
    };

    let response = await fetchReply(modelToUse);

    // If 3B fails (busy), try 8B (Backup)
    if (!response.ok) {
        console.log("3B Model Failed, switching to 8B...");
        modelToUse = "meta-llama/llama-3.1-8b-instruct:free";
        response = await fetchReply(modelToUse);
    }

    if (!response.ok) {
        const errText = await response.text();
        return new Response(JSON.stringify({ error: `AI Busy: ${errText}` }), { status: 500, headers });
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0]) {
        return new Response(JSON.stringify({ error: "AI returned empty response" }), { status: 500, headers });
    }

    let content = data.choices[0].message.content;
    
    // Clean Markdown
    content = content.replace(/```json/g, "").replace(/```/g, "").trim();

    return new Response(JSON.stringify({ reply: content }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
}
