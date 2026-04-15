import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { text, workers, language } = await req.json()
    if (!text) return NextResponse.json({ error: 'No text provided' }, { status: 400 })

    const API_KEY = process.env.GROQ_API_KEY
    if (!API_KEY) return NextResponse.json({ error: 'GROQ_API_KEY not set' }, { status: 500 })

    const workerList = (workers as {name: string, qualifier?: string}[])
      .map(w => w.qualifier ? `${w.name} (${w.qualifier})` : w.name)
      .join(', ')

    const PROMPT = `You are parsing attendance for an Indian construction site in ${language || 'Hindi/English'}.
Registered workers: ${workerList}

Task: From the supervisor's voice input, extract ONLY the workers explicitly mentioned by name.

Attendance status mapping (Regionally adapted):
- present: "aaya", "hai", "poora din", "hazir", "present", "উপস্থিত" (BN), "હાજર" (GU), "आला आहे" (MR)
- half: "half day", "adha din", "half", "অর্ধ দিন" (BN), "અડધો દિવસ" (GU), "अर्धा दिवस" (MR)
- absent: "nahi aaya", "chhutti", "gayab", "absent", "nahi hai", "আসেনি" (BN), "ગેરહાજર" (GU), "नाही आला" (MR)

CRITICAL RULES:
1. ONLY include workers whose names are explicitly spoken in the input
2. Do NOT include workers who are not mentioned
3. Do NOT assume status for unmentioned workers
4. If NO specific name is mentioned (e.g. just "sab present" or "সব হাজির"), return {"all": true, "status": "present"}
5. Return ONLY valid JSON, no explanation

Examples:
Input: "Raju aaya aur Ramesh nahi aaya" → {"workers": [{"name": "Raju", "status": "present"}, {"name": "Ramesh", "status": "absent"}]}
Input: "Sab present hai aaj" → {"all": true, "status": "present"}
Input: "Suresh half day" → {"workers": [{"name": "Suresh", "status": "half"}]}
Input: "সবাই এসছে" (Bengali: All present) → {"all": true, "status": "present"}

Input: "${text}"
`

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: PROMPT }],
        response_format: { type: 'json_object' },
        temperature: 0
      })
    })

    if (!res.ok) throw new Error(`Groq error: ${res.status}`)
    const data = await res.json()
    const parsed = JSON.parse(data.choices[0].message.content)

    // New format: {all: true, status: 'present'} — frontend will expand to all workers
    if (parsed.all === true && parsed.status) {
      return NextResponse.json({ all: true, status: parsed.status })
    }

    // New format: {workers: [{name, status}]}
    const results = parsed.workers ?? (Array.isArray(parsed) ? parsed : [])
    return NextResponse.json({ results })
  } catch (err: any) {
    console.error('[Attendance Parse Error]', err)
    return NextResponse.json({ error: err.message }, { status: 502 })
  }
}
