// NOTE: I removed the "runtime: 'edge'" part to prevent timeouts.

export default async function handler(req, res) {
  // 1. Handle CORS (Allows your frontend to talk to this backend)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle the "Pre-flight" check
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { input, level, tone, length, format, type } = req.body;

    console.log("Processing request for:", input); // This helps debug in Vercel logs

    const prompt = `
    Act as a professional communication assistant.
    Your task is to write a reply to this incoming message: "${input}"

    STRICT GENERATION SETTINGS:
    1. TONE: ${tone}
    2. ENGLISH LEVEL: ${level} 
    3. LENGTH: ${length}
       - If "Short": 1-2 sentences.
       - If "Long": 2-3 detailed paragraphs.
    4. FORMAT: ${format}
       - If "Email": You MUST start with "Subject: [Topic]", then add TWO NEW LINES (\n\n) before writing the email body.
       - If "Message (Chat)": No subject line.

    ${type === 'regenerate' ? 'User wants a completely different version.' : ''}

    Return ONLY JSON: 
    {"sentiment": "One word vibe check", "reply": "The generated response"}
    `;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://pro-reply-assistant.vercel.app",
        "X-Title": "Humanized Reply Assistant"
      },
      body: JSON.stringify({
        "model": "meta-llama/llama-3.3-70b-instruct:free", // Your chosen Free Model
        "max_tokens": 1000,
        "messages": [
          { "role": "system", "content": "You are a helpful assistant that outputs only valid JSON." },
          { "role": "user", "content": prompt }
        ]
      })
    });

    // 2. SAFETY CHECK: Check if OpenRouter failed BEFORE trying to read JSON
    if (!response.ok) {
        const errorText = await response.text(); // Read raw text in case it's not JSON
        console.error("OpenRouter API Error:", errorText);
        return res.status(response.status).json({ error: `AI Provider Error: ${response.statusText}` });
    }

    const data = await response.json();

    // 3. Extract content safely
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("Invalid response format from AI");
    }

    const content = data.choices[0].message.content;

    // Send success response
    return res.status(200).json({ reply: content });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
