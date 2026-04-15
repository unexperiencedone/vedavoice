// ─────────────────────────────────────────────────────────────────────────────
// BottomNav.tsx — Localised navigation labels
// ─────────────────────────────────────────────────────────────────────────────
'use client'
import { useState } from 'react'
import { useTranslation } from './LanguageProvider'

const navIcons = [
  { key: 'nav_dashboard', icon: 'M3 9L11 3l8 6v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9z' },
  { key: 'nav_ledger',    icon: 'M4 4h16v16H4V4zm4 4h8m-8 4h8m-8 4h4' },
  { key: 'nav_payroll',   icon: 'M12 12c2.67 0 8 1.34 8 4v2H4v-2c0-2.66 5.33-4 8-4zm0-2a4 4 0 100-8 4 4 0 000 8z' },
  { key: 'nav_account',   icon: 'M12 4a8 8 0 100 16A8 8 0 0012 4zm0 6v2m0 4h.01' },
]

export default function BottomNav() {
  const { t } = useTranslation()
  const [active, setActive] = useState('nav_dashboard')

  return (
    <nav className="flex border-t border-gray-100 bg-white pb-safe">
      {navIcons.map(item => (
        <button key={item.key}
          onClick={() => setActive(item.key)}
          className="flex-1 flex flex-col items-center py-3 gap-1">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none"
            stroke={active === item.key ? '#4338ca' : '#9ca3af'} strokeWidth="1.5">
            <path d={item.icon} strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className={`text-xs ${active === item.key ? 'text-indigo-700 font-medium' : 'text-gray-400'}`}>
            {t(item.key as any)}
          </span>
        </button>
      ))}
    </nav>
  )
}