import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, language = 'en' } = body;
    const langNames: Record<string, string> = {
      hi: 'Hindi',
      mr: 'Marathi',
      bn: 'Bengali',
      gu: 'Gujarati',
      hinglish: 'Hinglish (Mix of Hindi and English)',
      en: 'English'
    };
    const targetLangName = langNames[language] || 'Hinglish';

    console.log(`\n[API] 🎙️ Received Voice Text => ${text} | Target Lang => ${targetLangName}`);

    if (!text) {
      console.log("[API] ❌ No text provided in body.");
      return NextResponse.json({ error: 'No text provided' }, { status: 400 })
    }

    const API_KEY = process.env.GROQ_API_KEY
    if (!API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY is not set in environment' }, { status: 500 })
    }

    const SYSTEM_PROMPT = `
You are an entity extractor for a multi-regional voice ledger app used by Indian contractors.
The output MUST be a strict JSON object.

The Contractor is currently using ${targetLangName}. 
- Extract information primarily in English for database indexing (name, action, unit).
- **IMPORTANT**: The 'notes' field MUST be extracted in ${targetLangName} script if the user mentioned a reason or context.

Extract from the user's spoken text:
- name: person's name (string)
- qualifier: any nickname or identifier attached (string or null)
- amount: total money integer or float
- unit: "INR" or "days"
- action: One of the following EXACT actions:
  - PAYMENT: paid out wages/settlement
  - ADVANCE: gave a loan/advance (udhaar)
  - RECEIPT: received money from builder
  - MATERIAL: paid for cement, sand, transport
  - ATTENDANCE: marked presence
- notes: exact reason, deductions, partial context, etc (String in ${targetLangName} script or null)

Return ONLY valid JSON. No explanation.

Example (${targetLangName}):
Input: "Raju ko 500 advance do chai ke liye"
Output: {"name": "Raju", "amount": 500, "unit": "INR", "action": "ADVANCE", "notes": "चाय के लिए"} (if Hindi)
`

    let resultText = "";
    let retries = 3;

    while (retries > 0) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile", // Llama 3.3 70B runs on Groq LPUs extremely fast
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: text }
            ],
            response_format: { type: "json_object" }, // Guarantees JSON output natively
            temperature: 0
          })
        })

        if (!groqRes.ok) {
           const errData = await groqRes.json().catch(() => null);
           throw new Error(errData?.error?.message || `Groq API Error: ${groqRes.status}`);
        }

        const data = await groqRes.json();
        resultText = data.choices[0].message.content;
        break;
      } catch (err: any) {
        if (retries > 1) {
          console.log(`[API] ⚠️ Groq API issue. Retrying in 1.5s... (${retries - 1} left)`, err.message);
          await new Promise(r => setTimeout(r, 1500));
          retries--;
        } else {
          throw err;
        }
      }
    }

    if (!resultText) {
       return NextResponse.json({ error: 'Failed to extract entities' }, { status: 500 })
    }

    const parsed = JSON.parse(resultText)
    
    console.log("[API] ✨ Groq Output Parse Success =>", parsed);

    // Map the output to match our ExtractResult type
    const mappedToFrontend = {
      name: parsed.name ?? null,
      qualifier: parsed.qualifier ?? null,
      amount_int: parsed.amount ?? null,
      amount_raw: null,
      unit: parsed.unit ?? 'INR',
      action: parsed.action ?? 'UNKNOWN',
      notes: parsed.notes ?? null,
      confidence: 0.99, // Llama3 doesn't return probabilities in standard JSON mode
      raw: [parsed]
    }

    return NextResponse.json(mappedToFrontend)
  } catch (error: any) {
    console.error("Extraction error:", error)
    return NextResponse.json({ error: 'Backend error' }, { status: 502 })
  }
}