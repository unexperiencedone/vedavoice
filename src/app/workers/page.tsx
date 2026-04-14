'use client'

import { useMemo, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useLedger } from '@/hooks/useLedger'
import { useWorkers, WorkerSummary } from '@/hooks/useWorkers'
import { supabase } from '@/lib/supabase'

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'Abhi'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const SKILL_OPTIONS = [
  'Mazdoor / Labour',
  'Raj Mistri / Mason',
  'Plumber / Nal Mistri',
  'Electrician / Bijli Mistri',
  'Carpenter / Badhai',
  'Painter / Rang Mistri',
  'Welder / Lohar',
  'Bar Bender / Sariya Wala',
  'Tile Fixer / Tiling Mistri',
  'Scaffolding Worker / Baans Wala',
  'Driver / Chalak',
  'Crane Operator / Crane Wala',
  'Supervisor / Mukadam',
  'Watchman / Chowkidar',
  'Cook / Bawarchi',
]

interface AddWorkerForm {
  name: string
  qualifier: string
  daily_rate: string
  phone: string
  skill: string
}

const EMPTY_FORM: AddWorkerForm = { name: '', qualifier: '', daily_rate: '', phone: '', skill: '' }

export default function WorkersPage() {
  const auth = useAuth()
  const ledger = useLedger()
  const { workers, getWorkerSummaries, loading, refresh } = useWorkers(auth?.id)

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<AddWorkerForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const summaries: WorkerSummary[] = useMemo(
    () => getWorkerSummaries(ledger.transactions),
    [getWorkerSummaries, ledger.transactions]
  )

  const totalOwedByContractor = summaries.filter(s => s.wagesDue > 0).reduce((sum, s) => sum + s.wagesDue, 0)
  const totalAdvancesGiven = summaries.reduce((sum, s) => sum + s.totalAdvances, 0)

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) { setSaveError('Naam zaroori hai'); return }
    if (!form.daily_rate || isNaN(Number(form.daily_rate))) { setSaveError('Daily rate sahi number hona chahiye'); return }
    if (!auth?.id) { setSaveError('Login nahi hua'); return }

    setSaving(true); setSaveError('')
    const qualifierFinal = [form.qualifier.trim(), form.skill.trim()].filter(Boolean).join(' · ') || null

    const { error } = await supabase.from('workers').insert({
      user_id: auth.id,
      name: form.name.trim(),
      qualifier: qualifierFinal,
      daily_rate: Number(form.daily_rate),
      phone: form.phone.trim() || null,
    })

    setSaving(false)
    if (error) { setSaveError(error.message); return }

    setForm(EMPTY_FORM)
    setShowAdd(false)
    refresh()
  }, [form, auth?.id, refresh])

  const Field = ({ label, id, ...props }: { label: string, id: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label htmlFor={id} className="font-label text-[10px] font-bold text-outline tracking-wider uppercase block mb-1.5 px-1">
        {label}
      </label>
      <input
        id={id}
        className="w-full bg-surface-container-low rounded-xl py-3.5 px-4 text-on-surface font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline/50"
        {...props}
      />
    </div>
  )

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-indigo-700 md:bg-transparent sticky md:relative top-0 z-40 shadow-lg md:shadow-none shadow-indigo-900/20">
        <div className="flex justify-between items-center px-6 md:px-8 py-4">
          <div className="flex items-center gap-3">
            {auth?.avatarUrl ? (
              <img src={auth.avatarUrl} alt={auth.name} className="w-10 h-10 md:hidden rounded-full object-cover border-2 border-indigo-400" />
            ) : (
              <div className="w-10 h-10 md:hidden rounded-full bg-indigo-500 border-2 border-indigo-400 flex items-center justify-center text-white font-headline font-bold text-sm">
                {auth?.name?.[0]?.toUpperCase() ?? 'T'}
              </div>
            )}
            <div>
              <h1 className="font-headline font-bold text-xl text-white md:text-on-surface">Mazdoor (Payroll)</h1>
              <p className="text-indigo-200 md:text-on-surface-variant text-xs">{workers.length} mazdoor registered</p>
            </div>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-white/20 md:bg-primary hover:bg-white/30 md:hover:bg-primary/90 text-white px-4 py-2 rounded-full font-label font-bold text-[11px] uppercase tracking-wide transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>person_add</span>
            Naya Mazdoor
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-3 px-6 md:px-8 pb-5">
          <div className="bg-white/10 md:bg-surface-container-lowest backdrop-blur-md rounded-xl p-4 border border-white/10 md:border-outline-variant/20 md:shadow-sm">
            <span className="text-indigo-100 md:text-outline font-label text-[10px] uppercase tracking-wider font-bold block">Paisa Dena Hai (Wages)</span>
            <span className="text-white md:text-error text-2xl font-headline font-extrabold mt-1 block">₹{totalOwedByContractor.toLocaleString('en-IN')}</span>
          </div>
          <div className="bg-white/10 md:bg-surface-container-lowest backdrop-blur-md rounded-xl p-4 border border-white/10 md:border-outline-variant/20 md:shadow-sm">
            <span className="text-indigo-100 md:text-outline font-label text-[10px] uppercase tracking-wider font-bold block">Advance Diya</span>
            <span className="text-white md:text-on-surface text-2xl font-headline font-extrabold mt-1 block">₹{totalAdvancesGiven.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </header>

      <main className="px-6 max-w-2xl mx-auto mt-6">
        {loading || ledger.loading ? (
          <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-28 bg-surface-container animate-pulse rounded-2xl" />)}</div>
        ) : summaries.length === 0 ? (
          <div className="text-center mt-16">
            <span className="material-symbols-outlined text-5xl text-outline opacity-30 block mb-3">engineering</span>
            <p className="text-on-surface-variant text-sm font-medium">Koi mazdoor nahi hai abhi</p>
            <p className="text-outline text-xs mt-1">Upar "Naya Mazdoor" button dabaao</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {summaries.map(summary => <WorkerCard key={summary.worker.id} s={summary} />)}
          </div>
        )}
      </main>

      {/* Add Worker Bottom Sheet */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAdd(false)} />

          {/* Sheet */}
          <div className="relative bg-white rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:max-w-lg max-h-[90vh] overflow-y-auto z-10">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full bg-outline-variant" />
            </div>

            <div className="px-6 pt-4 pb-8 space-y-5">
              {/* Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-headline font-bold text-xl text-on-surface">Naya Mazdoor</h2>
                  <p className="text-outline text-xs mt-0.5">Apne worker ki details bharo</p>
                </div>
                <button onClick={() => setShowAdd(false)} className="w-9 h-9 rounded-full hover:bg-surface-container flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-outline">close</span>
                </button>
              </div>

              {/* Name */}
              <Field id="w-name" label="Naam *" placeholder="Raju, Ramesh, Suresh..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

              {/* Qualifier */}
              <Field id="w-qualifier" label="Pehchaan (Qualifier)" placeholder="Chhota, Delhi wala, UP wala..." value={form.qualifier} onChange={e => setForm(f => ({ ...f, qualifier: e.target.value }))} />

              {/* Skill dropdown */}
              <div>
                <label className="font-label text-[10px] font-bold text-outline tracking-wider uppercase block mb-1.5 px-1">Kaam / Skill</label>
                <select
                  value={form.skill}
                  onChange={e => setForm(f => ({ ...f, skill: e.target.value }))}
                  className="w-full bg-surface-container-low rounded-xl py-3.5 px-4 text-on-surface font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                >
                  <option value="">-- Select skill --</option>
                  {SKILL_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Daily Rate */}
              <Field id="w-rate" label="Daily Rate (₹/din) *" type="number" placeholder="400" inputMode="numeric" value={form.daily_rate} onChange={e => setForm(f => ({ ...f, daily_rate: e.target.value }))} />

              {/* Phone */}
              <Field id="w-phone" label="Phone Number (optional)" type="tel" placeholder="+91 9876543210" inputMode="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />

              {saveError && <p className="text-red-500 text-sm px-1">{saveError}</p>}

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-indigo-600 text-white font-headline font-bold py-4 rounded-2xl disabled:opacity-50 active:scale-95 transition-transform mt-2"
                style={{ boxShadow: '0 8px 20px rgba(67,56,202,0.3)' }}
              >
                {saving ? 'Save ho raha hai...' : '✅ Mazdoor Register Karo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function WorkerCard({ s }: { s: WorkerSummary }) {
  const isOwed = s.wagesDue > 0
  const isOverpaid = s.wagesDue < 0

  return (
    <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        {/* Profile */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-primary font-headline font-bold text-lg shrink-0">
            {initials(s.worker.name)}
          </div>
          <div>
            <span className="font-headline font-bold text-lg text-on-surface leading-none">{s.worker.name}</span>
            {s.worker.qualifier && <span className="ml-1 text-sm font-medium text-outline">({s.worker.qualifier})</span>}
            <p className="text-xs text-outline mt-1 font-medium">
              {s.worker.daily_rate ? `₹${s.worker.daily_rate}/din` : 'Rate set nahi hai'}
              {s.lastSeen && ` • Last: ${timeAgo(s.lastSeen)}`}
            </p>
          </div>
        </div>

        {/* Net Dues */}
        <div className="text-right">
          <span className={`block font-headline font-black text-xl ${isOwed ? 'text-error' : isOverpaid ? 'text-tertiary' : 'text-on-surface-variant'}`}>
            {s.wagesDue > 0 ? `₹${s.wagesDue.toLocaleString('en-IN')}`
              : s.wagesDue < 0 ? `+₹${Math.abs(s.wagesDue).toLocaleString('en-IN')}`
              : '₹0'}
          </span>
          <span className="text-[10px] font-label font-bold text-outline uppercase tracking-wider">
            {isOwed ? 'Baaki (Owes)' : isOverpaid ? 'Extra Diya' : 'Clear'}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex bg-surface-container rounded-xl p-3 divide-x divide-outline-variant/30">
        <div className="flex-1 text-center">
          <span className="block text-[10px] font-label font-bold text-outline uppercase">Hajiri (Days)</span>
          <span className="block font-headline font-bold text-on-surface">{s.totalDays}</span>
        </div>
        <div className="flex-1 text-center">
          <span className="block text-[10px] font-label font-bold text-outline uppercase">Advance</span>
          <span className="block font-headline font-bold text-on-surface">₹{s.totalAdvances}</span>
        </div>
        <div className="flex-1 text-center">
          <span className="block text-[10px] font-label font-bold text-outline uppercase">Payment</span>
          <span className="block font-headline font-bold text-on-surface">₹{s.totalPayments}</span>
        </div>
      </div>
    </div>
  )
}

