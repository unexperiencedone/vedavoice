'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Transaction } from '@/types'
import { useTranslation } from './LanguageProvider'

/**
 * DEV SIMULATOR: WORKER-SIDE UI
 * This a floating tool to demonstrate the VedaPay trust-loop.
 * It watches for any transaction in 'verifying' status and displays the 'Incoming SMS'.
 */
export default function DevSimulator() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingTxn, setPendingTxn] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);

  // 1. Listen for new 'verifying' transactions
  useEffect(() => {
    const fetchPending = async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('verification_status', 'verifying')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data) setPendingTxn(data);
    };

    fetchPending();

    // Realtime sub to catch the 'Update' when the API finish generating the msg/token
    const channel = supabase
      .channel('verifying-txns')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload) => {
          const txn = payload.new as Transaction;
          // If this txn is the one we are watching OR it's a new verifying one
          if (txn.verification_status === 'verifying') {
             setPendingTxn(txn);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel) }
  }, []);

  const handleReply = async (response: '1' | '2') => {
    if (!pendingTxn?.verification_token) return;
    setLoading(true);
    try {
      await fetch('/api/dev/simulate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: pendingTxn.verification_token, 
          response 
        })
      });
      setPendingTxn(null);
      setIsOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!pendingTxn && !isOpen) return null;

  return (
    <div className="fixed bottom-24 right-6 z-[100] font-sans">
      {/* Pulse Bubble */}
      {!isOpen && pendingTxn && (
        <button 
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-amber-500 rounded-full shadow-2xl flex items-center justify-center text-white 
            animate-bounce hover:scale-110 transition-transform relative border-4 border-white"
        >
          <span className="material-symbols-outlined text-2xl">sms</span>
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-sm">
            1
          </span>
          <div className="absolute inset-0 rounded-full animate-ping bg-amber-400 opacity-40"></div>
        </button>
      )}

      {/* Expanded Phone UI */}
      {isOpen && (
        <div className="w-[320px] bg-white rounded-[2.5rem] shadow-[0_32px_128px_-12px_rgba(0,0,0,0.3)] border-[12px] border-slate-900 overflow-hidden flex flex-col">
          {/* Status Bar */}
          <div className="h-10 bg-slate-900 flex justify-between items-center px-8 text-white/40 text-[10px] lowercase">
            <span>9:41</span>
            <div className="flex gap-1.5 items-center">
              <span className="material-symbols-outlined text-[10px]">signal_cellular_4_bar</span>
              <span className="material-symbols-outlined text-[10px]">wifi</span>
              <span className="material-symbols-outlined text-[10px]">battery_full</span>
            </div>
          </div>

          <div className="flex-1 p-6 bg-slate-50 flex flex-col space-y-4">
             {/* Header */}
             <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-black">VV</div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-tighter">Parchi Pay</h4>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">{t('sim_incoming')}</p>
                </div>
                <button onClick={() => setIsOpen(false)} className="ml-auto p-1.5 text-slate-400">
                  <span className="material-symbols-outlined text-sm font-bold">close</span>
                </button>
             </div>

             {/* The SMS Bubble */}
             <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm space-y-3">
               {!pendingTxn?.verification_msg ? (
                 <div className="space-y-2 animate-pulse">
                   <div className="h-3 bg-slate-100 rounded-full w-3/4"></div>
                   <div className="h-3 bg-slate-100 rounded-full w-1/2"></div>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest pt-2">{t('sim_generating')}</p>
                 </div>
               ) : (
                 <p className="text-[13px] text-slate-700 leading-relaxed font-medium italic whitespace-pre-wrap">
                  {pendingTxn.verification_msg}
                 </p>
               )}
               
               <div className="bg-slate-50 p-2 rounded-xl text-[10px] text-slate-400 font-mono flex items-center gap-2">
                 <span className="material-symbols-outlined text-[12px]">link</span>
                 {pendingTxn?.verification_token ? (
                   `Manual Link: v.vd.in/${pendingTxn.verification_token}`
                 ) : (
                   "Token Awaited..."
                 )}
               </div>
             </div>

             {/* Simulation Actions */}
             <div className="pt-4 grid grid-cols-2 gap-3">
               <button 
                 disabled={loading}
                 onClick={() => handleReply('1')}
                 className="py-4 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-700/20 active:scale-95 transition-all text-[11px] font-black uppercase tracking-widest disabled:opacity-50"
               >
                 {loading ? '...' : `✅ ${t('confirm')}`}
               </button>
               <button 
                 disabled={loading}
                 onClick={() => handleReply('2')}
                 className="py-4 bg-red-600 text-white rounded-2xl shadow-lg shadow-red-700/20 active:scale-95 transition-all text-[11px] font-black uppercase tracking-widest disabled:opacity-50"
               >
                 {loading ? '...' : `❌ ${t('cancel')}`}
               </button>
             </div>

             <div className="mt-auto text-center">
               <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest animate-pulse">
                {t('sim_loop_active')}
               </p>
             </div>
          </div>
          
          <div className="h-6 bg-slate-900 flex justify-center items-center">
            <div className="w-20 h-1 bg-white/20 rounded-full"></div>
          </div>
        </div>
      )}
    </div>
  );
}
