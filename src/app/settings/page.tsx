'use client'

import { useState, useEffect } from 'react'
import { useShop } from '@/hooks/useShop'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const { shop, loading, updateShop, logout } = useShop()
  const auth    = useAuth()
  const router  = useRouter()
  const [shopName,  setShopName]  = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone,     setPhone]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  // If shop already has custom details, skip setup and go home
  useEffect(() => {
    if (!loading && shop) {
      const hasCustomName = shop.shop_name !== 'Meri Dukaan' && shop.shop_name !== ''
      const hasCustomOwner = shop.owner_name !== 'Dukandaar' && shop.owner_name !== ''
      if (hasCustomName && hasCustomOwner) {
        router.replace('/')
      }
    }
  }, [loading, shop, router])

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
    // After saving setup, go home
    setTimeout(() => router.push('/'), 800)
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
            <h1 className="text-white md:text-on-surface font-headline font-bold text-xl tracking-tight">Settings</h1>
            <p className="text-indigo-200 md:text-on-surface-variant text-sm font-medium">Apni dukaan ki details</p>
          </div>
          <div className="w-10 h-10 rounded-full md:hidden overflow-hidden border-2 border-white/20">
            {auth?.avatarUrl ? (
              <img src={auth.avatarUrl} alt={auth.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-indigo-500 flex items-center justify-center
                text-white font-headline font-bold text-sm">
                {auth?.name?.[0]?.toUpperCase() ?? 'D'}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 mt-8 space-y-6">

        {/* Shop details card */}
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-primary/10 p-2 rounded-full">
              <span className="material-symbols-outlined text-primary">storefront</span>
            </div>
            <h2 className="font-headline font-bold text-on-surface">Dukaan ki Profile</h2>
          </div>

          <div className="space-y-5">
            <div>
              <label className="font-label text-[10px] font-bold text-outline tracking-wider uppercase block mb-1.5 px-1">
                Dukaan ka Naam
              </label>
              <input
                type="text"
                value={shopName}
                onChange={e => setShopName(e.target.value)}
                placeholder="Sharma General Store"
                className="w-full bg-surface-container-low rounded-xl py-3.5 px-4
                  outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest
                  text-on-surface font-medium transition-all"
              />
            </div>

            <div>
              <label className="font-label text-[10px] font-bold text-outline tracking-wider uppercase block mb-1.5 px-1">
                Aapka Naam
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
                placeholder="Ramesh Sharma"
                className="w-full bg-surface-container-low rounded-xl py-3.5 px-4
                  outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest
                  text-on-surface font-medium transition-all"
              />
            </div>

            <div>
              <label className="font-label text-[10px] font-bold text-outline tracking-wider uppercase block mb-1.5 px-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full bg-surface-container-low rounded-xl py-3.5 px-4
                  outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest
                  text-on-surface font-medium transition-all"
              />
            </div>

            <div className="opacity-70 mt-6">
              <label className="font-label text-[10px] font-bold text-outline tracking-wider uppercase block mb-1.5 px-1">
                Account Email
              </label>
              <div className="flex items-center bg-surface-container-low rounded-xl py-3.5 px-4">
                <span className="text-on-surface font-medium truncate">{auth?.email ?? 'Not linked'}</span>
                <span className="material-symbols-outlined text-sm ml-auto text-outline shrink-0">lock</span>
              </div>
              <p className="text-xs text-outline mt-1 px-1">Google login se juda hua hai. Badla nahi ja sakta.</p>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-primary text-white py-4 rounded-xl font-headline font-bold
                text-sm tracking-wide disabled:opacity-50 active:scale-95 transition-transform mt-4"
              style={{ boxShadow: '0 8px 20px rgba(42,20,180,0.25)' }}
            >
              {saving ? 'Save ho raha hai...' : saved ? 'Saved ✓' : 'Save karo'}
            </button>
          </div>
        </section>

        {/* App info bento */}
        <section className="grid grid-cols-2 gap-4">
          <div className="col-span-2 bg-surface-container-low rounded-2xl p-5">
            <h3 className="font-headline font-bold text-on-surface mb-1">VedaVoice-NER</h3>
            <p className="text-xs text-on-surface-variant">The AI Model powering your ledger</p>
            <div className="mt-4 flex items-center gap-2">
              <span className="px-3 py-1 bg-tertiary/10 text-tertiary text-[10px] font-bold rounded-full uppercase tracking-tighter">
                Hinglish Supported
              </span>
              <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-full uppercase tracking-tighter">
                v1.0.0
              </span>
            </div>
          </div>

          {[
            { label: 'Privacy Policy' },
            { label: 'Terms of Service' },
          ].map(link => (
            <a
              key={link.label}
              href="#"
              className="bg-surface-container-lowest border border-outline-variant/15 p-5 rounded-2xl
                flex items-center justify-between group hover:bg-surface-container-low transition-colors"
            >
              <span className="text-sm font-semibold text-on-surface">{link.label}</span>
              <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">
                arrow_forward
              </span>
            </a>
          ))}
        </section>

        {/* Logout */}
        <div className="pt-4 px-2">
          <button
            onClick={logout}
            className="w-full border-2 border-error/20 text-error font-headline font-bold py-4
              rounded-xl active:bg-error/5 transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">logout</span>
            Logout
          </button>
        </div>

      </main>
    </div>
  )
}