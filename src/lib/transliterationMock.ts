/**
 * Mock Transliteration Engine (For Hackathon Demonstration)
 * 
 * In a production environment, this would be swapped out with a call to AI4Bharat Bhashini 
 * or the Google Cloud Translation API to transliterate any generic string.
 */

const DICTIONARY: Record<string, Record<string, string>> = {
  karan: {
    hi: 'करण',
    mr: 'करण',
    bn: 'করণ',
    gu: 'કરણ',
    hinglish: 'Karan',
    en: 'Karan'
  },
  akshansh: {
    hi: 'अक्षांश',
    mr: 'अक्षांश',
    bn: 'অক্ষাংশ',
    gu: 'અક્ષાંશ',
    hinglish: 'Akshansh',
    en: 'Akshansh'
  },
  deepak: {
    hi: 'दीपक',
    mr: 'दीपक',
    bn: 'দীপক',
    gu: 'દીપક',
    hinglish: 'Deepak',
    en: 'Deepak'
  },
  ram: {
      hi: 'राम',
      mr: 'राम',
      bn: 'রাম',
      gu: 'રામ',
      hinglish: 'Ram',
      en: 'Ram'
  },
  raju: {
      hi: 'राजू',
      mr: 'राजू',
      bn: 'রাজু',
      gu: 'રાજુ',
      hinglish: 'Raju',
      en: 'Raju'
  }
};

export async function processTransliterationAPI(name: string, targetLang: string): Promise<string> {
  // Simulate network delay for the API
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const normalizedKey = name.toLowerCase().trim();
  const options = DICTIONARY[normalizedKey];

  if (options && options[targetLang]) {
      return options[targetLang];
  }

  // Fallback if not in the mock dictionary
  return name;
}
