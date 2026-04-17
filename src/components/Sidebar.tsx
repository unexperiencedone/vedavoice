'use client'

import { usePathname } from 'next/navigation'
import { useTranslation } from './LanguageProvider'
import { TranslationKey } from '@/lib/translations'

interface NavItem {
  href: string
  label: TranslationKey
  icon: string
}

const navItems: NavItem[] = [
  { href: '/',          label: 'nav_dashboard',  icon: 'dashboard'      },
  { href: '/hajiri',    label: 'nav_attendance', icon: 'fact_check'    },
  { href: '/workers',   label: 'nav_payroll',    icon: 'engineering'   },
  { href: '/saathi',    label: 'nav_assistant',  icon: 'query_stats'     },
  { href: '/khata',     label: 'nav_ledger',     icon: 'receipt_long'  },
  { href: '/settings',  label: 'nav_account',    icon: 'settings'      },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { t } = useTranslation()
  if (pathname === '/login') return null

  return (
    <>
      {/* Fixed sidebar */}
      <aside className="hidden md:flex flex-col w-60 min-h-screen fixed left-0 top-0
        bg-indigo-700 shadow-xl shadow-indigo-900/30 z-40">
        <div className="px-6 py-8 border-b border-indigo-600">
          <h1 className="font-headline font-extrabold text-xl text-white tracking-tight">
            Parchi
          </h1>
          <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-widest mt-0.5">Labour Ledger</p>
        </div>
        <nav className="flex-1 px-4 py-8 space-y-2">
          {navItems.map(item => {
            const isActive = pathname === item.href
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-sm
                  transition-all duration-200 font-label font-bold
                  ${isActive
                    ? 'bg-white/10 text-white shadow-lg shadow-indigo-900/40 ring-1 ring-white/20'
                    : 'text-indigo-200 hover:bg-white/5 hover:text-white'}`}
              >
                <span
                  className="material-symbols-outlined text-2xl"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {item.icon}
                </span>
                {t(item.label)}
              </a>
            )
          })}
        </nav>
      </aside>

      {/* Invisible spacer to offset content on desktop */}
      <div className="hidden md:block w-60 shrink-0" />
    </>
  )
}
