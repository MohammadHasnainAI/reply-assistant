export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const { input, level, tone, length, format, type } = await req.json();

    // 👇 IMPROVED PROMPT: Forces Subject Line for Emails & Better Context
    const prompt = `
    You are an expert communication assistant. 
    Task: Write a reply to the following incoming message: "${input}".
    
    Settings:
    - Tone: ${tone}
    - English Level: ${level}
    - Format: ${format}
    - Goal: ${type === 'regenerate' ? 'Provide a completely different option.' : 'Write the best possible response.'}

    IMPORTANT RULES:
    1. If Format is "Email", you MUST include a "Subject:" line at the top.
    2. If Format is "Message (Chat)", keep it short and casual.
    3. Do not assume user context unless given (use placeholders like [Your Name] if needed).
    
    Return ONLY JSON in this format: 
    {"sentiment": "Brief summary of input vibe", "reply": "The actual response text"}
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
        "model": "meta-llama/llama-3.3-70b-instruct:free", // Best Free Model
        "max_tokens": 1000,
        "messages": [
          { "role": "system", "content": "You are a helpful assistant that outputs only valid JSON." },
          { "role": "user", "content": prompt }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || "AI Error" }), { status: 500 });
    }

    // Extract the content
    const content = data.choices[0].message.content;

    return new Response(JSON.stringify({ reply: content }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
