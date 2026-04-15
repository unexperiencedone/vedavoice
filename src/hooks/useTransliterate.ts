import { useState, useEffect } from 'react';
import { useTranslation } from '@/components/LanguageProvider';

// Global memory cache to prevent UI flashing and repeated network calls during component re-renders
const memoryCache: Record<string, Record<string, string>> = {};

export function useTransliterate(names: string[]) {
    const { language } = useTranslation();
    const [translations, setTranslations] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Only run transliteration if not in English/Hinglish
        if (language === 'en' || language === 'hinglish') {
            setTranslations({});
            return;
        }

        const fetchTransliterations = async () => {
            const rawNames = names.map(n => n.toLowerCase().trim());
            const needsFetching: string[] = [];
            const resultMapping: Record<string, string> = {};

            // 1. Check Memory Cache immediately
            if (!memoryCache[language]) {
                memoryCache[language] = {};
            }

            for (const n of rawNames) {
                if (memoryCache[language][n]) {
                    resultMapping[n] = memoryCache[language][n];
                } else if (!needsFetching.includes(n)) {
                    needsFetching.push(n);
                }
            }

            // 2. Network Call for anything not in Memory (this hits DB Cache -> API)
            if (needsFetching.length > 0) {
                setLoading(true);
                try {
                    const res = await fetch('/api/transliterate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ names: needsFetching, targetLang: language })
                    });
                    
                    if (res.ok) {
                        const data = await res.json();
                        for (const [eng, loc] of Object.entries(data.translations as Record<string, string>)) {
                            memoryCache[language][eng] = loc;
                            resultMapping[eng] = loc;
                        }
                    }
                } catch (e) {
                    console.error("Transliteration Error", e);
                } finally {
                    setLoading(false);
                }
            }

            setTranslations(resultMapping);
        };

        if (names.length > 0) {
            fetchTransliterations();
        }
    }, [names.length, names.join(','), language]);

    const transliterate = (name: string) => {
        if (language === 'en' || language === 'hinglish') return name;
        const key = name.toLowerCase().trim();
        return translations[key] || name; // Fallback to safe english while loading
    };

    return { transliterate, loading };
}
