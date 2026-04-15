import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Worker, Transaction } from '@/types'

export interface WorkerSummary {
  worker: Worker
  totalDays: number        // sum of ATTENDANCE amounts
  totalAdvances: number    // sum of ADVANCE amounts (INR)
  totalPayments: number    // sum of PAYMENT amounts (INR)
  earnedWages: number
  wagesDue: number         // (totalDays × daily_rate) - totalAdvances - totalPayments (Wait, actual payments map to wage reduction if advances map to wage reduction. Usually WagesDue = Earned Wages - Advances - Payments)
  lastSeen: string | null
}

export function useWorkers(userId?: string | null) {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      const [{ data: wk }, { data: att }, { data: txn }] = await Promise.all([
        supabase.from('workers').select('*').eq('user_id', userId),
        supabase.from('attendance').select('*').eq('user_id', userId),
        supabase.from('transactions').select('*').eq('user_id', userId)
      ])

      if (wk) setWorkers(wk)
      if (att) setAttendance(att)
      if (txn) setTransactions(txn)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // matchWorker: Given an extracted name, finds matches in current cached workers
  const matchWorker = useCallback((extractedName: string) => {
    if (!extractedName) return { type: 'new', worker: null }
    
    const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ')
    const input = normalize(extractedName)
    
    const exact = workers.filter(w => normalize(w.name) === input)
    if (exact.length === 1) return { type: 'exact', worker: exact[0] }
    if (exact.length > 1) return { type: 'ambiguous', candidates: exact }
    
    const fuzzy = workers.filter(w => 
      normalize(w.name).startsWith(input) || 
      input.startsWith(normalize(w.name))
    )
    if (fuzzy.length === 1) return { type: 'fuzzy', worker: fuzzy[0] }
    if (fuzzy.length > 1) return { type: 'ambiguous', candidates: fuzzy }
    
    return { type: 'new', worker: null }
  }, [workers])

  // createWorker: Auto-generates a worker in DB
  const createWorker = useCallback(async (
    name: string, 
    qualifier: string | null = null, 
    dailyRate: number | null = null, 
    phone: string | null = null,
    language: string = 'en'
  ) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('workers')
      .insert({
        user_id: userId,
        name,
        qualifier,
        daily_rate: dailyRate,
        phone,
        language
      })
      .select('*')
      .single()
      
    if (!error && data) {
      setWorkers(prev => [data, ...prev])
      return data as Worker
    }
    return null
  }, [userId])

  // getWorkerSummaries: Compute the payroll view 
  const getWorkerSummaries = useCallback((): WorkerSummary[] => {
    return workers.map((w) => {
      // Standardize mapping: match by ID if possible, otherwise by name
      const px = transactions.filter(t => {
        if (!t) return false
        const matchesId = t.worker_id && String(t.worker_id).trim() === String(w.id).trim()
        const matchesName = t.name && String(t.name).toLowerCase() === String(w.name).toLowerCase()
        return !!(matchesId || matchesName)
      })
      
      // Calculate total days from actual attendance records
      const workerAtt = attendance.filter(a => a.worker_id === w.id)
      const totalDays = workerAtt.reduce((sum, a) => {
        const multiplier = a.status === 'present' ? 1 : a.status === 'half' ? 0.5 : 0
        return sum + multiplier
      }, 0)

      const totalAdvances = px.filter(t => t.action === 'ADVANCE' || t.action === 'UDHAAR').reduce((s, t) => s + t.amount, 0)
      const totalPayments = px.filter(t => t.action === 'PAYMENT').reduce((s, t) => s + t.amount, 0)
      
      // If daily_rate exists, wage earned = days * daily_rate
      const earnedWages = w.daily_rate ? (totalDays * w.daily_rate) : 0
      const wagesDue = earnedWages - totalAdvances - totalPayments

      // Get last seen transaction date
      const sortedPx = [...px].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const lastSeen = sortedPx.length > 0 ? sortedPx[0].created_at : (workerAtt.length > 0 ? workerAtt[0].date : null)

      return {
        worker: w,
        totalDays,
        totalAdvances,
        totalPayments,
        earnedWages,
        wagesDue,
        lastSeen,
      }
    })
  }, [workers, attendance, transactions])

  return { workers, loading, matchWorker, createWorker, getWorkerSummaries, refresh }
}
