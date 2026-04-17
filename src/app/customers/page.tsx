'use client'

import { useState } from 'react'
import { useCustomers } from '@/hooks/useCustomers'
import { useAuth } from '@/hooks/useAuth'
import { Customer } from '@/types'

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Aaj'
  if (days === 1) return 'Kal'
  return `${days} din pehle`
}

export default function CustomersPage() {
  const { customers, loading } = useCustomers()
  const auth = useAuth()
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState<Customer | null>(null)

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalPending = customers
    .filter(c => c.net_balance > 0)
    .reduce((s, c) => s + c.net_balance, 0)

  return (
    <div className="min-h-screen bg-background pb-24">

      {/* Header */}
      <header className="bg-indigo-700 md:bg-transparent sticky md:relative top-0 z-40 shadow-lg md:shadow-none shadow-indigo-900/20">
        <div className="flex justify-between items-center px-6 md:px-8 py-4">
          <div className="flex items-center gap-3">
            {auth?.avatarUrl ? (
              <img src={auth.avatarUrl} alt={auth.name}
                className="w-10 h-10 md:hidden rounded-full object-cover border-2 border-indigo-400" />
            ) : (
              <div className="w-10 h-10 md:hidden rounded-full bg-indigo-500 border-2 border-indigo-400
                flex items-center justify-center text-white font-headline font-bold text-sm">
                {auth?.name?.[0]?.toUpperCase() ?? 'D'}
              </div>
            )}
            <div>
              <h1 className="font-headline font-bold text-xl text-white md:text-on-surface">Customers</h1>
              <p className="text-indigo-200 md:text-on-surface-variant text-xs">
                {customers.length} log • ₹{totalPending.toLocaleString('en-IN')} pending
              </p>
            </div>
          </div>
          <button className="text-indigo-200 md:text-outline hover:bg-indigo-600/50 md:hover:bg-surface-container-low p-2 rounded-full">
            <span className="material-symbols-outlined">notifications</span>
          </button>
        </div>
      </header>

      <main className="px-6 py-6 max-w-2xl mx-auto">

        {/* Search */}
        <div className="relative mb-8">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-outline">
            <span className="material-symbols-outlined">search</span>
          </div>
          <input
            type="text"
            placeholder="Search customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-surface-container-low rounded-2xl py-4 pl-12 pr-4
              outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest
              text-on-surface placeholder:text-outline/60 transition-all"
          />
        </div>

        {/* List */}
        <div className="space-y-6">
          <h2 className="font-label font-bold text-sm uppercase tracking-widest text-outline px-1">
            Recent Activity
          </h2>
          {loading ? (
            <div className="space-y-6">
              {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-surface-container animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-surface-container animate-pulse rounded-full w-1/2" />
                    <div className="h-3 bg-surface-container animate-pulse rounded-full w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center mt-16">
              <span className="material-symbols-outlined text-5xl text-outline opacity-30 block mb-3">group</span>
              <p className="text-on-surface-variant text-sm">Koi customer nahi mila</p>
            </div>
          ) : (
            filtered.map(c => (
              <button
                key={c.name}
                onClick={() => setSelected(c)}
                className="w-full flex items-center justify-between text-left active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center
                    font-headline font-bold text-xl shrink-0
                    ${c.net_balance > 0 ? 'bg-error/10 text-error' : 'bg-[#e6f4ea] text-tertiary'}`}>
                    {initials(c.name)}
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-lg text-on-surface">{c.name}</h3>
                    <p className="text-outline text-sm">{c.txn_count} transactions • {timeAgo(c.last_txn)}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  {c.net_balance > 0 ? (
                    <>
                      <p className="font-headline font-bold text-lg text-error">₹{c.net_balance.toLocaleString('en-IN')}</p>
                      <span className="text-[10px] uppercase tracking-tighter text-error/60 font-bold">Udhaar</span>
                    </>
                  ) : (
                    <>
                      <p className="font-headline font-bold text-lg text-tertiary">Clear</p>
                      <span className="text-[10px] uppercase tracking-tighter text-tertiary/60 font-bold">Pura Paid</span>
                    </>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </main>

      {/* Floating mic */}
      <div className="fixed bottom-28 right-6 z-40">
        <button className="w-16 h-16 rounded-full mic-gradient flex items-center justify-center
          text-white active:scale-90 transition-transform"
          style={{ boxShadow: '0 20px 40px rgba(42,20,180,0.25)' }}>
          <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
        </button>
      </div>

      {/* Customer bottom sheet */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-end justify-center"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-3xl p-8 relative shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-surface-container-high rounded-full" />

            <div className="mt-4 flex flex-col items-center">
              {/* Avatar */}
              <div className={`w-24 h-24 rounded-full flex items-center justify-center
                font-headline font-bold text-4xl mb-4 border-4 border-white shadow-xl
                ${selected.net_balance > 0 ? 'bg-error/10 text-error' : 'bg-[#e6f4ea] text-tertiary'}`}>
                {initials(selected.name)}
              </div>
              <h2 className="font-headline font-extrabold text-2xl text-on-surface mb-6">{selected.name}</h2>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 w-full mb-8">
                <div className="bg-surface-container-low p-4 rounded-2xl text-center">
                  <span className="text-[10px] uppercase font-bold text-outline block mb-1">Udhaar</span>
                  <p className="font-headline font-bold text-error">₹{selected.total_udhaar.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl text-center">
                  <span className="text-[10px] uppercase font-bold text-outline block mb-1">Payment</span>
                  <p className="font-headline font-bold text-tertiary">₹{selected.total_payment.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-primary p-4 rounded-2xl text-center">
                  <span className="text-[10px] uppercase font-bold text-on-primary/60 block mb-1">Baaki</span>
                  <p className="font-headline font-bold text-white">₹{selected.net_balance.toLocaleString('en-IN')}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="w-full space-y-4">
                {selected.net_balance > 0 && (
                  <>
                    <button
                      onClick={() => {
                        const msg = encodeURIComponent(
                          `Namaste ${selected.name} ji, aapka ₹${selected.net_balance.toLocaleString('en-IN')} ka udhaar pending hai. Kripya payment karein. - Parchi`
                        )
                        window.open(`https://wa.me/?text=${msg}`, '_blank')
                      }}
                      className="w-full bg-[#25D366] text-white py-5 rounded-2xl flex items-center
                        justify-center gap-3 font-headline font-bold active:scale-95 transition-transform"
                      style={{ boxShadow: '0 8px 20px rgba(37,211,102,0.3)' }}
                    >
                      <span className="material-symbols-outlined">chat</span>
                      WhatsApp Reminder Bhejo
                    </button>
                    <div className="bg-surface-container-low p-4 rounded-2xl italic text-sm text-on-surface-variant text-center leading-relaxed">
                      "{selected.name} ji, aapka ₹{selected.net_balance.toLocaleString('en-IN')} ka hisaab baaki hai. Kripya payment karein."
                    </div>
                  </>
                )}
                <button
                  onClick={() => setSelected(null)}
                  className="w-full text-outline font-headline font-bold text-sm uppercase tracking-widest py-3 hover:text-on-surface transition-colors"
                >
                  Band karo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}