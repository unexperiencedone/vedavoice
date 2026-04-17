'use client'

import { useTranslation } from './LanguageProvider'
import { Language, translations } from '@/lib/translations'
import { usePathname } from 'next/navigation'

export default function Header() {
  const { language, setLanguage } = useTranslation()
  const pathname = usePathname()

  if (pathname === '/login') return null;

  return (
    <header className="fixed top-0 w-full flex justify-between items-center px-6 py-4 bg-slate-50/80 backdrop-blur-xl shadow-sm z-50">
      <div className="flex items-center gap-3">
        <div className="flex bg-surface-container-low p-1 rounded-xl gap-1 overflow-x-auto max-w-[280px] md:max-w-none no-scrollbar">
          {(['en', 'hi', 'mr', 'gu', 'bn', 'hinglish'] as Language[]).map(l => (
            <button 
              key={l}
              onClick={() => setLanguage(l)}
              className={`px-3 py-1.5 rounded-lg text-[10px] whitespace-nowrap font-black uppercase tracking-tight transition-all
              ${language === l ? 'bg-primary text-white shadow-md' : 'text-outline hover:bg-surface-container-high'}`}>
              {translations[l].label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 ml-auto">
        <div className="hidden sm:block text-right">
           <p className="text-[10px] font-black uppercase text-outline leading-none mb-0.5">Parchi</p>
           <p className="text-primary font-black text-xs uppercase tracking-widest font-headline leading-none">Hisaab Hub</p>
        </div>
        <button className="p-2 rounded-xl text-primary hover:bg-surface-container-low transition-colors active:scale-95">
          <span className="material-symbols-outlined">settings</span>
        </button>
      </div>
    </header>
  )
}
