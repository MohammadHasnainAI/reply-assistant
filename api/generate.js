export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const { input, level, tone, length, format, type } = await req.json();

    const prompt = `Act as a humanized reply expert. Write a ${tone} reply to this message: "${input}". 
    Use ${level} level English. Format it as an ${format}. 
    ${type === 'regenerate' ? 'Provide a unique phrasing.' : ''} 
    Return ONLY JSON: {"sentiment": "VIBE", "reply": "TEXT"}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://pro-reply-assistant.vercel.app", // Updated to your new professional link
        "X-Title": "Humanized Reply Assistant"
      },
      body: JSON.stringify({
        "model": "deepseek/deepseek-r1:free", // FIX 1: Added :free for $0 cost
        "max_tokens": 1000,                    // FIX 2: Added limit to stop "credit" errors
        "messages": [
          { "role": "system", "content": "You are a humanized reply generator. Output only valid JSON." },
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
