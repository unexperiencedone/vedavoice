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
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!userId) return // stay loading until auth resolves

    const [{ data: workerData }, { data: attData }, { data: txnData }] = await Promise.all([
      supabase.from('workers').select('*').eq('user_id', userId).order('name'),
      supabase.from('attendance').select('*').eq('user_id', userId),
      supabase.from('transactions').select('id,worker_id,name,action,amount,created_at').eq('user_id', userId)
    ])

    setWorkers(workerData || [])
    setAttendance(attData || [])
    setTransactions(txnData || [])
    setLoading(false)
  }, [userId, selectedDate])

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
      const record: AttendanceRecord = { worker_id, date: selectedDate, status, marked_via: via }
      if (idx >= 0) { const copy = [...prev]; copy[idx] = record; return copy }
      return [...prev, record]
    })

    const { error } = await supabase.from('attendance').upsert(
      { user_id: userId, worker_id, date: selectedDate, status, marked_via: via },
      { onConflict: 'worker_id,date' }
    )
    if (error) {
      console.error('[🚨 Supabase Attendance Upsert Error]', error)
      // Revert optimistic update
      setAttendance(prev => prev.filter(a => !(a.worker_id === worker_id && a.date === selectedDate && a.status === status)))
      // Trigger fetch to resync with server truth
      fetchAll()
    }
  }, [userId, selectedDate, fetchAll])

  const markAll = useCallback(async (status: AttendanceStatus) => {
    if (!userId || workers.length === 0) return
    await Promise.all(workers.map(w => markAttendance(w.id, status)))
  }, [userId, workers, markAttendance])

  const getStatus = useCallback((worker_id: string): AttendanceStatus | 'unmarked' => {
    return attendance.find(a => a.worker_id === worker_id)?.status ?? 'unmarked'
  }, [attendance])

  const summary = useMemo(() => {
    const selectedDateAtt = attendance.filter(a => a.date === selectedDate)
    const present = selectedDateAtt.filter(a => a.status === 'present').length
    const half = selectedDateAtt.filter(a => a.status === 'half').length
    const absent = selectedDateAtt.filter(a => a.status === 'absent').length
    return { present, half, absent, unmarked: workers.length - present - half - absent }
  }, [attendance, workers, selectedDate])

  const selectedDateWages = useMemo(() => {
    return workers.reduce((total, w) => {
      const record = attendance.find(a => a.worker_id === w.id && a.date === selectedDate)
      if (!record || record.status === 'absent') return total
      const multiplier = record.status === 'half' ? 0.5 : 1
      return total + ((w.daily_rate || 0) * multiplier)
    }, 0)
  }, [attendance, workers, selectedDate])

  const workerViews: WorkerAttendanceView[] = useMemo(() => {
    return workers.map(w => {
      const status = attendance.find(a => a.worker_id === w.id && a.date === selectedDate)?.status ?? 'unmarked'
      const multiplier = status === 'present' ? 1 : status === 'half' ? 0.5 : 0
      const wageToday = (w.daily_rate || 0) * multiplier

      // 1. Transactions for this worker - prioritize ID to prevent name leaks
      const workerTxns = transactions.filter(t => {
        if (t.worker_id) return t.worker_id === w.id
        return t.name?.toLowerCase() === w.name.toLowerCase()
      })
      
      // 2. Attendance history EXCEPT selectedDate
      const pastAtt = attendance.filter(a => a.worker_id === w.id && a.date < selectedDate)
      const pastEarned = pastAtt.reduce((sum, a) => {
        const m = a.status === 'present' ? 1 : a.status === 'half' ? 0.5 : 0
        return sum + ((w.daily_rate || 0) * m)
      }, 0)

      // 3. Transactions EXCEPT selectedDate (approximate by created_at)
      const pastTxns = workerTxns.filter(t => t.created_at.split('T')[0] < selectedDate)
      const pastAdvanced = pastTxns.filter(t => t.action === 'ADVANCE' || t.action === 'UDHAAR').reduce((s, t) => s + t.amount, 0)
      const pastPaid = pastTxns.filter(t => t.action === 'PAYMENT').reduce((s, t) => s + t.amount, 0)

      // 4. Opening Balance (Debt if negative)
      const openingBalance = pastEarned - pastAdvanced - pastPaid
      const openingDebt = openingBalance < 0 ? Math.abs(openingBalance) : 0

      // 5. Today's Net Payable (Current Pay minus existing debt)
      const netPayable = Math.max(0, wageToday + openingBalance)

      return { 
        worker: w, 
        status, 
        wageToday, 
        outstanding: openingDebt, 
        netPayable 
      }
    })
  }, [workers, attendance, transactions, selectedDate])

  return { workers, attendance, workerViews, loading, markAttendance, markAll, getStatus, summary, todayWages: selectedDateWages, refresh: fetchAll, selectedDate, setSelectedDate }
}
