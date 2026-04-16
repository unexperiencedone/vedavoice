'use client'

import { Transaction } from '@/types'
import VerificationBadge from './VerificationBadge'
import { useTranslation } from './LanguageProvider'
import { useTransliterate } from '@/hooks/useTransliterate'

interface TxnItemProps {
  transaction: Transaction
  onDelete?: (id: string) => void
}

export default function TxnItem({ transaction, onDelete }: TxnItemProps) {
  const { t } = useTranslation()
  const { transliterate } = useTransliterate([transaction.name])
  const isAdvance = transaction.action === 'ADVANCE' || transaction.action === 'UDHAAR'
  const isPayment = transaction.action === 'PAYMENT'
  const isAttendance = transaction.action === 'ATTENDANCE'

  const getStatusLabel = () => {
    if (isPayment) return t('status_payment')
    if (isAdvance) return t('status_advance')
    if (isAttendance) return t('status_attendance')
    return t('status_action')
  }

  const getTime = () => {
    const d = new Date(transaction.created_at)
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm flex items-start gap-4 transition-all hover:shadow-md hover:scale-[1.01] border border-outline-variant/10 group relative">
      <div className="mt-1 flex flex-col items-center">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center 
          ${isPayment ? 'bg-secondary-container' : isAdvance ? 'bg-tertiary-container' : 'bg-primary-container'}`}>
          <span className={`material-symbols-outlined text-sm 
            ${isPayment ? 'text-on-secondary-container' : isAdvance ? 'text-on-tertiary-container' : 'text-on-primary-container'}`} 
            style={{ fontVariationSettings: "'FILL' 1" }}>
            {isAttendance ? 'record_voice_over' : 'mic'}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-3 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <p className="font-bold text-on-surface text-sm truncate">"{transaction.transcript || `${transaction.action} for ${transaction.name}`}"</p>
            <p className="text-[10px] font-bold text-outline-variant uppercase tracking-widest mt-1 flex items-center gap-2">
              {getTime()} • {transliterate(transaction.name)}
              
              {/* Centralized Verification Badge */}
              { (transaction.action === 'PAYMENT' || transaction.action === 'ADVANCE') && (
                <VerificationBadge status={transaction.verification_status} size="sm" />
              )}
            </p>
          </div>
          
          <span className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-tight flex items-center gap-1.5
            ${isPayment ? 'bg-secondary-fixed/30 text-secondary' : isAdvance ? 'bg-tertiary-fixed/30 text-tertiary' : 'bg-primary-fixed/30 text-primary'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isPayment ? 'bg-secondary' : isAdvance ? 'bg-tertiary' : 'bg-primary'}`}></span>
            {getStatusLabel()}
          </span>
        </div>

        {/* Visual Waveform */}
        {!isAttendance && (
          <div className="flex items-end gap-1 h-6 opacity-60">
            {[0.4, 0.6, 0.2, 0.8, 0.5, 0.3, 0.7, 0.4, 0.9, 0.2].map((h, i) => (
              <span 
                key={i} 
                className={`w-1 bg-primary/40 rounded-full`} 
                style={{ height: `${h * 100}%` }}
              />
            ))}
          </div>
        )}

        {transaction.notes && (
          <p className="text-[11px] text-on-surface-variant mt-1.5 leading-relaxed italic border-t border-outline-variant/10 pt-1.5">
            💡 {transaction.notes}
          </p>
        )}
      </div>

      {/** Delete functionality removed per request */}
    </div>
  )
}