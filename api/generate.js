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

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
      return new Response(JSON.stringify({ error: "Configuration Error: API Key missing." }), { status: 500, headers });
  }

  try {
    const { input, level, tone, length, format } = await req.json();

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://your-site.com", // Optional: Change to your site
        "X-Title": "Professional Reply Assistant"
      },
      body: JSON.stringify({
        "model": "nvidia/nemotron-nano-9b-v2:free",
        "messages": [
          { 
            "role": "system", 
            "content": "You are a professional communication assistant. IMPORTANT RULES: 1. Output ONLY the raw reply text. 2. Do NOT use markdown bolding (like **Text**). 3. Do NOT wrap the reply in quotes. 4. Do NOT include placeholders like [Your Name] - just end the message naturally." 
          },
          { "role": "user", "content": `Write a ${tone} ${format} in ${level} English. Length: ${length}. The incoming message is: "${input}"` }
        ]
      })
    });

    const data = await response.json();
    
    // --- RESPECTFUL ERROR HANDLING ---
    if (!response.ok) {
        let friendlyMessage = "Unable to generate reply.";
        
        // Check for specific Limit Errors (429)
        if (response.status === 429) {
            friendlyMessage = "High Traffic Alert: The free AI service is currently busy. Please wait 60 seconds and try again.";
        } else if (data.error && data.error.message) {
             friendlyMessage = `System Notice: ${data.error.message}`;
        }

        return new Response(JSON.stringify({ 
            error: friendlyMessage,
            isLimit: response.status === 429 
        }), { status: response.status, headers });
    }

    let reply = data.choices[0].message.content;
    
    // CLEANING: Remove accidental quotes or bold stars
    reply = reply.replace(/^"|"$/g, '') // Remove starting/ending quotes
                 .replace(/\*\*/g, '')    // Remove bold markdown
                 .trim();

    // Send reply + Usage Stats
    return new Response(JSON.stringify({ 
        reply: reply,
        usage: data.usage || { total_tokens: 0 } 
    }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Connection Error: " + error.message }), { status: 500, headers });
  }
}
