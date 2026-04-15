export type ActionType = 
  | 'UDHAAR'
  | 'PAYMENT'
  | 'ADVANCE'
  | 'RECEIPT'
  | 'MATERIAL'
  | 'ATTENDANCE'
  | 'UNKNOWN'

export type UnitType = 'INR' | 'days'

export interface Worker {
  id: string
  user_id: string
  name: string
  qualifier: string | null
  daily_rate: number | null
  phone: string | null
  created_at: string
}
 
export interface Transaction {
  id: string
  user_id: string
  worker_id?: string | null
  name: string
  qualifier?: string | null
  amount: number
  amount_raw: string | null
  unit: UnitType
  action: ActionType
  confidence: number
  transcript: string
  notes?: string | null
  verification_status?: 'verifying' | 'confirmed' | 'flagged' | null
  verification_token?: string | null
  verification_msg?: string | null
  verified_at?: string | null
  created_at: string
}
 
export interface ExtractResult {
  name: string | null
  qualifier: string | null
  amount_raw: string | null
  amount_int: number | null
  unit: UnitType
  action: ActionType
  confidence: number
  notes?: string | null
  raw: object[]
}

export interface Shop {
  id: string
  user_id: string
  shop_name: string
  owner_name: string
  phone: string | null
  created_at: string
}

export interface Prediction {
  id: string
  user_id: string
  transcript: string
  predicted_name: string | null
  predicted_amount: number | null
  predicted_action: ActionType
  confidence: number
  is_correct: boolean
  corrected_name?: string | null
  raw_output: any
  created_at: string
}

export interface Customer {
  name: string
  total_udhaar: number
  total_payment: number
  net_balance: number
  last_txn: string
  txn_count: number
}
 
