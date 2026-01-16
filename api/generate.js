export default async function handler(req, res) {
  // 1. Enable CORS (Allows your website to talk to this backend)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { input, level, tone, length, format, type } = req.body;

    // Optimized Prompt for the Llama 3.2 3B Model
    const prompt = `
    Act as a professional communication assistant.
    Task: Write a reply to this message: "${input}"

    SETTINGS:
    - Tone: ${tone}
    - Level: ${level}
    - Length: ${length} (Short=1 sentence, Long=3 paragraphs)
    - Format: ${format}

    IMPORTANT RULES:
    1. If Format is "Email", start with "Subject: [Topic]" followed by TWO blank lines.
    2. OUTPUT ONLY RAW JSON. Do NOT write "Here is the JSON" or use markdown blocks.
    
    JSON FORMAT:
    {"reply": "Your generated text here"}
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
        // 👇 UPDATED: Using the exact model from your screenshot
        "model": "meta-llama/llama-3.2-3b-instruct:free", 
        "max_tokens": 1000,
        "messages": [
          { "role": "system", "content": "You are a JSON-only API. Never output markdown." },
          { "role": "user", "content": prompt }
        ]
      })
    });

    // 2. Debugging: Check if OpenRouter sent an error
    if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenRouter Error:", errorText);
        return res.status(500).json({ error: "AI Busy. Try again." });
    }

    const data = await response.json();

    // 3. Safety Check: Did we get a valid choice?
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error("Invalid Data:", JSON.stringify(data));
        return res.status(500).json({ error: "AI returned empty response. Try again." });
    }

    let content = data.choices[0].message.content;

    // 4. CLEANER: Remove Markdown (```json ... ```) if the AI adds it
    content = content.replace(/```json/g, "").replace(/```/g, "").trim();

    // 5. Send it back
    return res.status(200).json({ reply: content });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
