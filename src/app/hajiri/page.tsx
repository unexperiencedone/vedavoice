'use client'

import { useState, useRef, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAttendance, AttendanceStatus } from '@/hooks/useAttendance'
import { Worker } from '@/types'
import { useTranslation } from '@/components/LanguageProvider'
import { useTransliterate } from '@/hooks/useTransliterate'

const dateLabel = (lang: string, dateStr: string) => {
  const locale = lang === 'en' ? 'en-IN' : lang === 'hi' ? 'hi-IN' : lang === 'mr' ? 'mr-IN' : lang === 'gu' ? 'gu-IN' : lang === 'bn' ? 'bn-IN' : 'hi-IN'
  const dateObj = new Date(dateStr);
  return dateObj.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
}

const getStatusConfig = (t: any) => ({
  present:  { label: t('status_present'), icon: 'check_circle', color: 'bg-green-500 text-white',           light: 'bg-green-50 text-green-700 border-green-200' },
  half:     { label: t('status_half'),    icon: 'schedule',     color: 'bg-amber-500 text-white',           light: 'bg-amber-50 text-amber-700 border-amber-200' },
  absent:   { label: t('status_absent'),  icon: 'cancel',       color: 'bg-red-500 text-white',             light: 'bg-red-50 text-red-700 border-red-200' },
  unmarked: { label: t('status_mark'),    icon: 'help_outline', color: 'bg-surface-container text-outline', light: 'bg-surface-container text-outline border-outline-variant/30' },
})

interface Ambiguity {
  parsedName: string
  status: AttendanceStatus
  candidates: Worker[]
}

