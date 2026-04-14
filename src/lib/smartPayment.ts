import { supabase } from './supabase'

export interface WorkerFinancials {
  earnedWages: number      // attendance days × daily_rate
  totalAdvances: number    // sum of ADVANCE transactions
  totalPayments: number    // sum of PAYMENT transactions
  netOwed: number          // earnedWages - totalAdvances - totalPayments
  attendanceDays: number
}

export interface SmartClassification {
  type: 'PAYMENT' | 'ADVANCE' | 'SPLIT'
  // For PAYMENT or ADVANCE (single transaction)
  action?: 'PAYMENT' | 'ADVANCE'
  amount?: number
  notes?: string
  // For SPLIT (two transactions)
  paymentAmount?: number
  paymentNotes?: string
  advanceAmount?: number
  advanceNotes?: string
}

/**
 * Fetch a worker's current financial state from DB.
 * Matches by worker_id first, falls back to name.
 */
export async function fetchWorkerFinancials(
  userId: string,
  workerId: string | null,
  workerName: string,
  dailyRate: number
): Promise<WorkerFinancials> {
  const [{ data: txns }, { data: att }] = await Promise.all([
    supabase
      .from('transactions')
      .select('action, amount, worker_id, name')
      .eq('user_id', userId),
    supabase
      .from('attendance')
      .select('status, worker_id')
      .eq('user_id', userId)
  ])

  const allTxns = txns || []
  const allAtt = att || []

  // Match transactions
  const workerTxns = allTxns.filter(t =>
    (workerId && t.worker_id === workerId) ||
    t.name?.toLowerCase() === workerName.toLowerCase()
  )

  // Match attendance
  const workerAtt = workerId
    ? allAtt.filter(a => a.worker_id === workerId)
    : []

  const attendanceDays = workerAtt.reduce((s, a) => {
    if (a.status === 'present') return s + 1
    if (a.status === 'half') return s + 0.5
    return s
  }, 0)

  const earnedWages = attendanceDays * dailyRate

  const totalAdvances = workerTxns
    .filter(t => t.action === 'ADVANCE')
    .reduce((s, t) => s + Math.abs(t.amount || 0), 0)

  const totalPayments = workerTxns
    .filter(t => t.action === 'PAYMENT')
    .reduce((s, t) => s + Math.abs(t.amount || 0), 0)

  const netOwed = earnedWages - totalAdvances - totalPayments

  return { earnedWages, totalAdvances, totalPayments, netOwed, attendanceDays }
}

/**
 * Smart classify a payment/advance intent.
 * Given the amount paid, figures out the real intent from DB context.
 */
export function classifyPayment(
  amount: number,
  financials: WorkerFinancials
): SmartClassification {
  const { earnedWages, netOwed, attendanceDays } = financials

  // Case A: No attendance at all → it's a pure advance
  if (attendanceDays === 0) {
    return {
      type: 'ADVANCE',
      action: 'ADVANCE',
      amount,
      notes: `Koi attendance record nahi — advance ke roop mein rakha gaya`
    }
  }

  // Case B: Amount matches net owed exactly → full settlement
  if (Math.abs(amount - netOwed) <= 1) {
    return {
      type: 'PAYMENT',
      action: 'PAYMENT',
      amount,
      notes: `Poori settlement — ₹${netOwed.toFixed(0)} earned wages ka full payment`
    }
  }

  // Case C: Amount > net owed → split into payment + advance
  if (amount > netOwed && netOwed > 0) {
    const advanceAmount = amount - netOwed
    return {
      type: 'SPLIT',
      paymentAmount: netOwed,
      paymentNotes: `Earned wages ka payment (${attendanceDays} din × ₹${(earningsPerDay(earnedWages, attendanceDays)).toFixed(0)})`,
      advanceAmount,
      advanceNotes: `₹${netOwed.toFixed(0)} wages se zyada diya — ₹${advanceAmount} advance ke roop mein rakha gaya`
    }
  }

  // Case D: Amount < net owed → partial payment, show remaining
  const remaining = netOwed - amount
  return {
    type: 'PAYMENT',
    action: 'PAYMENT',
    amount,
    notes: `Partial payment — ₹${remaining.toFixed(0)} abhi bhi baaki hai`
  }
}

function earningsPerDay(earned: number, days: number): number {
  return days > 0 ? earned / days : 0
}
