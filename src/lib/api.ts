import { ExtractResult } from '@/types'
 
export async function extractFromText(text: string, language: string = 'en'): Promise<ExtractResult> {
  const url = `/api/extract?t=${Date.now()}`;
  console.log(`[CLIENT] 📡 Calling Extraction API: ${url}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
    cache: 'no-store'
  })
 
  if (!res.ok) throw new Error('Extraction failed')
  return res.json()
}