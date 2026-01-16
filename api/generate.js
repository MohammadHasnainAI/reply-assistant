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

    // 👇 YOUR BACKUP TEAM (Mapped to your specific Vercel Keys)
    const backupTeam = [
      { 
        name: "Llama 3.2 3B",
        id: "meta-llama/llama-3.2-3b-instruct:free", 
        key: process.env.OPENROUTER_API_KEY // ✅ Uses your EXISTING key
      },
      { 
        name: "Mistral Small 24B",
        id: "mistralai/mistral-small-24b-instruct-2501:free", 
        key: process.env.KEY_MISTRAL // ✅ Uses the new Mistral key
      },
      { 
        name: "Qwen 2.5 VL",
        id: "qwen/qwen-2.5-vl-7b-instruct:free", 
        key: process.env.KEY_QWEN // ✅ Uses the new Qwen key
      },
      { 
        name: "NVIDIA Nemotron",
        id: "nvidia/nemotron-nano-9b-v2:free", 
        key: process.env.KEY_NVIDIA // ✅ Uses the new NVIDIA key
      }
    ];

    let lastError = "";

    // Loop through the team until one works
    for (const agent of backupTeam) {
        // Skip if key is missing (prevents crashes if you forgot one)
        if (!agent.key) {
            console.warn(`Skipping ${agent.name} (Key missing)`);
            continue;
        }

        try {
            console.log(`Trying ${agent.name}...`); 
            
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${agent.key}`, // Uses the specific key for this agent
                    "HTTP-Referer": "https://pro-reply-assistant.vercel.app",
                    "X-Title": "Humanized Reply Assistant"
                },
                body: JSON.stringify({
                    "model": agent.id,
                    "max_tokens": 1000,
                    "messages": [
                        { "role": "system", "content": "You are a JSON-only API." },
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
            
            // Success! Return the reply immediately.
            return new Response(JSON.stringify({ reply: content }), { status: 200, headers });

        } catch (error) {
            console.warn(`${agent.name} failed:`, error.message);
            lastError = error.message;
            // Continue to the next agent...
        }
    }

    return new Response(JSON.stringify({ error: `All models busy. Last error: ${lastError}` }), { status: 503, headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
}
