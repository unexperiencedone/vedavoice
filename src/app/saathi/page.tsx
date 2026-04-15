'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSaathiHistory, ChatMessage, ChatSession } from '@/hooks/useSaathiHistory'
import { useTranslation } from '@/components/LanguageProvider'

export default function SaathiPage() {
  const auth = useAuth()
  const { t, language } = useTranslation()
  const {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    createChat,
    addMessage,
    deleteSession,
    clearAll,
    getContextWindow,
    loaded
  } = useSaathiHistory(auth?.id)

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Dynamically localised starter prompts from translation keys
  const STARTER_PROMPTS = [
    t('saathi_starter_1'),
    t('saathi_starter_2'),
    t('saathi_starter_3'),
    t('saathi_starter_4'),
    t('saathi_starter_5'),
    t('saathi_starter_6'),
  ]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSession?.messages, loading])

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || !auth?.id || loading) return

    const userMsg: ChatMessage = { role: 'user', content: userText, ts: Date.now() }
    addMessage(userMsg)
    setInput('')
    setLoading(true)

    try {
      const contextWindow = getContextWindow()
      const res = await fetch('/api/saathi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: auth.id,
          messages: [...contextWindow, { role: 'user', content: userText }]
        })
      })
      const data = await res.json()
      const reply = data.reply || t('error')
      addMessage({ role: 'assistant', content: reply, ts: Date.now() })
    } catch {
      addMessage({ role: 'assistant', content: `⚠️ ${t('saathi_error')}`, ts: Date.now() })
    } finally {
      setLoading(false)
    }
  }, [auth?.id, loading, addMessage, getContextWindow, t])

  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.lang = language === 'en' ? 'en-US' : language === 'mr' ? 'mr-IN' : language === 'gu' ? 'gu-IN' : language === 'bn' ? 'bn-IN' : 'hi-IN'
    r.interimResults = false
    r.onstart = () => setIsListening(true)
    r.onend = () => setIsListening(false)
    r.onresult = (e: any) => sendMessage(e.results[0][0].transcript)
    r.start()
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDateHeader = (ts: number) => {
    const date = new Date(ts)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toLocaleDateString() === today.toLocaleDateString()) return t('saathi_today')
    if (date.toLocaleDateString() === yesterday.toLocaleDateString()) return t('saathi_yesterday')
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const groupSessionsByDate = () => {
    const groups: Record<string, ChatSession[]> = {
      [t('saathi_today')]: [],
      [t('saathi_yesterday')]: [],
      [t('saathi_older')]: [],
    }
    const today = new Date().toLocaleDateString()
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString()

    sessions.forEach(s => {
      const d = new Date(s.ts).toLocaleDateString()
      if (d === today) groups[t('saathi_today')].push(s)
      else if (d === yesterday) groups[t('saathi_yesterday')].push(s)
      else groups[t('saathi_older')].push(s)
    })
    return groups
  }

  if (!loaded) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const sessionGroups = groupSessionsByDate()

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">

      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-indigo-950 z-50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col border-r border-white/10`}>
        <div className="p-4 border-b border-white/10">
          <button
            onClick={() => { createChat(); setSidebarOpen(false); }}
            className="w-full h-11 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 font-medium text-sm"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            {t('new_chat')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          {Object.entries(sessionGroups).map(([group, sList]) => sList.length > 0 && (
            <div key={group}>
              <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest px-3 mb-2">{group}</h3>
              <div className="space-y-1">
                {sList.map(s => (
                  <div key={s.id} className="group relative">
                    <button
                      onClick={() => { setActiveSessionId(s.id); setSidebarOpen(false); }}
                      className={`w-full p-3 text-left rounded-lg text-sm transition-all flex items-center gap-3 pr-10
                        ${activeSessionId === s.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40 font-medium' : 'text-indigo-200 hover:bg-white/5 hover:text-white'}`}
                    >
                      <span className="material-symbols-outlined text-lg opacity-70">chat_bubble</span>
                      <span className="truncate">{s.title}</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-1 py-1 text-indigo-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-white/10 bg-indigo-950/50">
          <button
            onClick={clearAll}
            className="w-full flex items-center gap-2 text-indigo-400 hover:text-white text-xs px-2 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">delete_forever</span>
            {t('delete_all')}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full bg-surface relative min-w-0">

        {/* Header Section */}
        <section className="px-6 md:px-8 mt-8 shrink-0">
          <div className="asymmetric-header">
            <h1 className="font-headline text-4xl font-extrabold text-primary tracking-tight leading-none mb-2">{t('saathi_header')}</h1>
            <p className="font-label text-on-surface-variant text-sm uppercase tracking-widest font-semibold flex items-center gap-2">
               <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
               {t('saathi_subtitle')}
            </p>
          </div>
        </section>

        {/* Chat window */}
        <div className="flex-1 overflow-y-auto px-6 md:px-8 py-8 space-y-8 pb-40">

          {(activeSession?.messages.length === 0 || !activeSession) && (
            <div className="flex flex-col items-center text-center mt-10">
              <div className="w-24 h-24 rounded-3xl glass-card flex items-center justify-center mb-8 shadow-2xl">
                <span className="material-symbols-outlined text-white text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>monitoring</span>
              </div>
              <h2 className="font-headline font-black text-3xl text-on-surface tracking-tight">{t('saathi_welcome')}</h2>
              <p className="text-on-surface-variant text-sm mt-4 max-w-sm font-medium leading-relaxed">
                {t('saathi_desc')}
              </p>

              <div className="flex flex-wrap gap-3 justify-center mt-12 max-w-2xl">
                {STARTER_PROMPTS.map(p => (
                  <button key={p} onClick={() => sendMessage(p)}
                    className="px-6 py-3 bg-white border border-outline-variant/30 rounded-2xl text-[11px] font-black uppercase tracking-widest text-on-surface-variant hover:bg-primary-fixed hover:border-primary-fixed hover:text-primary transition-all active:scale-95 shadow-sm">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeSession?.messages.map((m, i) => {
            const prevMsg = i > 0 ? activeSession.messages[i - 1] : null
            const showDate = !prevMsg || new Date(m.ts).toLocaleDateString() !== new Date(prevMsg.ts).toLocaleDateString()

            return (
              <div key={i} className="flex flex-col gap-6">
                {showDate && (
                  <div className="flex justify-center my-2">
                    <div className="bg-surface-container-high/40 px-3 py-1 rounded-full border border-outline-variant/10 text-[10px] font-bold text-outline uppercase tracking-[0.2em]">
                      {formatDateHeader(m.ts)}
                    </div>
                  </div>
                )}

                <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-3`}>
                  {m.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-indigo-600 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                    </div>
                  )}
                  <div className="max-w-[85%] sm:max-w-[70%]">
                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed
                      ${m.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-sm shadow-md'
                        : 'bg-white border border-outline-variant/20 text-on-surface rounded-tl-sm shadow-sm'}`}>
                      {m.content}
                    </div>
                    {m.ts && (
                      <p className={`text-[10px] text-outline mt-1.5 font-medium ${m.role === 'user' ? 'text-right' : 'text-left ml-1'}`}>
                        {formatTime(m.ts)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {loading && (
            <div className="flex justify-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-indigo-600 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              </div>
              <div className="bg-white border border-outline-variant/20 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 bg-gradient-to-t from-white via-white to-transparent pointer-events-none">
          <div className="max-w-2xl mx-auto flex gap-2 items-end pointer-events-auto">
            <button onClick={startVoice} disabled={isListening || loading}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all border
                ${isListening ? 'bg-red-500 border-red-400 animate-pulse text-white' : 'bg-surface-container-low border-outline-variant/20 text-indigo-600 hover:bg-indigo-50'}`}>
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
            </button>
            <div className="flex-1 relative">
              <input ref={inputRef} value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
                placeholder={t('chat_placeholder')}
                className="w-full bg-white border border-outline-variant/30 rounded-2xl py-4 pl-4 pr-14 text-sm text-on-surface outline-none focus:ring-4 focus:ring-primary/10 placeholder:text-outline/60 shadow-lg" />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center disabled:opacity-40 active:scale-90 transition-transform shadow-md"
              >
                <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
              </button>
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}