export default function HajiriPage() {
  const { language, t } = useTranslation()
  const auth = useAuth()
  const { workerViews, loading, markAttendance, markAll, summary, todayWages, selectedDate, setSelectedDate } = useAttendance(auth?.id)

  const STATUS_CONFIG = getStatusConfig(t)

  const [isListening, setIsListening]       = useState(false)
  const [voiceFeedback, setVoiceFeedback]   = useState('')
  const [ambiguityQueue, setAmbiguityQueue] = useState<Ambiguity[]>([])
  const recognitionRef = useRef<any>(null)

  // Current ambiguity is always the first in queue
  const currentAmbiguity = ambiguityQueue[0] ?? null

  // Use our new networked transliteration hook
  const allNames = workerViews.map(wv => wv.worker.name);
  if (currentAmbiguity) {
      allNames.push(currentAmbiguity.parsedName, ...currentAmbiguity.candidates.map(c => c.name));
  }
  const { transliterate } = useTransliterate(allNames);

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
    recognition.lang = language === 'en' ? 'en-US' : language === 'hinglish' ? 'hi-IN' : language === 'hi' ? 'hi-IN' : language === 'mr' ? 'mr-IN' : language === 'gu' ? 'gu-IN' : language === 'bn' ? 'bn-IN' : 'hi-IN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => { setIsListening(true); setVoiceFeedback('') }
    recognition.onend   = () => setIsListening(false)

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript
      setVoiceFeedback(`${t('assistant_listening')}: "${transcript}"`)

      try {
        const res = await fetch('/api/attendance/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: transcript,
            language: language,
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
  }, [workerViews, markAttendance, markAll, language, t])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-background pb-28">
      
      {/* Hero Section / Context */}
      <section className="mb-10 px-6 md:px-8 mt-8">
        <div className="asymmetric-header flex justify-between items-start">
          <div>
            <h1 className="font-headline text-4xl font-extrabold text-primary tracking-tight leading-none mb-2">{t('nav_attendance')}</h1>
            <p className="font-label text-on-surface-variant text-sm uppercase tracking-widest font-semibold">{dateLabel(language, selectedDate)}</p>
          </div>
          <div className="relative">
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 bg-white border border-outline-variant/30 rounded-xl text-sm font-bold text-on-surface outline-none cursor-pointer hover:border-primary/50 transition-colors"
            />
          </div>
        </div>

        {/* Attendance Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <div className="col-span-2 p-6 glass-card rounded-2xl text-white shadow-xl">
             <span className="font-label text-[10px] uppercase font-bold text-white/60 tracking-widest block mb-1">{t('aaj_ka_kharcha')}</span>
             <h2 className="font-headline text-4xl font-black">₹{todayWages.toLocaleString('en-IN')}</h2>
             <div className="mt-4 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-secondary-fixed w-[45%] rounded-full opacity-80" />
             </div>
          </div>
          <div className="p-6 bg-white rounded-2xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
            <span className="font-label text-[10px] uppercase font-bold text-outline tracking-widest block mb-1">{t('hazir_mazdoor')}</span>
            <span className="font-headline text-3xl font-black text-secondary">{summary.present + summary.half}</span>
          </div>
          <div className="p-6 bg-white rounded-2xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
            <span className="font-label text-[10px] uppercase font-bold text-outline tracking-widest block mb-1">{t('gar_hazir')}</span>
            <span className="font-headline text-3xl font-black text-error">{summary.absent}</span>
          </div>
        </div>
      </section>

      <main className="px-6 md:px-8 max-w-7xl mx-auto space-y-8">
        {/* Bulk Actions & Voice */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/20">
          <div className="flex items-center gap-6">
            <button onClick={startVoice} disabled={isListening || !!currentAmbiguity}
              className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500
                ${isListening ? 'bg-error scale-110 shadow-error/40' : 'bg-primary shadow-primary/40 active:scale-95'}`}>
              <span className="material-symbols-outlined text-white text-3xl"
                style={{ fontVariationSettings: "'FILL' 1" }}>{isListening ? 'graphic_eq' : 'mic'}</span>
            </button>
            <div>
              <p className="font-headline font-black text-on-surface leading-none mb-1">
                {isListening ? t('assistant_listening') : t('record_attendance')}
              </p>
              <p className="text-outline text-xs italic">
                {voiceFeedback || t('help_hint')}
              </p>
            </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <button onClick={() => markAll('present')}
              className="flex-1 md:px-6 py-3 bg-secondary text-white rounded-xl font-headline font-black text-xs uppercase tracking-widest shadow-lg shadow-secondary/20 hover:shadow-secondary/40 transition-all">
              {t('sab_present')}
            </button>
            <button onClick={() => markAll('absent')}
              className="flex-1 md:px-6 py-3 bg-surface-container-highest text-on-surface-variant rounded-xl font-headline font-black text-xs uppercase tracking-widest transition-all">
              {t('sab_absent')}
            </button>
          </div>
        </div>

        {/* Worker Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
          {workerViews.map(({ worker, status, wageToday, outstanding, netPayable }) => {
            const cfg = STATUS_CONFIG[status]
            const isMarked = status !== 'unmarked'
            const hasRate = !!worker.daily_rate
            
            return (
              <div key={worker.id}
                className={`bg-white rounded-3xl overflow-hidden ghost-border shadow-sm flex flex-col transition-all hover:shadow-md
                  ${isMarked ? 'border-primary/20' : ''}`}>
                
                <div className="p-5 flex items-start gap-4">
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-headline font-black text-lg shrink-0
                     ${isMarked ? 'bg-primary text-white' : 'bg-surface-container-low text-outline'}`}>
                     {worker.name[0].toUpperCase()}
                   </div>
                   <div className="flex-1 min-w-0">
                     <h3 className="font-headline font-extrabold text-on-surface leading-tight truncate">
                       {transliterate(worker.name)}
                     </h3>
                     <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${!hasRate ? 'text-error animate-pulse' : 'text-outline-variant'}`}>
                       {worker.qualifier ? t(`role_${worker.qualifier.toLowerCase()}` as any) : t('role_labour')} • {hasRate ? `₹${worker.daily_rate}/din` : t('rate_set_karo')}
                     </p>
                   </div>
                   {isMarked && (
                     <span className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tight
                       ${status === 'present' ? 'bg-secondary-container text-secondary' : status === 'half' ? 'bg-amber-100 text-amber-700' : 'bg-error-container text-error'}`}>
                       {cfg.label}
                     </span>
                   )}
                </div>

                {/* Bottom Payout Info Card - Clean View */}
                {isMarked && status !== 'absent' && (
                  <div className="mx-5 mb-4 p-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/10 flex justify-between items-center animate-in fade-in slide-in-from-top-1">
                    <div>
                      <p className="text-[9px] font-black text-outline uppercase tracking-tight">{t('aaj_ki_mazdoori')}</p>
                      <p className="text-sm font-headline font-black text-secondary">₹{wageToday}</p>
                    </div>
                    {outstanding > 0 && (
                      <div className="text-right">
                        <p className="text-[9px] font-black text-outline uppercase tracking-tight">{t('purana_advance')}</p>
                        <p className="text-sm font-headline font-black text-error">₹{outstanding}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Attendance Toggles */}
                <div className="mt-auto grid grid-cols-3 border-t border-outline-variant/10 bg-slate-50/50">
                  {(['present', 'half', 'absent'] as AttendanceStatus[]).map(s => {
                    const c = STATUS_CONFIG[s]
                    const isActive = status === s
                    return (
                      <button key={s} onClick={() => markAttendance(worker.id, s)}
                        className={`py-4 flex flex-col items-center justify-center gap-1 transition-all
                          ${isActive ? 'bg-white shadow-inner font-black' : 'text-outline hover:bg-white/40'}`}>
                        <span className="material-symbols-outlined text-lg"
                          style={{ fontVariationSettings: `'FILL' ${isActive ? 1 : 0}`, color: isActive ? 'var(--color-primary)' : 'inherit' }}>
                          {c.icon}
                        </span>
                        <span className="text-[8px] font-black uppercase tracking-tight">{c.label}</span>
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
                  "{transliterate(currentAmbiguity.parsedName)}" — {t('kaun_sa')}?
                </h2>
              </div>
              <p className="text-outline text-sm mb-5">
                {t('nav_attendance')}: <span className={`font-bold uppercase px-2 py-0.5 rounded-md text-xs ${STATUS_CONFIG[currentAmbiguity.status].light}`}>
                  {STATUS_CONFIG[currentAmbiguity.status].label}
                </span>
              </p>
              <div className="flex flex-col divide-y divide-outline-variant/20">
                {currentAmbiguity.candidates.map(w => (
                  <button key={w.id}
                    onClick={() => resolveAmbiguity(w, currentAmbiguity.status)}
                    className="w-full py-4 flex justify-between items-center active:bg-surface-container transition-colors">
                    <div>
                      <span className="font-headline font-bold text-on-surface text-lg">{transliterate(w.name)}</span>
                      {w.qualifier && <span className="ml-2 text-outline font-medium">({t(`role_${w.qualifier.toLowerCase()}` as any)})</span>}
                    </div>
                    <span className="text-sm font-label font-bold text-on-surface-variant bg-surface-container px-3 py-1 rounded-xl">
                      ₹{w.daily_rate ?? '?'}/din
                    </span>
                  </button>
                ))}
              </div>
              <button onClick={skipAmbiguity}
                className="w-full mt-4 py-3 text-outline font-medium text-sm text-center">
                {t('baad_mein_mark_karunga')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
