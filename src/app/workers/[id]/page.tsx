'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Worker, Transaction } from '@/types'
import VerificationBadge from '@/components/VerificationBadge'

interface AttendanceRecord {
  id: string
  worker_id: string
  date: string
  status: 'present' | 'half' | 'absent'
  marked_via: string
}

interface WeekGroup {
  weekLabel: string
  weekStart: Date
  weekEnd: Date
  days: AttendanceRecord[]
  gross: number
  advances: number
  payments: number
  baki: number
}

const SKILL_OPTIONS = [
  'Mazdoor (Labour)', 'Raj Mistri (Mason)', 'Plumber (Nal Mistri)',
  'Electrician (Bijli Mistri)', 'Badhai (Carpenter)', 'Rang Mistri (Painter)',
  'Lohar (Welder)', 'Sariya Wala (Bar Bender)', 'Mukadam (Supervisor)', 'Chowkidar (Watchman)',
]

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
function fmtDate(d: Date) {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDay(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}
function getWeekStart(d: Date) {
  const copy = new Date(d)
  copy.setDate(d.getDate() - d.getDay())
  copy.setHours(0, 0, 0, 0)
  return copy
}

export default function WorkerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const auth = useAuth()
  const router = useRouter()

  const [worker, setWorker] = useState<Worker | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  // ── Edit state ────────────────────────────────────────────────────────────
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', phone: '', daily_rate: '', qualifier: '' })
  const [saving, setSaving] = useState(false)

  // ── Delete state ──────────────────────────────────────────────────────────
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!auth?.id || !id) return
    const load = async () => {
      const [{ data: wk }, { data: att }, { data: txn }] = await Promise.all([
        supabase.from('workers').select('*').eq('id', id).single(),
        supabase.from('attendance').select('*').eq('worker_id', id).order('date', { ascending: true }),
        supabase.from('transactions').select('*').eq('user_id', auth.id).order('created_at', { ascending: true }),
      ])
      if (wk) {
        setWorker(wk)
        setEditForm({ name: wk.name, phone: wk.phone || '', daily_rate: String(wk.daily_rate || ''), qualifier: wk.qualifier || '' })
      }
      if (att) setAttendance(att)
      if (txn) {
        setTransactions(txn.filter((t: Transaction) => {
          if (t.worker_id) return String(t.worker_id).trim() === String(id).trim()
          return t.name?.toLowerCase().trim() === wk?.name?.toLowerCase().trim()
        }))
      }
      setLoading(false)
    }
    load()

    // Real-time sync for this worker's trust loop
    const channel = supabase
      .channel(`worker-${id}-txns`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${auth.id}` },
        () => { load(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel) }
  }, [auth?.id, id])

  const handleSaveEdit = async () => {
    if (!worker || !editForm.name.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('workers').update({
      name: editForm.name.trim(),
      phone: editForm.phone.trim() || null,
      daily_rate: parseFloat(editForm.daily_rate) || null,
      qualifier: editForm.qualifier || null,
    }).eq('id', worker.id).select().single()
    if (!error && data) {
      setWorker(data)
      setShowEdit(false)
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!worker) return
    setDeleting(true)
    // Delete attendance + transactions first to avoid FK issues
    await Promise.all([
      supabase.from('attendance').delete().eq('worker_id', worker.id),
      supabase.from('transactions').delete().eq('worker_id', worker.id),
    ])
    await supabase.from('workers').delete().eq('id', worker.id)
    router.replace('/workers')
  }

  // ── Weekly groups ─────────────────────────────────────────────────────────
  const weekGroups: WeekGroup[] = useMemo(() => {
    if (!worker) return []
    const rate = worker.daily_rate || 0
    const map = new Map<string, WeekGroup>()

    attendance.forEach(a => {
      const ws = getWeekStart(new Date(a.date))
      const we = new Date(ws); we.setDate(ws.getDate() + 6)
      const key = ws.toISOString()
      if (!map.has(key)) map.set(key, { weekLabel: `${fmtDate(ws)} – ${fmtDate(we)}`, weekStart: ws, weekEnd: we, days: [], gross: 0, advances: 0, payments: 0, baki: 0 })
      const g = map.get(key)!
      g.days.push(a)
      g.gross += rate * (a.status === 'present' ? 1 : a.status === 'half' ? 0.5 : 0)
    })

    transactions.forEach(t => {
      const ws = getWeekStart(new Date(t.created_at))
      const key = ws.toISOString()
      if (!map.has(key)) { const we = new Date(ws); we.setDate(ws.getDate() + 6); map.set(key, { weekLabel: `${fmtDate(ws)} – ${fmtDate(we)}`, weekStart: ws, weekEnd: we, days: [], gross: 0, advances: 0, payments: 0, baki: 0 }) }
      const g = map.get(key)!
      if (t.action === 'ADVANCE' || t.action === 'UDHAAR') g.advances += t.amount
      if (t.action === 'PAYMENT') g.payments += t.amount
    })

    const sorted = [...map.values()].sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
    let running = 0
    sorted.forEach(g => { running += g.gross - g.advances - g.payments; g.baki = running })
    return sorted
  }, [worker, attendance, transactions])

  // ── Lifetime totals ───────────────────────────────────────────────────────
  const lifetime = useMemo(() => {
    if (!worker) return { gross: 0, advances: 0, payments: 0, baki: 0 }
    const rate = worker.daily_rate || 0
    const gross = attendance.reduce((s, a) => s + rate * (a.status === 'present' ? 1 : a.status === 'half' ? 0.5 : 0), 0)
    const advances = transactions.filter(t => t.action === 'ADVANCE' || t.action === 'UDHAAR').reduce((s, t) => s + t.amount, 0)
    const payments = transactions.filter(t => t.action === 'PAYMENT').reduce((s, t) => s + t.amount, 0)
    return { gross, advances, payments, baki: gross - advances - payments }
  }, [worker, attendance, transactions])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-primary/10 animate-pulse mx-auto" />
        <p className="text-outline text-sm">Loading worker data...</p>
      </div>
    </div>
  )

  if (!worker) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-outline">Worker not found.</p>
    </div>
  )

  const isInDebt = lifetime.baki < 0

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-only { display: block !important; }
          .week-card { break-inside: avoid; page-break-inside: avoid; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="min-h-screen bg-background pb-24">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="bg-indigo-700 text-white no-print">
          <div className="flex items-center gap-3 px-4 py-4">
            <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors shrink-0">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-11 h-11 rounded-full bg-indigo-500 border-2 border-indigo-300 flex items-center justify-center font-headline font-bold text-base shrink-0">
                {initials(worker.name)}
              </div>
              <div className="min-w-0">
                <h1 className="font-headline font-bold text-lg truncate">{worker.name}</h1>
                <p className="text-indigo-200 text-xs">₹{(worker.daily_rate || 0).toLocaleString('en-IN')} / din</p>
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setShowEdit(true)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors" title="Edit">
                <span className="material-symbols-outlined text-sm">edit</span>
              </button>
              <button onClick={() => setShowDelete(true)} className="w-9 h-9 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-colors" title="Delete">
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
              <button onClick={() => window.print()} className="flex items-center gap-1.5 bg-white text-primary px-3 py-2 rounded-xl font-headline font-bold text-xs uppercase tracking-widest shadow-lg hover:shadow-xl active:scale-95 transition-all">
                <span className="material-symbols-outlined text-sm">print</span>
                Invoice
              </button>
            </div>
          </div>
        </header>

        {/* ── Print Header (hidden on screen) ─────────────────────────── */}
        <div className="print-only px-8 pt-8 pb-4 border-b-2 border-gray-800">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">MAZDOOR HISAAB RECEIPT</h1>
              <p className="text-gray-500 text-sm mt-1">Weekly Labour Payment Record</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-xs">Generated: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-8">
            <div>
              <p className="text-xs text-gray-400 uppercase font-bold">Worker Name</p>
              <p className="text-xl font-bold text-gray-900">{worker.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-bold">Daily Rate</p>
              <p className="text-xl font-bold text-gray-900">₹{(worker.daily_rate || 0).toLocaleString('en-IN')}</p>
            </div>
            {worker.phone && (
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold">Phone</p>
                <p className="text-xl font-bold text-gray-900">{worker.phone}</p>
              </div>
            )}
          </div>
        </div>

        <main className="px-4 md:px-8 max-w-4xl mx-auto space-y-6 mt-6">
          {/* ── Lifetime Summary Bento ──────────────────────────────────── */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Kul Kamai', value: lifetime.gross, color: 'text-on-surface', bg: 'bg-surface-container-lowest', icon: 'work' },
              { label: 'Total Advance', value: lifetime.advances, color: 'text-amber-600', bg: 'bg-amber-50', icon: 'payments' },
              { label: 'Bhugtan (Paid)', value: lifetime.payments, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: 'check_circle' },
              { label: isInDebt ? 'Wapas Lena' : 'Dena Baki', value: Math.abs(lifetime.baki), color: isInDebt ? 'text-error' : 'text-primary', bg: isInDebt ? 'bg-error-container' : 'bg-primary/5', icon: isInDebt ? 'warning' : 'account_balance_wallet' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-2xl p-4 shadow-sm border border-outline-variant/20`}>
                <span className="material-symbols-outlined text-sm opacity-40 block mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                <p className="text-outline font-label text-[10px] uppercase tracking-wider font-bold">{s.label}</p>
                <p className={`text-xl font-headline font-extrabold mt-0.5 tracking-tight ${s.color}`}>₹{s.value.toLocaleString('en-IN')}</p>
              </div>
            ))}
          </section>

          {/* ── Weekly Breakdown ────────────────────────────────────────── */}
          {weekGroups.length === 0 ? (
            <div className="text-center py-20">
              <span className="material-symbols-outlined text-5xl text-outline/20 block mb-3">calendar_month</span>
              <p className="text-on-surface-variant text-sm">Koi attendance record nahi mila</p>
            </div>
          ) : (
            <div className="space-y-6">
              {weekGroups.map((wg, i) => {
                const isBakiPositive = wg.baki >= 0
                return (
                  <div key={i} className="week-card bg-white rounded-3xl shadow-sm border border-outline-variant/20 overflow-hidden">
                    {/* Week Header */}
                    <div className="bg-indigo-50 px-6 py-4 flex justify-between items-center border-b border-indigo-100">
                      <div>
                        <p className="font-headline font-bold text-on-surface text-sm">Hafte ka Hisaab</p>
                        <p className="text-outline text-xs mt-0.5">{wg.weekLabel}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-outline uppercase font-bold tracking-wider">Running Baki</p>
                        <p className={`text-lg font-headline font-extrabold ${isBakiPositive ? 'text-primary' : 'text-error'}`}>
                          {isBakiPositive ? '' : '−'}₹{Math.abs(wg.baki).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>

                    {/* Attendance Days */}
                    {wg.days.length > 0 && (
                      <div className="px-6 py-4 border-b border-outline-variant/10">
                        <p className="text-[10px] text-outline uppercase font-bold tracking-wider mb-3">Hajiri (Din)</p>
                        <div className="space-y-2">
                          {wg.days.map(a => {
                            const rate = worker.daily_rate || 0
                            const m = a.status === 'present' ? 1 : a.status === 'half' ? 0.5 : 0
                            const wage = rate * m
                            return (
                              <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-dashed border-outline-variant/20 last:border-0">
                                <div className="flex items-center gap-3">
                                  <div className={`w-2 h-2 rounded-full ${
                                    a.status === 'present' ? 'bg-emerald-500' :
                                    a.status === 'half' ? 'bg-amber-400' : 'bg-red-400'
                                  }`} />
                                  <span className="text-sm text-on-surface font-medium">{fmtDay(a.date)}</span>
                                  <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider ${
                                    a.status === 'present' ? 'bg-emerald-50 text-emerald-700' :
                                    a.status === 'half' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-500'
                                  }`}>
                                    {a.status === 'present' ? 'Poora Din' : a.status === 'half' ? 'Half Day' : 'Absent'}
                                  </span>
                                </div>
                                <span className="text-sm font-bold text-on-surface">
                                  {wage > 0 ? `₹${wage.toLocaleString('en-IN')}` : '—'}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                        <div className="flex justify-between mt-3 pt-2 border-t border-outline-variant/20">
                          <span className="text-xs text-outline font-bold uppercase tracking-wider">Is Hafte ki Kamai</span>
                          <span className="text-sm font-extrabold text-on-surface">₹{wg.gross.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    )}

                    {/* Transactions this week */}
                    {(() => {
                      const weekTxns = transactions.filter(t => {
                        const d = new Date(t.created_at)
                        return d >= wg.weekStart && d <= wg.weekEnd
                      })
                      if (weekTxns.length === 0) return null
                      return (
                        <div className="px-6 py-4 border-b border-outline-variant/10">
                          <p className="text-[10px] text-outline uppercase font-bold tracking-wider mb-3">Transactions</p>
                          <div className="space-y-2">
                            {weekTxns.map(t => {
                              const isAdv = t.action === 'ADVANCE' || t.action === 'UDHAAR'
                              return (
                                <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-dashed border-outline-variant/20 last:border-0">
                                  <div className="flex items-center gap-3">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isAdv ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                      {isAdv ? 'A' : 'P'}
                                    </span>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs font-bold text-on-surface">{isAdv ? 'Advance Diya' : 'Payment Kiya'}</p>
                                        <VerificationBadge status={t.verification_status} size="sm" />
                                      </div>
                                      <p className="text-[10px] text-outline truncate max-w-[160px]">"{t.transcript}"</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className={`text-sm font-extrabold ${isAdv ? 'text-amber-600' : 'text-emerald-600'}`}>
                                      {isAdv ? '−' : '+'}₹{t.amount.toLocaleString('en-IN')}
                                    </span>
                                    <p className="text-[10px] text-outline">{new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Week Summary Footer */}
                    <div className="px-6 py-3 bg-gray-50/50 grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-[9px] text-outline uppercase font-bold tracking-wider">Kamai</p>
                        <p className="text-xs font-extrabold text-on-surface">₹{wg.gross.toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-outline uppercase font-bold tracking-wider">Advance + Paid</p>
                        <p className="text-xs font-extrabold text-amber-600">₹{(wg.advances + wg.payments).toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-outline uppercase font-bold tracking-wider">{isBakiPositive ? 'Dena Baki' : 'Zyada Diya'}</p>
                        <p className={`text-xs font-extrabold ${isBakiPositive ? 'text-primary' : 'text-error'}`}>
                          {isBakiPositive ? '' : '−'}₹{Math.abs(wg.baki).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Print Footer ─────────────────────────────────────────────── */}
          <div className="print-only mt-8 pt-6 border-t-2 border-gray-300">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold">Worker Signature</p>
                <div className="mt-8 border-b border-gray-400 w-48" />
                <p className="text-xs text-gray-400 mt-1">{worker.name}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase font-bold">Supervisor Signature</p>
                <div className="mt-8 border-b border-gray-400 w-48 ml-auto" />
                <p className="text-xs text-gray-400 mt-1">Site Manager</p>
              </div>
            </div>
            <p className="text-center text-xs text-gray-300 mt-8">Generated by VedaVoice Labour Ledger</p>
          </div>
        </main>
      </div>

      {/* ── Edit Worker Modal ───────────────────────────────────────────── */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center no-print">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowEdit(false)} />
          <div className="relative bg-white rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:max-w-md max-h-[90vh] overflow-y-auto z-10">
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full bg-outline-variant" />
            </div>
            <div className="px-6 pt-4 pb-8 space-y-5">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-headline font-bold text-xl text-on-surface">Details Edit Karo</h2>
                  <p className="text-outline text-xs mt-0.5">{worker.name} ki jankari update karo</p>
                </div>
                <button onClick={() => setShowEdit(false)} className="w-9 h-9 rounded-full hover:bg-surface-container flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-outline">close</span>
                </button>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-outline uppercase tracking-widest">Naam *</label>
                <input
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-outline-variant/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 bg-surface-container-lowest"
                  placeholder="Worker ka naam"
                />
              </div>

              {/* Daily Rate */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-outline uppercase tracking-widest">Daily Rate (₹)</label>
                <input
                  type="number"
                  value={editForm.daily_rate}
                  onChange={e => setEditForm(f => ({ ...f, daily_rate: e.target.value }))}
                  className="w-full border border-outline-variant/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 bg-surface-container-lowest"
                  placeholder="500"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-outline uppercase tracking-widest">Phone</label>
                <input
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-outline-variant/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 bg-surface-container-lowest"
                  placeholder="9876543210"
                />
              </div>

              {/* Skill */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-outline uppercase tracking-widest">Kaam ka Prakar</label>
                <select
                  value={editForm.qualifier}
                  onChange={e => setEditForm(f => ({ ...f, qualifier: e.target.value }))}
                  className="w-full border border-outline-variant/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 bg-surface-container-lowest"
                >
                  <option value="">Select skill...</option>
                  {SKILL_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <button
                onClick={handleSaveEdit}
                disabled={saving || !editForm.name.trim()}
                className="w-full bg-primary text-white font-headline font-bold py-4 rounded-2xl disabled:opacity-50 active:scale-95 transition-transform"
                style={{ boxShadow: '0 8px 20px rgba(67,56,202,0.3)' }}
              >
                {saving ? 'Save ho raha hai...' : '✅ Changes Save Karo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ─────────────────────────────────────────── */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 no-print">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDelete(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm z-10 p-6 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-red-500" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            </div>
            <h2 className="font-headline font-bold text-xl text-on-surface">Worker Delete Karo?</h2>
            <p className="text-outline text-sm mt-2">
              <span className="font-bold text-on-surface">{worker.name}</span> ki saari hajiri aur transactions bhi delete ho jayengi. Yeh action undo nahi ho sakta.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDelete(false)}
                className="flex-1 py-3 rounded-2xl border border-outline-variant/40 font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                {deleting ? 'Deleting...' : 'Haan, Delete Karo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
