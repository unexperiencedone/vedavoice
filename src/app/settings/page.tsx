'use client'

import { useState, useEffect } from 'react'
import { useShop } from '@/hooks/useShop'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'
import { Language } from '@/lib/translations'

const LANGUAGES: { code: Language; label: string; nativeLabel: string; flag: string }[] = [
  { code: 'en',       label: 'English',   nativeLabel: 'English',   flag: '🇬🇧' },
  { code: 'hi',       label: 'Hindi',     nativeLabel: 'हिन्दी',      flag: '🇮🇳' },
  { code: 'mr',       label: 'Marathi',   nativeLabel: 'मराठी',       flag: '🟠' },
  { code: 'bn',       label: 'Bengali',   nativeLabel: 'বাংলা',       flag: '🟢' },
  { code: 'gu',       label: 'Gujarati',  nativeLabel: 'ગુજરાતી',     flag: '🔵' },
  { code: 'hinglish', label: 'Hinglish',  nativeLabel: 'Hinglish',   flag: '🤝' },
]

export default function SettingsPage() {
  const { shop, loading, updateShop, logout } = useShop()
  const auth   = useAuth()
  const router = useRouter()
  const { t, language, setLanguage } = useTranslation()

  const [shopName,  setShopName]  = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone,     setPhone]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  useEffect(() => {
    if (shop) {
      setShopName(shop.shop_name)
      setOwnerName(shop.owner_name)
      setPhone(shop.phone ?? '')
    }
  }, [shop])

  async function handleSave() {
    setSaving(true)
    await updateShop({ shop_name: shopName, owner_name: ownerName, phone: phone })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-background pb-24">

      {/* Header */}
      <header className="w-full sticky md:relative top-0 bg-gradient-to-br from-indigo-700 to-indigo-900 md:bg-none md:bg-transparent backdrop-blur-xl shadow-lg md:shadow-none shadow-indigo-900/20 z-40">
        <div className="flex justify-between items-center px-6 md:px-8 py-6">
          <div>
            <h1 className="text-white md:text-on-surface font-headline font-bold text-xl tracking-tight">{t('nav_account')}</h1>
            <p className="text-indigo-200 md:text-on-surface-variant text-sm font-medium">{t('settings_subtitle')}</p>
          </div>
          <div className="w-10 h-10 rounded-full md:hidden overflow-hidden border-2 border-white/20">
            {auth?.avatarUrl ? (
              <img src={auth.avatarUrl} alt={auth.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-indigo-500 flex items-center justify-center text-white font-headline font-bold text-sm">
                {auth?.name?.[0]?.toUpperCase() ?? 'T'}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 mt-8 space-y-6">

        {/* ── Language Selector ── */}
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/10">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-primary/10 p-2 rounded-full">
              <span className="material-symbols-outlined text-primary">language</span>
            </div>
            <div>
              <h2 className="font-headline font-bold text-on-surface">{t('settings_language')}</h2>
              <p className="text-outline text-xs mt-0.5">{t('settings_language_hint')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left
                  ${language === lang.code
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-outline-variant/20 hover:border-primary/30 hover:bg-surface-container-low'}`}
              >
                <span className="text-2xl">{lang.flag}</span>
                <div className="min-w-0">
                  <p className={`font-headline font-bold text-sm ${language === lang.code ? 'text-primary' : 'text-on-surface'}`}>
                    {lang.nativeLabel}
                  </p>
                  <p className="text-outline text-[10px] font-medium">{lang.label}</p>
                </div>
                {language === lang.code && (
                  <span className="material-symbols-outlined text-primary text-lg ml-auto shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* ── Contractor Profile ── */}
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-primary/10 p-2 rounded-full">
              <span className="material-symbols-outlined text-primary">business_center</span>
            </div>
            <h2 className="font-headline font-bold text-on-surface">{t('settings_profile')}</h2>
          </div>

          <div className="space-y-5">
            <div>
              <label className="font-label text-[10px] font-bold text-outline tracking-wider uppercase block mb-1.5 px-1">
                {t('settings_company_name')}
              </label>
              <input type="text" value={shopName} onChange={e => setShopName(e.target.value)}
                placeholder="Sharma Construction Co."
                className="w-full bg-surface-container-low rounded-xl py-3.5 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-medium transition-all" />
            </div>

            <div>
              <label className="font-label text-[10px] font-bold text-outline tracking-wider uppercase block mb-1.5 px-1">
                {t('settings_owner_name')} ({t('supervisor')})
              </label>
              <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)}
                placeholder="Ramesh Sharma"
                className="w-full bg-surface-container-low rounded-xl py-3.5 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-medium transition-all" />
            </div>

            <div>
              <label className="font-label text-[10px] font-bold text-outline tracking-wider uppercase block mb-1.5 px-1">
                {t('worker_phone')}
              </label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full bg-surface-container-low rounded-xl py-3.5 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-medium transition-all" />
            </div>

            <div className="opacity-70 mt-6">
              <label className="font-label text-[10px] font-bold text-outline tracking-wider uppercase block mb-1.5 px-1">
                {t('settings_email')}
              </label>
              <div className="flex items-center bg-surface-container-low rounded-xl py-3.5 px-4">
                <span className="text-on-surface font-medium truncate">{auth?.email ?? t('settings_not_linked')}</span>
                <span className="material-symbols-outlined text-sm ml-auto text-outline shrink-0">lock</span>
              </div>
              <p className="text-xs text-outline mt-1 px-1">{t('settings_email_locked')}</p>
            </div>

            <button onClick={handleSave} disabled={saving}
              className="w-full bg-primary text-white py-4 rounded-xl font-headline font-bold text-sm tracking-wide disabled:opacity-50 active:scale-95 transition-transform mt-4"
              style={{ boxShadow: '0 8px 20px rgba(42,20,180,0.25)' }}>
              {saving ? t('saving') : saved ? `${t('confirm')} ✓` : t('settings_save')}
            </button>
          </div>
        </section>

        {/* App info */}
        <section className="grid grid-cols-2 gap-4">
          <div className="col-span-2 bg-surface-container-low rounded-2xl p-5">
            <h3 className="font-headline font-bold text-on-surface mb-1">Parchi</h3>
            <p className="text-xs text-on-surface-variant">{t('settings_app_desc')}</p>
            <div className="mt-4 flex items-center gap-2">
              <span className="px-3 py-1 bg-tertiary/10 text-tertiary text-[10px] font-bold rounded-full uppercase tracking-tighter">6 {t('settings_languages')}</span>
              <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-full uppercase tracking-tighter">v2.0.0</span>
            </div>
          </div>
          {[t('settings_privacy'), t('settings_terms')].map(link => (
            <a key={link} href="#"
              className="bg-surface-container-lowest border border-outline-variant/15 p-5 rounded-2xl flex items-center justify-between group hover:bg-surface-container-low transition-colors">
              <span className="text-sm font-semibold text-on-surface">{link}</span>
              <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">arrow_forward</span>
            </a>
          ))}
        </section>

        {/* Logout */}
        <div className="pt-4 px-2">
          <button onClick={logout}
            className="w-full border-2 border-error/20 text-error font-headline font-bold py-4 rounded-xl active:bg-error/5 transition-colors flex items-center justify-center gap-2">
            <span className="material-symbols-outlined">logout</span>
            {t('settings_logout')}
          </button>
        </div>

      </main>
    </div>
  )
}