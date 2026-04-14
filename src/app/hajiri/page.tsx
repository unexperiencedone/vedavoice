'use client'

import { useState, useRef, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAttendance, AttendanceStatus, WorkerAttendanceView } from '@/hooks/useAttendance'
import { Worker } from '@/types'

const todayLabel = () => {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
}

const STATUS_CONFIG = {
  present:  { label: 'Poora Din', icon: 'check_circle', color: 'bg-green-500 text-white',           light: 'bg-green-50 text-green-700 border-green-200' },
  half:     { label: 'Half Day',  icon: 'schedule',     color: 'bg-amber-500 text-white',           light: 'bg-amber-50 text-amber-700 border-amber-200' },
  absent:   { label: 'Absent',    icon: 'cancel',       color: 'bg-red-500 text-white',             light: 'bg-red-50 text-red-700 border-red-200' },
  unmarked: { label: 'Mark',      icon: 'help_outline', color: 'bg-surface-container text-outline', light: 'bg-surface-container text-outline border-outline-variant/30' },
}

interface Ambiguity {
  parsedName: string
  status: AttendanceStatus
  candidates: Worker[]
}

export default function HajiriPage() {
  const auth = useAuth()
  const { workerViews, loading, markAttendance, markAll, summary, todayWages } = useAttendance(auth?.id)

  const [isListening, setIsListening]       = useState(false)
  const [voiceFeedback, setVoiceFeedback]   = useState('')
  const [ambiguityQueue, setAmbiguityQueue] = useState<Ambiguity[]>([])
  const recognitionRef = useRef<any>(null)

  // Current ambiguity is always the first in queue
  const currentAmbiguity = ambiguityQueue[0] ?? null

  const resolveAmbiguity = useCallback(async (worker: Worker, status: AttendanceStatus) => {
    await markAttendance(worker.id, status, 'voice')
    setAmbiguityQueue(prev => prev.slice(1)) // pop resolved item
  }, [markAttendance])

  const skipAmbiguity = useCallback(() => {
    setAmbiguityQueue(prev => prev.slice(1))
  }, [])

  const startVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { setVoiceFeedback('Voice not supported in this browser'); return }

    const recognition = new SpeechRecognition()
    recognition.lang = 'hi-IN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => { setIsListening(true); setVoiceFeedback('') }
    recognition.onend   = () => setIsListening(false)

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript
      setVoiceFeedback(`Suna: "${transcript}" — Processing...`)

      try {
        const res = await fetch('/api/attendance/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: transcript,
            workers: workerViews.map(v => ({ name: v.worker.name, qualifier: v.worker.qualifier }))
          })
        })
        const data = await res.json()

        // "Sab present" / "koi nahi aaya" — bulk mark all
        if (data.all === true && data.status) {
          await markAll(data.status as AttendanceStatus)
          setVoiceFeedback(`✅ Sab workers ki hajiri "${data.status}" mark ho gayi`)
          setTimeout(() => setVoiceFeedback(''), 3000)
          return
        }

        const results: { name: string, status: AttendanceStatus }[] = data.results || []
        if (results.length === 0) {
          setVoiceFeedback('⚠️ Koi worker samajh nahi aaya, naam bol ke dobara try karo')
          setTimeout(() => setVoiceFeedback(''), 3000)
          return
        }

        const newAmbiguities: Ambiguity[] = []
        let marked = 0

        for (const parsed of results) {
          const normalize = (s: string) => s.toLowerCase().trim()
          const matches = workerViews.filter(v =>
            normalize(v.worker.name).includes(normalize(parsed.name)) ||
            normalize(parsed.name).includes(normalize(v.worker.name))
          )

          if (matches.length === 0) {
            // No match found — skip silently
          } else if (matches.length === 1) {
            // Exact single match — mark directly
            await markAttendance(matches[0].worker.id, parsed.status, 'voice')
            marked++
          } else {
            // Ambiguous — queue for disambiguation
            newAmbiguities.push({
              parsedName: parsed.name,
              status: parsed.status,
              candidates: matches.map(m => m.worker)
            })
          }
        }

        if (newAmbiguities.length > 0) {
          setAmbiguityQueue(prev => [...prev, ...newAmbiguities])
          setVoiceFeedback(marked > 0 ? `✅ ${marked} marked, ${newAmbiguities.length} need identification` : '')
        } else {
          setVoiceFeedback(`✅ ${marked} worker${marked !== 1 ? 's' : ''} ki hajiri mark ho gayi`)
          setTimeout(() => setVoiceFeedback(''), 3000)
        }
      } catch {
        setVoiceFeedback('⚠️ Kuch problem aayi, dobara try karo')
        setTimeout(() => setVoiceFeedback(''), 3000)
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [workerViews, markAttendance, markAll])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-background pb-28">

      {/* Header */}
      <header className="bg-indigo-700 sticky top-0 z-40 shadow-lg shadow-indigo-900/20">
        <div className="px-6 py-4">
          <h1 className="font-headline font-bold text-xl text-white">Aaj ki Hajiri</h1>
          <p className="text-indigo-200 text-xs mt-0.5">{todayLabel()}</p>
        </div>
        <div className="flex divide-x divide-indigo-500/30 bg-indigo-800/60 px-2">
          {[
            { label: 'Hazir',       value: summary.present,                       color: 'text-green-300' },
            { label: 'Half',        value: summary.half,                          color: 'text-amber-300' },
            { label: 'Absent',      value: summary.absent,                        color: 'text-red-300'   },
            { label: 'Aaj ki Kamai', value: `₹${todayWages.toLocaleString()}`,   color: 'text-indigo-200'},
          ].map(s => (
            <div key={s.label} className="flex-1 py-2.5 text-center">
              <p className={`font-headline font-extrabold text-lg leading-none ${s.color}`}>{s.value}</p>
              <p className="text-indigo-300 text-[9px] mt-0.5 uppercase tracking-wider font-bold">{s.label}</p>
            </div>
          ))}
        </div>
      </header>

      <main className="px-4 mt-5 space-y-4 max-w-xl mx-auto">

        {/* Voice Button */}
        <div className="flex flex-col items-center gap-2">
          <button onClick={startVoice} disabled={isListening || !!currentAmbiguity}
            className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all
              ${isListening ? 'bg-red-500 animate-pulse scale-110' : 'bg-indigo-600 active:scale-95'}`}
            style={{ boxShadow: isListening ? '0 0 20px rgba(239,68,68,0.5)' : '0 8px 25px rgba(67,56,202,0.4)' }}>
            <span className="material-symbols-outlined text-white text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
          </button>
          {voiceFeedback
            ? <p className="text-sm font-medium text-on-surface-variant text-center">{voiceFeedback}</p>
            : <p className="text-xs text-outline">Bolke hajiri lagao</p>
          }
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => markAll('present')}
            className="flex items-center justify-center gap-2 py-3.5 bg-green-600 text-white rounded-2xl font-headline font-bold text-sm active:scale-95 transition-transform">
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Sab Present
          </button>
          <button onClick={() => markAll('absent')}
            className="flex items-center justify-center gap-2 py-3.5 bg-surface-container border border-outline-variant text-on-surface-variant rounded-2xl font-headline font-bold text-sm active:scale-95 transition-transform">
            <span className="material-symbols-outlined text-lg">cancel</span>
            Sab Absent
          </button>
        </div>

        {/* Empty state */}
        {workerViews.length === 0 && (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-outline/30">group</span>
            <p className="text-outline font-medium mt-3">Koi worker register nahi hai</p>
            <p className="text-outline text-sm mt-1">Pehle Mazdoor tab mein workers add karo</p>
          </div>
        )}

        {/* Worker Cards */}
        <div className="space-y-3">
          {workerViews.map(({ worker, status, wageToday, outstanding, netPayable }) => {
            const cfg = STATUS_CONFIG[status]
            const advanceCovered = wageToday > 0 && netPayable <= 0
            return (
              <div key={worker.id}
                className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <span className="font-headline font-extrabold text-indigo-700 text-lg">
                      {worker.name[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-headline font-bold text-on-surface">
                      {worker.name}
                      {worker.qualifier && <span className="text-outline text-xs font-normal ml-1.5">({worker.qualifier})</span>}
                    </p>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-outline">₹{worker.daily_rate ?? '?'}/din</span>
                      {status !== 'unmarked' && status !== 'absent' && (
                        <span className="text-xs text-green-600 font-bold">+₹{wageToday} aaj</span>
                      )}
                      {outstanding > 0 && (
                        <span className="text-xs text-orange-500 font-bold">-₹{outstanding} advance baaki</span>
                      )}
                    </div>
                  </div>
                  {status !== 'unmarked' && status !== 'absent' ? (
                    <div className={`shrink-0 text-center px-3 py-1.5 rounded-xl border ${
                      advanceCovered ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
                      <p className={`font-headline font-extrabold text-sm ${advanceCovered ? 'text-blue-600' : 'text-green-700'}`}>
                        {advanceCovered ? '✓' : `₹${netPayable}`}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-wide text-outline">
                        {advanceCovered ? 'Covered' : 'Dena hai'}
                      </p>
                    </div>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${cfg.light}`}>
                      {cfg.label}
                    </span>
                  )}
                </div>
                {/* Tap Toggles */}
                <div className="grid grid-cols-3 border-t border-outline-variant/15">
                  {(['present', 'half', 'absent'] as AttendanceStatus[]).map(s => {
                    const c = STATUS_CONFIG[s]
                    const isActive = status === s
                    return (
                      <button key={s} onClick={() => markAttendance(worker.id, s)}
                        className={`py-2.5 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase transition-all
                          ${isActive ? c.color : 'text-outline hover:bg-surface-container'}`}>
                        <span className="material-symbols-outlined text-[16px]"
                          style={{ fontVariationSettings: `'FILL' ${isActive ? 1 : 0}` }}>
                          {c.icon}
                        </span>
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Disambiguation Bottom Sheet */}
      {currentAmbiguity && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={skipAmbiguity} />
          <div className="relative bg-white rounded-t-3xl shadow-2xl z-10 pb-8">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-outline-variant" />
            </div>
            <div className="px-6 pt-3 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-amber-500">warning</span>
                <h2 className="font-headline font-bold text-xl text-on-surface">
                  "{currentAmbiguity.parsedName}" — kaun sa?
                </h2>
              </div>
              <p className="text-outline text-sm mb-5">
                Hajiri: <span className={`font-bold uppercase px-2 py-0.5 rounded-md text-xs ${STATUS_CONFIG[currentAmbiguity.status].light}`}>
                  {STATUS_CONFIG[currentAmbiguity.status].label}
                </span>
              </p>
              <div className="flex flex-col divide-y divide-outline-variant/20">
                {currentAmbiguity.candidates.map(w => (
                  <button key={w.id}
                    onClick={() => resolveAmbiguity(w, currentAmbiguity.status)}
                    className="w-full py-4 flex justify-between items-center active:bg-surface-container transition-colors">
                    <div>
                      <span className="font-headline font-bold text-on-surface text-lg">{w.name}</span>
                      {w.qualifier && <span className="ml-2 text-outline font-medium">({w.qualifier})</span>}
                    </div>
                    <span className="text-sm font-label font-bold text-on-surface-variant bg-surface-container px-3 py-1 rounded-xl">
                      ₹{w.daily_rate ?? '?'}/din
                    </span>
                  </button>
                ))}
              </div>
              <button onClick={skipAmbiguity}
                className="w-full mt-4 py-3 text-outline font-medium text-sm text-center">
                Skip — baad mein mark karunga
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
