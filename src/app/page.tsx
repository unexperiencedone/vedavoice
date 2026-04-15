"use client";

import { useState, useCallback } from "react";
import { useVoice } from "@/hooks/useVoice";
import { useLedger } from "@/hooks/useLedger";
import { useAuth } from "@/hooks/useAuth";
import { useWorkers } from "@/hooks/useWorkers";
import { extractFromText } from "@/lib/api";
import { ExtractResult, Worker } from "@/types";
import { fetchWorkerFinancials, classifyPayment } from "@/lib/smartPayment";
import { logVoiceEntry } from "@/lib/voiceLog";

import MicButton from "@/components/MicButton";
import SummaryStrip from "@/components/SummaryStrip";
import LedgerList from "@/components/LedgerList";
import TxnItem from "@/components/TxnItem";
type Status = "idle" | "listening" | "processing" | "disambiguating" | "confirming" | "saved" | "error";

const statusLabel: Record<Status, string> = {
  idle:       "Tap karke bolo...",
  listening:  "Sun raha hoon...",
  processing: "Samajh raha hoon...",
  disambiguating: "Inme se kaunsa?",
  confirming: "Sahi hai?",
  saved:      "Likh diya! ✓",
  error:      "Kuch gadbad ho gayi",
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

  const auth   = useAuth();
  const ledger = useLedger(auth?.id);
  const { matchWorker, createWorker } = useWorkers(auth?.id);

  const { listening, transcript, start, stop, speak } = useVoice({
    onResult: async (text) => {
      setLastText(text);
      setStatus("processing");
      try {
        const extracted = await extractFromText(text);
        setResult(extracted);
        if (!extracted.name || extracted.amount_int === null) {
          setStatus("error");
          setErrorMsg("Naam ya amount samajh nahi aaya. Dobara bolo.");
          speak("Samajh nahi aaya, dobara bolo.");
          return;
        }

        const match = matchWorker(extracted.name);

        if (match.type === 'ambiguous') {
          setCandidates(match.candidates || []);
          setStatus('disambiguating');
          // Important: pause logic here. Wait for UI bottom sheet tap.
        } else if (match.type === 'new') {
          setTargetWorker('new');
          promptConfirmation(extracted, 'new');
        } else {
          setTargetWorker(match.worker || null);
          promptConfirmation(extracted, match.worker || null);
        }
      } catch (err) {
        console.error(err);
        setStatus("error");
        setErrorMsg("Backend se connect nahi ho pa raha.");
      }
    },
    onError: (e) => { setStatus("error"); setErrorMsg(e); },
  });

  const promptConfirmation = useCallback((res: ExtractResult, w: Worker | "new" | null) => {
    setStatus("confirming");
    
    // Construct spoken phrase
    const unitVoice = res.unit === 'days' ? 'din' : 'rupaye';
    const actionVoiceMap: Record<string, string> = {
      UDHAAR: 'advance payment', 
      PAYMENT: 'payment', 
      ADVANCE: 'advance payment', 
      RECEIPT: 'mila', MATERIAL: 'kharcha', ATTENDANCE: 'haajiri'
    };
    const actionVoice = actionVoiceMap[res.action] || res.action;

    // Use established worker name with qualifier if possible, else just extracted name
    const spokenName = w && w !== 'new' && w.qualifier ? `${w.name} ${w.qualifier}` : res.name;
    speak(`${spokenName} ka ${res.amount_int} ${unitVoice} ${actionVoice}. Sahi hai?`);
  }, [speak]);

  function handleSelectCandidate(w: Worker | "new") {
    if (!result) return;
    setTargetWorker(w);
    promptConfirmation(result, w);
  }

  function handleMicTap() {
    if (listening) { stop(); return; }
    if (status === "confirming" || status === "disambiguating") return;
    setResult(null); setErrorMsg(""); setStatus("listening"); setTargetWorker(null); start();
  }

  async function handleConfirm() {
    if (!result) return;
    try {
      let finalWorkerId: string | null = null;
      let finalWorker: Worker | null = null;

      if (targetWorker === "new" && result.name) {
        const newW = await createWorker(result.name, result.qualifier, null);
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
            ledger.triggerVerification(pTxn, finalWorker.phone);
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
      speak("Likh diya!");
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
      setStatus("error"); setErrorMsg("Save karne mein problem aayi.");
    }
  }

  function handleCancel() {
    if (result) {
      ledger.savePrediction(result, lastText, false);
      logVoiceEntry({ transcript: lastText, action: result.action, name: result.name, amount: result.amount_int, status: 'cancelled' });
    }
    setStatus("idle"); setResult(null); setTargetWorker(null); speak("Cancel kar diya.");
  }

  return (
    <div className="min-h-screen bg-background pb-24 relative">

      {/* Header */}
      <header className="bg-indigo-700 md:bg-transparent sticky top-0 z-40 shadow-lg md:shadow-none shadow-indigo-900/20"
        style={{ backdropFilter: 'blur(20px)' }}>
        <div className="flex justify-between items-center px-6 md:px-8 py-4">
          <div className="flex items-center gap-3 md:hidden">
            <span className="font-headline font-black tracking-tight text-xl text-white">VedaVoice</span>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <div className="text-right hidden md:block">
              <p className="text-indigo-200 md:text-on-surface-variant text-xs font-label uppercase tracking-widest">Namaste,</p>
              <p className="text-white md:text-on-surface font-bold font-headline">{auth?.name ?? 'Thekedar'} 🙏</p>
            </div>
            <Avatar url={auth?.avatarUrl ?? null} name={auth?.name ?? 'T'} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 md:px-8 py-8">
        <div className="asymmetric-grid">
          
          {/* Column 1: Financials & Ledger */}
          <div className="space-y-10 min-w-0">
            {/* Contextual Header */}
            <div className="asymmetric-header">
              <h1 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight leading-none mb-1">
                Namaste, {auth?.name?.split(' ')[0] ?? 'Thekedar'} 🙏
              </h1>
              <p className="text-xs font-label font-bold text-outline-variant uppercase tracking-[0.2em]">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>

            {/* Glass Dashboard Card */}
            <SummaryStrip stats={ledger.stats} />

            {/* Recent Table / Ledger */}
            <section className="space-y-6">
              <div className="flex justify-between items-end">
                <h2 className="text-xl font-headline font-black text-on-surface tracking-tight uppercase">Recent Hisaab</h2>
                <button className="text-primary font-bold text-xs uppercase tracking-widest hover:underline">View All</button>
              </div>
              <LedgerList
                transactions={ledger.transactions.slice(0, 5)}
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
                  {status === 'idle' ? 'Live Assistant' : statusLabel[status]}
                </span>
                <p className="text-outline text-xs font-medium">Kaise help karun? Bolo: "Rahul ko 500 diye"</p>
              </div>

              <MicButton listening={listening} status={status} onTap={handleMicTap} />

              {(transcript || lastText) && (
                <div className="w-full bg-surface-container-low/50 p-4 rounded-2xl border border-dashed border-primary/20">
                  <p className="italic text-on-surface-variant text-sm font-medium leading-relaxed font-body">
                    "{transcript || lastText}"
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              {status === "confirming" && result && (
                <div className="w-full flex gap-3 pt-2">
                  <button
                    onClick={handleConfirm}
                    className="flex-1 py-4 bg-primary text-white font-headline font-black rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all text-xs uppercase tracking-widest"
                  >
                    Confirm ✓
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-6 py-4 bg-surface-container-highest text-on-surface-variant font-black rounded-2xl active:scale-95 transition-all text-xs uppercase"
                  >
                    X
                  </button>
                </div>
              )}
            </div>

            {/* Visual Audit Trail */}
            <section className="space-y-5">
              <h2 className="text-xs font-black text-outline uppercase tracking-widest px-2">Voice Audit Trail</h2>
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
