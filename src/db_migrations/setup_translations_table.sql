-- Table: name_translations
-- Purpose: Cache transliterations of names to avoid repeated API calls.

CREATE TABLE IF NOT EXISTS public.name_translations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    english_name TEXT NOT NULL,
    language_code TEXT NOT NULL,
    translated_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ensure we don't have duplicate translations for the same exact name & language combination
    UNIQUE(english_name, language_code)
);

-- Turn on Row Level Security (RLS) for safety
ALTER TABLE public.name_translations ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read and insert translations
CREATE POLICY "Enable read access for all authenticated users" ON public.name_translations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert for authenticated users" ON public.name_translations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
