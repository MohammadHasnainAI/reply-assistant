export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const { input, level, tone, length, format, type } = await req.json();

    // 👇 FIXED: Added explicit instruction for "Email" line breaks
    const prompt = `
    Act as a professional communication assistant.
    Your task is to write a reply to this incoming message: "${input}"

    STRICT GENERATION SETTINGS:
    1. TONE: ${tone} (Make it sound exactly like this)
    2. ENGLISH LEVEL: ${level} 
       - If "Easy": Use simple words, short sentences.
       - If "Hard": Use sophisticated vocabulary.
    3. LENGTH: ${length}
       - If "Short": 1-2 sentences.
       - If "Long": 2-3 detailed paragraphs.
    4. FORMAT: ${format}
       - If "Email": You MUST start with "Subject: [Topic]", then add TWO NEW LINES (\n\n) before writing the email body.
       - If "Message (Chat)": Do not use a subject line.

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
        "model": "meta-llama/llama-3.3-70b-instruct:free", // Keeping the powerful free model
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

    const content = data.choices[0].message.content;

    return new Response(JSON.stringify({ reply: content }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
