'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Worker } from '@/types'

export type AttendanceStatus = 'present' | 'half' | 'absent'

export interface AttendanceRecord {
  id?: string
  worker_id: string
  date: string
  status: AttendanceStatus
  marked_via: 'manual' | 'voice'
}

export interface WorkerAttendanceView {
  worker: Worker
  status: AttendanceStatus | 'unmarked'
  wageToday: number       // daily_rate × multiplier (1 / 0.5 / 0)
  outstanding: number     // total advances – total payments (what's already owed TO worker)
  netPayable: number      // wageToday – outstanding  (what contractor still needs to pay today)
}

export function useAttendance(userId?: string | null) {
  const today = new Date().toISOString().split('T')[0]
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!userId) return // stay loading until auth resolves

    const [{ data: workerData }, { data: attData }, { data: txnData }] = await Promise.all([
      supabase.from('workers').select('*').eq('user_id', userId).order('name'),
      supabase.from('attendance').select('*').eq('user_id', userId).eq('date', today),
      supabase.from('transactions').select('id,worker_id,name,action,amount').eq('user_id', userId)
    ])

    setWorkers(workerData || [])
    setAttendance(attData || [])
    setTransactions(txnData || [])
    setLoading(false)
  }, [userId, today])

  // fetchAll already depends on userId via useCallback — re-runs automatically when auth resolves
  useEffect(() => { fetchAll() }, [fetchAll])

  const markAttendance = useCallback(async (
    worker_id: string,
    status: AttendanceStatus,
    via: 'manual' | 'voice' = 'manual'
  ) => {
    if (!userId) return

    // Optimistic update
    setAttendance(prev => {
      const idx = prev.findIndex(a => a.worker_id === worker_id)
      const record: AttendanceRecord = { worker_id, date: today, status, marked_via: via }
      if (idx >= 0) { const copy = [...prev]; copy[idx] = record; return copy }
      return [...prev, record]
    })

    const { error } = await supabase.from('attendance').upsert(
      { user_id: userId, worker_id, date: today, status, marked_via: via },
      { onConflict: 'worker_id,date' }
    )
    if (error) {
      console.error('[🚨 Supabase Attendance Upsert Error]', error)
      // Revert optimistic update
      setAttendance(prev => prev.filter(a => !(a.worker_id === worker_id && a.date === today && a.status === status)))
      // Trigger fetch to resync with server truth
      fetchAll()
    }
  }, [userId, today, fetchAll])

  const markAll = useCallback(async (status: AttendanceStatus) => {
    if (!userId || workers.length === 0) return
    await Promise.all(workers.map(w => markAttendance(w.id, status)))
  }, [userId, workers, markAttendance])

  const getStatus = useCallback((worker_id: string): AttendanceStatus | 'unmarked' => {
    return attendance.find(a => a.worker_id === worker_id)?.status ?? 'unmarked'
  }, [attendance])

  const summary = useMemo(() => {
    const present = attendance.filter(a => a.status === 'present').length
    const half = attendance.filter(a => a.status === 'half').length
    const absent = attendance.filter(a => a.status === 'absent').length
    return { present, half, absent, unmarked: workers.length - present - half - absent }
  }, [attendance, workers])

  const todayWages = useMemo(() => {
    return workers.reduce((total, w) => {
      const status = attendance.find(a => a.worker_id === w.id)?.status
      if (!status || status === 'absent') return total
      const multiplier = status === 'half' ? 0.5 : 1
      return total + ((w.daily_rate || 0) * multiplier)
    }, 0)
  }, [attendance, workers])

  const workerViews: WorkerAttendanceView[] = useMemo(() => {
    return workers.map(w => {
      const status = attendance.find(a => a.worker_id === w.id)?.status ?? 'unmarked'
      const multiplier = status === 'present' ? 1 : status === 'half' ? 0.5 : 0
      const wageToday = (w.daily_rate || 0) * multiplier

      // Match by worker_id first, then fall back to name (even if another worker_id exists)
      const workerTxns = transactions.filter(t =>
        t.worker_id === w.id || t.name?.toLowerCase() === w.name.toLowerCase()
      )
      // Only ADVANCE transactions are deductible from today's daily wage
      const pendingAdvances = workerTxns
        .filter(t => t.action === 'ADVANCE')
        .reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0)

      const netPayable = Math.max(0, wageToday - pendingAdvances)  // never go negative

      return { worker: w, status, wageToday, outstanding: pendingAdvances, netPayable }
    })
  }, [workers, attendance, transactions])

  return { workers, attendance, workerViews, loading, markAttendance, markAll, getStatus, summary, todayWages, refresh: fetchAll }
}
