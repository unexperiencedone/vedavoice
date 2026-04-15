"use client";

import { useState, useMemo, useEffect } from "react";
import { useLedger } from "@/hooks/useLedger";
import { useAuth } from "@/hooks/useAuth";
import { Transaction } from "@/types";
import { useWorkers } from "@/hooks/useWorkers";
import { supabase } from "@/lib/supabase";
import VerificationBadge from "@/components/VerificationBadge";

type ActionFilter = "ALL" | "ADVANCE" | "PAYMENT";
type TimeFilter = "TODAY" | "WEEK" | "MONTH" | "ALL";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Abhi";
  if (mins < 60) return `${mins} min pehle`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ghante pehle`;
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function KhataPage() {
  const auth = useAuth();
  const { transactions, loading: ledgerLoading } = useLedger(auth?.id);

  const [workers, setWorkers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<ActionFilter>("ALL");
  const [timeRange, setTimeRange] = useState<TimeFilter>("ALL");
  const [search, setSearch] = useState("");

  // 1. Fetch site context
  useEffect(() => {
    if (!auth?.id) return;
    const fetchData = async () => {
      const [{ data: wk }, { data: att }] = await Promise.all([
        supabase.from("workers").select("*").eq("user_id", auth.id),
        supabase.from("attendance").select("*").eq("user_id", auth.id),
      ]);
      if (wk) setWorkers(wk);
      if (att) setAttendance(att);
      setLoading(false);
    };
    fetchData();
  }, [auth?.id]);

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const startOfThisWeek = now.getTime() - now.getDay() * 24 * 60 * 60 * 1000;
    const startOfThisMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).getTime();

    // A. Filter Transactions
    const txns = transactions.filter((t) => {
      const actionMatches =
        filter === "ALL" ||
        (filter === "ADVANCE" &&
          (t.action === "ADVANCE" || t.action === "UDHAAR")) ||
        (filter === "PAYMENT" && t.action === "PAYMENT");
      const searchMatches = t.name.toLowerCase().includes(search.toLowerCase());
      const tDate = new Date(t.created_at).getTime();
      let timeMatches = true;
      if (timeRange === "TODAY") timeMatches = tDate >= startOfToday;
      if (timeRange === "WEEK") timeMatches = tDate >= startOfThisWeek;
      if (timeRange === "MONTH") timeMatches = tDate >= startOfThisMonth;
      return actionMatches && searchMatches && timeMatches;
    });

    // B. Calculate Gross Mazdoori for the SAME time range
    const filteredAtt = attendance.filter((a) => {
      const aDate = new Date(a.date).getTime();
      if (timeRange === "TODAY") return aDate >= startOfToday;
      if (timeRange === "WEEK") return aDate >= startOfThisWeek;
      if (timeRange === "MONTH") return aDate >= startOfThisMonth;
      return true;
    });

    const totalGross = filteredAtt.reduce((sum, a) => {
      const w = workers.find((w) => w.id === a.worker_id);
      if (!w) return sum;
      const m = a.status === "present" ? 1 : a.status === "half" ? 0.5 : 0;
      return sum + (w.daily_rate || 0) * m;
    }, 0);

    const totalAdv = txns
      .filter((t) => t.action === "ADVANCE" || t.action === "UDHAAR")
      .reduce((s, t) => s + t.amount, 0);

    const totalPaid = txns
      .filter((t) => t.action === "PAYMENT")
      .reduce((s, t) => s + t.amount, 0);

    return { txns, totalGross, totalAdv, totalPaid };
  }, [transactions, attendance, workers, filter, timeRange, search]);

  const { txns, totalGross, totalAdv, totalPaid } = filtered;
  const netPayable = totalGross - totalAdv - totalPaid;

  // ── CSV Export ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const label = timeRange === 'TODAY' ? 'Aaj' : timeRange === 'WEEK' ? 'Hafta' : timeRange === 'MONTH' ? 'Mahina' : 'Full'
    const rows = [
      ['Date', 'Time', 'Mazdoor Naam', 'Action', 'Amount (INR)', 'Voice Transcript', 'Week'],
      ...txns.map(t => {
        const d = new Date(t.created_at)
        return [
          d.toLocaleDateString('en-IN'),
          d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          t.name,
          t.action,
          t.amount,
          t.verification_status || 'N/A',
          `"${(t.transcript || '').replace(/"/g, "'")}"`
        ]
      }),
      [],
      ['', '', '', 'Kul Mehantana', totalGross],
      ['', '', '', 'Pura Advance', totalAdv],
      ['', '', '', 'Bhugtan (Paid)', totalPaid],
      ['', '', '', 'Dena Baki', netPayable],
    ]
    const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\n')  // BOM for Excel Hindi support
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `VedaVoice_Ledger_${label}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-indigo-700 md:bg-transparent sticky md:relative top-0 z-40 shadow-lg md:shadow-none shadow-indigo-900/20">
        <div className="flex justify-between items-center px-6 md:px-8 py-4">
          <div className="flex items-center gap-3">
            {auth?.avatarUrl ? (
              <img
                src={auth.avatarUrl}
                alt={auth.name}
                className="w-10 h-10 md:hidden rounded-full object-cover border-2 border-indigo-400"
              />
            ) : (
              <div
                className="w-10 h-10 md:hidden rounded-full bg-indigo-500 border-2 border-indigo-400
                flex items-center justify-center text-white font-headline font-bold text-sm"
              >
                {auth?.name?.[0]?.toUpperCase() ?? "D"}
              </div>
            )}
            <div>
              <h1 className="font-headline font-bold text-xl text-white md:text-on-surface">
                Audit Khata
              </h1>
              <p className="text-indigo-200 md:text-on-surface-variant text-xs">
                Full Payment History
              </p>
            </div>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 bg-white/10 md:bg-emerald-50 hover:bg-white/20 md:hover:bg-emerald-100 text-white md:text-emerald-700 px-4 py-2 rounded-xl font-headline font-bold text-xs uppercase tracking-widest transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">table_view</span>
            <span className="hidden sm:inline">Export Excel</span>
          </button>
        </div>

        {/* Global Dispute Warning Banner - Subtle Aesthetic */}
        {txns.some(t => t.verification_status === 'flagged') && (
          <div className="mx-6 md:mx-8 mb-4 bg-red-50 text-red-800 px-4 py-3 rounded-2xl flex items-center gap-3 border border-red-200 shadow-sm transition-all animate-pulse">
            <span className="material-symbols-outlined text-xl text-red-600" style={{ fontVariationSettings: "'FILL' 1" }}>report</span>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-wider">Site Audit Notice</p>
              <p className="text-[10px] opacity-80 font-bold leading-tight">
                Disputes detected. Workers have flagged some payments. Please verify receipts manually.
              </p>
            </div>
          </div>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 md:px-8 pb-5">
          <div className="bg-white/10 md:bg-surface-container-lowest backdrop-blur-md rounded-xl p-4 border border-white/10 md:border-outline-variant/20 md:shadow-sm transition-all duration-300">
            <span className="text-indigo-100 md:text-outline font-label text-[10px] uppercase tracking-wider font-bold block">
              KUL MEHANTANA
            </span>
            <span className="text-white md:text-on-surface text-xl font-headline font-extrabold mt-1 block tracking-tight">
              ₹{totalGross.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="bg-white/10 md:bg-surface-container-lowest backdrop-blur-md rounded-xl p-4 border border-white/10 md:border-outline-variant/20 md:shadow-sm transition-all duration-300">
            <span className="text-indigo-100 md:text-outline font-label text-[10px] uppercase tracking-wider font-bold block">
              Pura Advance (-)
            </span>
            <span className="text-white md:text-amber-600 text-xl font-headline font-extrabold mt-1 block tracking-tight">
              ₹{totalAdv.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="bg-white/10 md:bg-surface-container-lowest backdrop-blur-md rounded-xl p-4 border border-white/10 md:border-outline-variant/20 md:shadow-sm transition-all duration-300">
            <span className="text-indigo-100 md:text-outline font-label text-[10px] uppercase tracking-wider font-bold block">
              Bhugtan (Paid) (-)
            </span>
            <span className="text-white md:text-emerald-600 text-xl font-headline font-extrabold mt-1 block tracking-tight">
              ₹{totalPaid.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="bg-white/10 md:bg-surface-container-lowest backdrop-blur-md rounded-xl p-4 border border-white/10 md:border-outline-variant/20 md:shadow-sm transition-all duration-300 ring-2 ring-primary/20">
            <span className="text-indigo-100 md:text-outline font-label text-[10px] uppercase tracking-wider font-bold block">
              Dena Baki (=)
            </span>
            <span className="text-white md:text-primary text-xl font-headline font-extrabold mt-1 block tracking-tight">
              ₹{netPayable.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      </header>

      <main className="px-6 max-w-2xl mx-auto -mt-0">
        {/* Search */}
        <div className="relative mt-6 mb-5">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-outline">
            <span className="material-symbols-outlined">search</span>
          </div>
          <input
            type="text"
            placeholder="Mazdoor ka naam khojein..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-container-lowest rounded-full h-14 pl-12 pr-4
              shadow-sm outline-none focus:ring-2 focus:ring-primary/20 text-on-surface
              placeholder:text-outline/60 transition-all"
          />
        </div>

        <div className="flex gap-2 mb-4">
          {(["ALL", "ADVANCE", "PAYMENT"] as ActionFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2 rounded-full font-label text-[11px] font-black tracking-widest uppercase transition-all active:scale-95
                ${
                  filter === f
                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                    : "bg-white border border-outline-variant/30 text-outline"
                }`}
            >
              {f === "ALL" ? "Sab" : f === "ADVANCE" ? "Advance" : "Payment"}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto pb-1 hide-scrollbar">
          {(["TODAY", "WEEK", "MONTH", "ALL"] as TimeFilter[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeRange(tf)}
              className={`px-4 py-1.5 rounded-lg font-label text-[10px] font-bold uppercase tracking-wider transition-all
                ${
                  timeRange === tf
                    ? "bg-secondary text-on-secondary ring-2 ring-secondary/20"
                    : "bg-surface-container-low text-outline/80 border border-transparent"
                }`}
            >
              {tf === "TODAY"
                ? "Aaj"
                : tf === "WEEK"
                  ? "Hafta"
                  : tf === "MONTH"
                    ? "Mahina"
                    : "Hamesha"}
            </button>
          ))}
        </div>

        {/* Transaction list */}
        <div>
          <h2 className="text-outline font-label text-xs uppercase tracking-[0.15em] font-bold mb-6">
            Audit Trail
          </h2>
          {ledgerLoading || loading ? (
            <div className="space-y-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-surface-container animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-surface-container animate-pulse rounded-full w-2/3" />
                    <div className="h-3 bg-surface-container animate-pulse rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : txns.length === 0 ? (
            <div className="text-center mt-16">
              <span className="material-symbols-outlined text-5xl text-outline opacity-30 block mb-3">
                receipt_long
              </span>
              <p className="text-on-surface-variant text-sm">
                {search
                  ? `"${search}" ke liye koi transaction nahi mila`
                  : "Koi transaction nahi is time range mein"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {txns.map((txn) => (
                <TxnRow key={txn.id} txn={txn} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Floating mic */}
      <div className="fixed bottom-8 right-8 z-50">
        <button
          className="w-16 h-16 rounded-full mic-gradient flex items-center justify-center text-white active:scale-90 transition-transform shadow-2xl"
          style={{ boxShadow: "0 10px 30px rgba(42,20,180,0.3)" }}
        >
          <span
            className="material-symbols-outlined text-2xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            mic
          </span>
        </button>
      </div>
    </div>
  );
}

function TxnRow({ txn }: { txn: Transaction }) {
  const isUdhaar = txn.action === "UDHAAR" || txn.action === "ADVANCE";
  function initials(name: string) {
    return name
      .split(" ")
      .map((w: string) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center
          text-primary font-headline font-bold text-base shrink-0"
        >
          {initials(txn.name)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-headline font-bold text-base text-on-surface">
              {txn.name}
            </span>
            <VerificationBadge status={txn.verification_status} size="sm" />
          </div>
          <span className="text-on-surface-variant text-sm italic truncate max-w-[180px] block opacity-70">
            "{txn.transcript}"
          </span>
          <span className="text-outline text-[10px] mt-0.5 block font-bold uppercase tracking-wider">
            {timeAgo(txn.created_at)}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
        <span
          className={`font-headline font-extrabold text-lg ${isUdhaar ? "text-amber-600" : "text-emerald-600"}`}
        >
          {isUdhaar ? "−" : "+"}₹{txn.amount.toLocaleString("en-IN")}
        </span>
        <span
          className={`px-2 py-0.5 text-[9px] font-black font-label rounded uppercase tracking-widest
          ${isUdhaar ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
        >
          {txn.action}
        </span>
      </div>
    </div>
  );
}
