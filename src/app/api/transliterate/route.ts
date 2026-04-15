import { NextRequest, NextResponse } from 'next/server'
import { processTransliterationAPI } from '@/lib/transliterationMock';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { names, targetLang } = await req.json()

    if (!names || !Array.isArray(names) || !targetLang) {
      return NextResponse.json({ error: 'Missing Data: needs array of names and targetLang' }, { status: 400 })
    }

    if (names.length === 0) {
        return NextResponse.json({ translations: {} });
    }

    // Convert everything to lowercase for pure caching keys
    const rawNames = names.map(n => n.toLowerCase().trim());
    
    // 1. Fetch from Supabase Cache
    const { data: cached } = await supabase
        .from('name_translations')
        .select('english_name, translated_name')
        .eq('language_code', targetLang)
        .in('english_name', rawNames);

    const translations: Record<string, string> = {};
    const uncachedNames: string[] = [...rawNames];

    if (cached) {
        for (const row of cached) {
            translations[row.english_name] = row.translated_name;
            const index = uncachedNames.indexOf(row.english_name);
            if (index > -1) uncachedNames.splice(index, 1);
        }
    }

    // 2. Process uncached names through API Interceptor
    if (uncachedNames.length > 0) {
        const newInserts = [];

        for (const name of uncachedNames) {
            const result = await processTransliterationAPI(name, targetLang);
            translations[name] = result;

            newInserts.push({
                english_name: name,
                language_code: targetLang,
                translated_name: result
            });
        }

        // 3. Batch Save back to Supabase Cache so we never call it again for these names
        if (newInserts.length > 0) {
            await supabase
                .from('name_translations')
                .insert(newInserts);
        }
    }

    // Return the mapping so the frontend can quickly swap out the english strings
    return NextResponse.json({ translations });
    
  } catch (error: any) {
    console.error('API /transliterate Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
