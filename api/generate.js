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

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    const { input, level, tone, length, format } = await req.json();

    // 👇 STRICT EMAIL FORMATTING PROMPT
    const prompt = `
    Role: Professional Communication Assistant.
    Task: Write a reply to: "${input}"
    
    SETTINGS:
    - Tone: ${tone}
    - Level: ${level}
    - Format: ${format}
    - Length: ${length}

    🚨 CRITICAL RULES FOR "${format.toUpperCase()}" FORMAT 🚨:

    ${format === 'email' ? `
    YOU MUST FOLLOW THIS EXACT EMAIL TEMPLATE:
    ------------------------------------------
    Subject: [Create a relevant subject line]
    
    Dear [Name],
    
    [Write a full, polite paragraph here. Even if the input is short, expand on it to make it professional.]
    
    Best regards,
    [Your Name]
    ------------------------------------------
    * Do NOT output a single line.
    * Do NOT forget the Subject line.
    * You MUST include "Dear..." and "Best regards...".
    ` : `
    * Just write a direct, casual chat message.
    * NO Subject line.
    * NO "Dear" or "Best regards".
    `}

    OUTPUT FORMAT:
    Return ONLY raw JSON (no markdown):
    {"reply": "Your full generated text here"}
    `;

    // 👇 GROQ MODELS (Matches your screenshot)
    const models = [
      "llama-3.3-70b-versatile",    // 1. Smartest (Free)
      "llama-3.1-8b-instant",       // 2. Fastest (Free)
      "mixtral-8x7b-32768"          // 3. Backup (Free)
    ];

    let lastError = "";

    // Loop to try models until one works
    for (const model of models) {
        try {
            console.log(`Trying Groq model: ${model}...`); 
            
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}` // Uses your NEW Groq Key
                },
                body: JSON.stringify({
                    "model": model,
                    "max_tokens": 1000,
                    "messages": [
                        { "role": "system", "content": "You are a JSON-only API. You strictly follow formatting rules." },
                        { "role": "user", "content": prompt }
                    ]
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Status ${response.status}: ${errText}`);
            }

            const data = await response.json();
            
            if (!data.choices || !data.choices[0]) {
                throw new Error("Empty response");
            }

            let content = data.choices[0].message.content;
            content = content.replace(/```json/g, "").replace(/```/g, "").trim();
            
            return new Response(JSON.stringify({ reply: content }), { status: 200, headers });

        } catch (error) {
            console.warn(`Groq ${model} failed:`, error.message);
            lastError = error.message;
        }
    }

    return new Response(JSON.stringify({ error: `Groq Busy. Last error: ${lastError}` }), { status: 503, headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
}
