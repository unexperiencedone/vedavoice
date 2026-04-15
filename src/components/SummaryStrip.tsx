'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { useTranslation } from './LanguageProvider'

export interface SummaryStats {
  workValue: number      // Kul Mazdoori
  paid: number           // Bhugtan
  advances: number       // Advance
  netDue: number         // Baki Hisaab
  workers: number
  safety: number
  trend: number
}

export default function SummaryStrip({ stats }: { stats: SummaryStats }) {
  const { t } = useTranslation()
  const percentPaid = stats.workValue > 0 ? (stats.paid / stats.workValue) * 100 : 0
  const isTrendUp = stats.trend > 0
  const isTrendZero = stats.trend === 0

  return (
    <section className="relative">
      <div className="glass-card rounded-3xl p-8 text-white shadow-2xl overflow-hidden min-h-[220px]">
        {/* Abstract background icon */}
        <div className="absolute top-0 right-0 opacity-10 -mr-16 -mt-16 pointer-events-none">
          <span className="material-symbols-outlined text-[240px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            monitoring
          </span>
        </div>

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
            <div className="space-y-1">
              <p className="font-headline font-bold text-primary-fixed/80 text-xs tracking-[0.2em] uppercase">
                {t('work_value')}
              </p>
              <h1 className="text-5xl font-extrabold font-headline tracking-tighter">
                ₹{stats.workValue.toLocaleString('en-IN')}
              </h1>
              
              <div className="flex items-center gap-2 mt-3">
                <span className={`material-symbols-outlined text-sm ${isTrendUp ? 'text-secondary-fixed' : isTrendZero ? 'text-white/40' : 'text-error'}`}>
                  {isTrendUp ? 'trending_up' : isTrendZero ? 'horizontal_rule' : 'trending_down'}
                </span>
                <span className={`text-xs font-bold tracking-wide uppercase ${isTrendUp ? 'text-secondary-fixed' : isTrendZero ? 'text-white/40' : 'text-error'}`}>
                  {isTrendZero ? t('trend_no_change') : `${Math.abs(stats.trend)}% ${t('vs_last_week')}`}
                </span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 min-w-[300px] shadow-inner text-right md:text-left">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-[0.15em] opacity-60 mb-1 font-label">
                    {t('net_due')}
                  </p>
                  <p className="text-4xl font-extrabold font-headline tracking-tight">
                    ₹{stats.netDue.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold tracking-[0.15em] opacity-60 mb-1 font-label">
                    {t('site_safety')}
                  </p>
                  <p className="text-xl font-extrabold font-headline text-secondary-fixed">
                    {stats.safety}%
                  </p>
                </div>
              </div>
              
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden mt-4">
                <div 
                  className="h-full bg-secondary-fixed rounded-full transition-all duration-1000" 
                  style={{ width: `${Math.min(100, percentPaid)}%` }}
                />
              </div>
              <p className="text-[10px] mt-3 opacity-70 font-medium text-right md:text-left">
               {t('total_advance')}: ₹{stats.advances.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}