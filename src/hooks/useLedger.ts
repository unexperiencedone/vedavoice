'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Transaction, ExtractResult } from '@/types'
import { calculateFinance, calculateSiteSafety, calculateTrend, AttendanceRecord } from '@/lib/finance'

export function useLedger(userId?: string) {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)

    // ── Initial fetch ────────────────────────────────────────────────────────
    const fetchTransactions = useCallback(async () => {
        if (!userId) {
            setLoading(false)
            return
        }

        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

        if (!error && data) setTransactions(data)
        setLoading(false)
    }, [userId])

    useEffect(() => {
        fetchTransactions()
    }, [fetchTransactions])

    // ── Realtime subscription ─────────────────────────────────────────────────
    useEffect(() => {
        if (!userId) return

        const channel = supabase
            .channel(`transactions-${userId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
                (payload) => {
                    setTransactions(prev => [payload.new as Transaction, ...prev])
                }
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [userId])

    // ── Trigger Outbound SMS Verification ─────────────────────────────────────
    async function triggerVerification(txn: Transaction, phone: string) {
        try {
            await fetch('/api/sms/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    txnId: txn.id, 
                    phone, 
                    name: txn.name, 
                    amount: txn.amount 
                })
            })
        } catch (e) {
            console.error('Failed to trigger SMS verification:', e)
        }
    }

    // ── Add confirmed transaction to ledger ───────────────────────────────────
    async function addTransaction(result: ExtractResult, transcript: string, worker_id?: string | null, skipSms = false) {
        if (!result.name || !result.amount_int) return null

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not logged in')

        // Map UDHAAR to ADVANCE for professional terminology
        const finalAction = result.action === 'UDHAAR' ? 'ADVANCE' : result.action;

        // Trigger SMS for Payments, Advances, and Receipts
        const isVerifyNeeded = finalAction === 'PAYMENT' || finalAction === 'ADVANCE' || finalAction === 'RECEIPT';

        const { data, error } = await supabase
            .from('transactions')
            .insert({
                user_id: user.id,
                worker_id: worker_id || null,
                name: result.name,
                qualifier: result.qualifier || null,
                amount: result.amount_int,
                amount_raw: result.amount_raw,
                unit: result.unit ?? 'INR',
                action: finalAction,
                confidence: result.confidence,
                transcript,
                notes: result.notes || null,
                verification_status: isVerifyNeeded ? 'verifying' : null,
            })
            .select()
            .single()

        if (error) throw error;
        const txn = data as Transaction;

        // Auto-trigger SMS if needed
        if (isVerifyNeeded && !skipSms) {
            let phone = '+91 00000 00000'; // Demo Fallback
            
            if (worker_id) {
                const { data: wk } = await supabase.from('workers').select('phone').eq('id', worker_id).single();
                if (wk?.phone) phone = wk.phone;
            }

            // Always trigger for simulation/production
            triggerVerification(txn, phone);
        }

        return txn;
    }

    // ── Save every prediction for retraining later ────────────────────────────
    async function savePrediction(
        result: ExtractResult,
        transcript: string,
        confirmed: boolean,
    ) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase.from('predictions').insert({
            user_id: user.id,
            transcript,
            predicted_name: result.name,
            predicted_amount: result.amount_int,
            predicted_action: result.action,
            confidence: result.confidence,
            is_correct: confirmed,
            raw_output: result.raw,
        })
    }


    // ── Integrated Labour Stats ───────────────────────────────────────────
    const [stats, setStats] = useState({ 
        workValue: 0, 
        paid: 0, 
        advances: 0, 
        netDue: 0, 
        workers: 0, 
        safety: 100, 
        trend: 0 
    })

    const calculateLabourStats = useCallback(async () => {
        if (!userId) return

        const now = new Date()
        const todayStr = now.toISOString().split('T')[0]
        
        const startOfThisWeek = new Date(now)
        startOfThisWeek.setDate(now.getDate() - now.getDay())
        startOfThisWeek.setHours(0,0,0,0)

        const startOfLastWeek = new Date(startOfThisWeek)
        startOfLastWeek.setDate(startOfThisWeek.getDate() - 7)

        // 1. Fetch Workers
        const { data: wk } = await supabase.from('workers').select('id, name, daily_rate').eq('user_id', userId)
        if (!wk) return

        // 2. Fetch All Attendance (for Baki) and All Transactions (for Baki)
        const [{ data: allAtt }, { data: allTxn }] = await Promise.all([
          supabase.from('attendance').select('*').eq('user_id', userId),
          supabase.from('transactions').select('*').eq('user_id', userId)
        ])

        const att = allAtt || []
        const txn = allTxn || []

        // 3. Weekly Filters
        const thisWeekAtt = att.filter(a => a.date >= startOfThisWeek.toISOString().split('T')[0])
        const lastWeekAtt = att.filter(a => a.date >= startOfLastWeek.toISOString().split('T')[0] && a.date < startOfThisWeek.toISOString().split('T')[0])
        
        const thisWeekTxn = txn.filter(t => t.created_at >= startOfThisWeek.toISOString())
        const lastWeekTxn = txn.filter(t => t.created_at >= startOfLastWeek.toISOString() && t.created_at < startOfThisWeek.toISOString())

        // 4. Lifetime Calculations (The "Baki")
        const lifetime = calculateFinance(wk, att as AttendanceRecord[], txn as Transaction[])
        
        // 5. Weekly Calculations (The "Mazdoori")
        const current = calculateFinance(wk, thisWeekAtt as AttendanceRecord[], thisWeekTxn as Transaction[])
        const previous = calculateFinance(wk, lastWeekAtt as AttendanceRecord[], lastWeekTxn as Transaction[])
        
        // Site Safety (Today's check-ins)
        const todayAtt = att.filter(a => a.date === todayStr)
        const presentToday = todayAtt.filter(a => a.status === 'present' || a.status === 'half').length
        const safety = calculateSiteSafety(wk.length, presentToday)
        
        // Trend (Value of work done this week vs last)
        const trend = calculateTrend(current.workValue, previous.workValue)

        setStats({ 
            workValue: current.workValue, 
            paid: current.paidOut, // Show weekly paid for coverage bar
            advances: lifetime.advances, 
            netDue: lifetime.netDue,
            workers: wk.length,
            safety,
            trend
        })
    }, [userId])

    useEffect(() => {
        calculateLabourStats()
    }, [calculateLabourStats, transactions]) // Re-calc when txns change

    // ── Summary stats ─────────────────────────────────────────────────────────
    const totalUdhaar = transactions
        .filter(t => t.action === 'UDHAAR' || t.action === 'ADVANCE' || t.action === 'MATERIAL')
        .reduce((sum, t) => sum + t.amount, 0)

    const today = new Date().toDateString()
    const todayMila = transactions
        .filter(t => (t.action === 'PAYMENT' || t.action === 'RECEIPT') && new Date(t.created_at).toDateString() === today)
        .reduce((sum, t) => sum + t.amount, 0)

    const uniqueCustomers = new Set(transactions.map(t => t.name)).size

    // ── Delete Transaction ──────────────────────────────────────────────────
    async function deleteTransaction(id: string) {
        setTransactions(prev => prev.filter(t => t.id !== id))
        const { error } = await supabase.from('transactions').delete().eq('id', id)
        if (error) {
            fetchTransactions() // Rollback on error
            throw error
        }
    }

    return {
        transactions,
        loading,
        addTransaction,
        savePrediction,
        totalUdhaar,
        todayMila,
        uniqueCustomers,
        stats, // New integrated stats: { earned, paid, advances, workers }
        triggerVerification,
        deleteTransaction,
        refreshStats: calculateLabourStats
    }
}