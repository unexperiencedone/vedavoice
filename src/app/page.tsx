"use client";

import { useState, useCallback } from "react";
import { useVoice } from "@/hooks/useVoice";
import { useLedger } from "@/hooks/useLedger";
import { SKILL_OPTIONS } from "@/app/workers/page";
import { useAuth } from "@/hooks/useAuth";
import { useWorkers } from "@/hooks/useWorkers";
import { extractFromText } from "@/lib/api";
import { ExtractResult, Worker } from "@/types";
import { fetchWorkerFinancials, classifyPayment } from "@/lib/smartPayment";
import { logVoiceEntry } from "@/lib/voiceLog";
import { useTranslation } from "@/components/LanguageProvider";
import { Language } from "@/lib/translations";

import MicButton from "@/components/MicButton";
import SummaryStrip from "@/components/SummaryStrip";
import LedgerList from "@/components/LedgerList";
import TxnItem from "@/components/TxnItem";
type Status = "idle" | "listening" | "processing" | "disambiguating" | "confirming" | "saved" | "error";

const statusLabel: Record<Status, string> = {
  idle:       "assistant_idle",
  listening:  "assistant_listening",
  processing: "assistant_processing",
  disambiguating: "disambiguating",
  confirming: "assistant_confirming",
  saved:      "assistant_saved",
  error:      "error",
};

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) return (
    <img src={url} alt={name} className="w-10 h-10 rounded-full object-cover border-2 border-indigo-400" />
  )
  return (
    <div className="w-10 h-10 rounded-full bg-indigo-500 border-2 border-indigo-400
      flex items-center justify-center text-white font-headline font-bold text-sm">
      {name[0]?.toUpperCase()}
    </div>
  )
}

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [lastText, setLastText] = useState("");

  const [candidates, setCandidates] = useState<Worker[]>([]);
  const [targetWorker, setTargetWorker] = useState<Worker | "new" | null>(null);
  const [newWorkerDetails, setNewWorkerDetails] = useState({ daily_rate: '', phone: '', skill: '', language: 'en' });

  const auth   = useAuth();
  const ledger = useLedger(auth?.id);
  const { matchWorker, createWorker } = useWorkers(auth?.id);

  const { listening, transcript, start, stop, speak } = useVoice({
    onResult: async (text) => {
      setLastText(text);
      setStatus("processing");
      try {
        const extracted = await extractFromText(text, language);
        setResult(extracted);
        if (!extracted.name || extracted.amount_int === null) {
          setStatus("error");
          setErrorMsg(t('site_audit_notice'));
          speak(t('assistant_idle'), t('tts_lang'));
          return;
        }

        const match = matchWorker(extracted.name);

        if (match.type === 'ambiguous') {
          setCandidates(match.candidates || []);
          setStatus('disambiguating');
          // Important: pause logic here. Wait for UI bottom sheet tap.
        } else if (match.type === 'new') {
          setTargetWorker('new');
          await promptConfirmation(extracted, 'new');
        } else {
          setTargetWorker(match.worker || null);
          await promptConfirmation(extracted, match.worker || null);
        }
      } catch (err) {
        console.error(err);
        setStatus("error");
        setErrorMsg(t('backend_error'));
      }
    },
    onError: (e) => { setStatus("error"); setErrorMsg(e); },
  });

  const { language, setLanguage, t } = useTranslation();

  const promptConfirmation = useCallback(async (res: ExtractResult, w: Worker | "new" | null) => {
    setStatus("confirming");

    let localizedName = res.name;
    const shouldTransliterate = language !== 'en' && language !== 'hinglish' && res.name;

    if (shouldTransliterate) {
        try {
            // Add a 1.2s timeout to avoid losing the voice context
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 1200);

            const transRes = await fetch('/api/transliterate', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ names: [res.name], targetLang: language }),
                signal: controller.signal
            });
            clearTimeout(id);

            if (transRes.ok) {
                const map = await transRes.json() as { translations: Record<string, string> };
                const nameKey = res.name?.toLowerCase().trim();
                if (nameKey && map.translations[nameKey]) {
                    localizedName = map.translations[nameKey];
                }
            }
        } catch (e) { 
            console.warn('[TTS] Transliteration skipped or timed out, using original name.');
        }
    }
    
    // Construct spoken phrase
    const unitVoice = res.unit === 'days' ? t('days') : t('rupees');
    const actionVoiceMap: Record<string, string> = {
      UDHAAR: t('filter_adv'), 
      PAYMENT: t('filter_pay'), 
      ADVANCE: t('filter_adv'), 
      RECEIPT: t('total_paid'), 
      MATERIAL: t('material'), 
      ATTENDANCE: t('attendance_voice')
    };
    const actionVoice = actionVoiceMap[res.action] || res.action;

    // Use established worker name with qualifier if possible, else just extracted name
    let spokenName = localizedName;
    if (w && w !== 'new' && w.qualifier) {
        const roleKey = `role_${w.qualifier.toLowerCase()}` as any;
        const roleStr = t(roleKey) !== roleKey ? t(roleKey) : w.qualifier;
        spokenName = `${localizedName} ${roleStr}`;
    }

    speak(`${spokenName} ${res.amount_int} ${unitVoice} ${actionVoice}. ${t('assistant_confirming')}`, t('tts_lang'));
  }, [speak, t, language]);

  async function handleSelectCandidate(w: Worker | "new") {
    if (!result) return;
    setTargetWorker(w);
    await promptConfirmation(result, w);
  }

  function handleMicTap() {
    if (listening) { stop(); return; }
    if (status === "confirming" || status === "disambiguating") return;
    setResult(null); setErrorMsg(""); setStatus("listening"); setTargetWorker(null); start();
    setNewWorkerDetails({ daily_rate: '', phone: '', skill: '', language: 'en' });
  }

  async function handleConfirm() {
    if (!result) return;
    try {
      let finalWorkerId: string | null = null;
      let finalWorker: Worker | null = null;

      if (targetWorker === "new" && result.name) {
        const newW = await createWorker(
          result.name, 
          newWorkerDetails.skill || result.qualifier, 
          Number(newWorkerDetails.daily_rate) || null,
          newWorkerDetails.phone || null,
          newWorkerDetails.language
        );
        if (newW) { finalWorkerId = newW.id; finalWorker = newW; }
      } else if (targetWorker && targetWorker !== 'new') {
        finalWorkerId = targetWorker.id;
        finalWorker = targetWorker;
      }

      await ledger.savePrediction(result, lastText, true);

      // Smart classification: only for PAYMENT or ADVANCE intents
      if ((result.action === 'PAYMENT' || result.action === 'ADVANCE') &&
          auth?.id && finalWorker && finalWorker.daily_rate) {

        const financials = await fetchWorkerFinancials(
          auth.id, finalWorkerId, result.name!, finalWorker.daily_rate
        );
        const classification = classifyPayment(result.amount_int!, financials);

        if (classification.type === 'SPLIT') {
          // Save two transactions: one PAYMENT + one ADVANCE (Skip single SMS)
          const pTxn = await ledger.addTransaction(
            { ...result, action: 'PAYMENT', amount_int: classification.paymentAmount!, notes: classification.paymentNotes ?? null },
            lastText, finalWorkerId, true
          );
          await ledger.addTransaction(
            { ...result, action: 'ADVANCE', amount_int: classification.advanceAmount!, notes: classification.advanceNotes ?? null },
            lastText, finalWorkerId, true
          );

          // Combined SMS: use the original result name and the total amount
          if (finalWorker?.phone && pTxn) {
            ledger.triggerVerification(pTxn, finalWorker.phone, finalWorker.language);
          }
        } else {
          // Single transaction with smart notes
          await ledger.addTransaction(
            { ...result, action: classification.action!, amount_int: classification.amount!, notes: classification.notes ?? result.notes ?? null },
            lastText, finalWorkerId
          );
        }
      } else {
        // For all other intents (ATTENDANCE, MATERIAL, RECEIPT, UDHAAR) — save as-is
        await ledger.addTransaction(result, lastText, finalWorkerId);
      }

      setStatus("saved");
      speak(t('assistant_saved'), t('tts_lang'));
      logVoiceEntry({
        transcript: lastText,
        action: result.action,
        name: result.name,
        amount: result.amount_int,
        status: 'saved'
      });
      setTimeout(() => { setStatus("idle"); setResult(null); }, 2000);
    } catch (e) {
      console.error(e)
      setStatus("error"); setErrorMsg(t('error_saving'));
    }
  }

  function handleCancel() {
    if (result) {
      ledger.savePrediction(result, lastText, false);
      logVoiceEntry({ transcript: lastText, action: result.action, name: result.name, amount: result.amount_int, status: 'cancelled' });
    }
    setStatus("idle"); setResult(null); setTargetWorker(null); speak(t('cancel'), t('tts_lang'));
    setNewWorkerDetails({ daily_rate: '', phone: '', skill: '', language: 'en' });
  }

  return (
    <div className="min-h-screen bg-background pb-24 relative">


      <main className="max-w-7xl mx-auto px-6 md:px-8 py-8">
        <div className="asymmetric-grid">
          
          {/* Column 1: Financials & Ledger */}
          <div className="space-y-10 min-w-0">
            {/* Contextual Header */}
            <div className="asymmetric-header">
              <h1 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight leading-none mb-1">
                {t('welcome')} {auth?.name?.split(' ')[0] ?? t('supervisor')} 🙏
              </h1>
              <p className="text-xs font-label font-bold text-outline-variant uppercase tracking-[0.2em]">
                {new Date().toLocaleDateString(language === 'en' ? 'en-IN' : language === 'hi' ? 'hi-IN' : language === 'mr' ? 'mr-IN' : language === 'gu' ? 'gu-IN' : language === 'bn' ? 'bn-IN' : 'hi-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>

            {/* Glass Dashboard Card */}
            <SummaryStrip stats={ledger.stats} />

            {/* Recent Table / Ledger */}
            <section className="space-y-6">
              <div className="flex justify-between items-end">
                <h2 className="text-xl font-headline font-black text-on-surface tracking-tight uppercase">{t('recent_hisaab')}</h2>
                <button className="text-primary font-bold text-xs uppercase tracking-widest hover:underline">{t('view_all')}</button>
              </div>
              <LedgerList
                transactions={ledger.transactions.slice(0, 10)}
                loading={ledger.loading}
                onDelete={ledger.deleteTransaction}
              />
            </section>
          </div>

          {/* Column 2: Interaction & Discovery */}
          <div className="space-y-10">
            {/* Mic Hero Container */}
            <div className="bg-white rounded-[3rem] p-10 shadow-sm border border-outline-variant/10 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px]">
              <div className="space-y-2">
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm
                  ${status === 'error' ? 'bg-error text-white' : 'bg-primary text-white'}`}>
                  {status === 'idle' ? t('live_assistant') : t(statusLabel[status] as any)}
                </span>
                <p className="text-outline text-xs font-medium">{t('help_hint')}</p>
              </div>

              <MicButton listening={listening} status={status} onTap={handleMicTap} />

              {(transcript || lastText) && status !== "disambiguating" && (
                <div className="w-full bg-surface-container-low/50 p-4 rounded-2xl border border-dashed border-primary/20">
                  <p className="italic text-on-surface-variant text-sm font-medium leading-relaxed font-body">
                    "{transcript || lastText}"
                  </p>
                </div>
              )}

              {/* Action Buttons & Forms */}
              {status === "disambiguating" && (
                <div className="w-full text-left space-y-3">
                  <h3 className="font-headline font-bold text-sm text-on-surface mb-2 border-b border-outline-variant/20 pb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-500 text-lg">warning</span>
                    {t('disambiguating')}
                  </h3>
                  {candidates.map(c => (
                    <button key={c.id} onClick={() => handleSelectCandidate(c)}
                      className="w-full p-3 rounded-xl border border-outline-variant/30 hover:border-primary/50 hover:bg-primary/5 flex justify-between items-center transition-all bg-white">
                      <div>
                        <span className="font-headline font-bold text-on-surface text-sm block">{c.name}</span>
                        {c.qualifier && <span className="text-[10px] uppercase font-bold text-outline tracking-widest">{c.qualifier}</span>}
                      </div>
                      <span className="text-[10px] font-black text-secondary-fixed tracking-wider bg-secondary-fixed/20 px-2 py-1 rounded-md">₹{c.daily_rate ?? '?'}/din</span>
                    </button>
                  ))}
                  <button onClick={() => handleSelectCandidate("new")}
                    className="w-full py-3 mt-2 text-primary font-bold text-xs uppercase tracking-widest hover:bg-primary/10 rounded-xl transition-all border border-dashed border-primary/30">
                    + Add New "{result?.name}"
                  </button>
                  <button onClick={handleCancel} className="w-full mt-1 text-outline font-medium text-xs hover:underline pt-2">
                    Cancel
                  </button>
                </div>
              )}

              {status === "confirming" && result && (
                <div className="w-full bg-primary/5 border border-primary/20 rounded-3xl p-6 space-y-4 shadow-xl shadow-primary/5">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined text-primary">person</span>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">{t('label_worker')}</h4>
                        <p className="text-lg font-headline font-black text-on-surface leading-tight">{result.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">{result.unit === 'INR' ? t('label_amount') : t('nav_attendance')}</h4>
                      <p className="text-2xl font-headline font-black text-primary">
                        {result.unit === 'INR' ? '₹' : ''}{result.amount_int}{result.unit === 'days' ? ' din' : ''}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-white/60 p-3 rounded-2xl border border-outline-variant/10">
                    <span className="material-symbols-outlined text-secondary text-lg">category</span>
                    <span className="text-xs font-black uppercase tracking-widest text-on-surface-variant">
                      {result.action}
                    </span>
                  </div>

                  {targetWorker !== "new" && (
                    <div className="flex gap-3 pt-2">
                      <button onClick={handleConfirm} className="flex-1 py-4 bg-primary text-white font-headline font-black rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all text-xs uppercase tracking-widest">
                        {t('confirm')}
                      </button>
                      <button onClick={handleCancel} className="px-6 py-4 bg-surface-container-highest text-on-surface-variant font-black rounded-2xl active:scale-95 transition-all text-xs uppercase">
                        X
                      </button>
                    </div>
                  )}
                </div>
              )}

              {status === "confirming" && result && targetWorker === "new" && (
                <div className="w-full text-left space-y-4 bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 mt-2">
                  <div>
                    <h3 className="font-headline font-black text-sm text-primary mb-1">{t('add_worker')}</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-outline">{t('worker_form_subtitle')}</p>
                  </div>
                            <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-outline tracking-wider uppercase mb-1 block">{t('worker_name')}</label>
                      <input type="text" placeholder="Raju, Ramesh..." value={result.name || ''} onChange={e => setResult({...result, name: e.target.value})}
                        className="w-full bg-white border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-outline tracking-wider uppercase mb-1 block">{t('worker_skill')}</label>
                      <select
                        value={newWorkerDetails.skill}
                        onChange={e => setNewWorkerDetails(p => ({...p, skill: e.target.value}))}
                        className="w-full bg-white border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                      >
                        <option value="">{t('select_skill')}</option>
                        {SKILL_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-outline tracking-wider uppercase mb-1 block">{t('worker_rate')}</label>
                      <input type="number" placeholder="e.g. 500" value={newWorkerDetails.daily_rate} onChange={e => setNewWorkerDetails(p => ({...p, daily_rate: e.target.value}))}
                        className="w-full bg-white border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-outline tracking-wider uppercase mb-1 block">{t('worker_phone')}</label>
                      <input type="tel" placeholder="10-digit number" value={newWorkerDetails.phone} onChange={e => setNewWorkerDetails(p => ({...p, phone: e.target.value}))}
                        className="w-full bg-white border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-outline tracking-wider uppercase mb-1 block">{t('field_sms_lang')}</label>
                      <select 
                        value={newWorkerDetails.language} 
                        onChange={e => setNewWorkerDetails(p => ({...p, language: e.target.value}))}
                        className="w-full bg-white border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="en">English</option>
                        <option value="hi">Hindi (हिंदी)</option>
                        <option value="mr">Marathi (मराठी)</option>
                        <option value="gu">Gujarati (ગુજરાती)</option>
                        <option value="bn">Bengali (বাংলা)</option>
                        <option value="hinglish">Hinglish</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button onClick={handleConfirm} className="flex-1 py-3 bg-primary text-white font-headline font-black rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all text-[11px] uppercase tracking-widest">
                      Save & {t('confirm')}
                    </button>
                    <button onClick={handleCancel} className="px-4 bg-surface-container-highest text-on-surface-variant font-black rounded-xl active:scale-95 transition-all">
                      X
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Visual Audit Trail */}
            <section className="space-y-5">
              <h2 className="text-xs font-black text-outline uppercase tracking-widest px-2">{t('audit_trail')}</h2>
              <div className="space-y-3">
                {ledger.transactions.slice(0, 2).map(t => (
                  <TxnItem key={t.id} transaction={t} />
                ))}
              </div>
            </section>
          </div>

        </div>
      </main>
    </div>
  );
}
