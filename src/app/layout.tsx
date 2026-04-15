import type { Metadata } from 'next'
import './globals.css'
import BottomNavWrapper from '@/components/BottomNavWrapper'
import Sidebar from '@/components/Sidebar'
import DevSimulator from '@/components/DevSimulator'

export const metadata: Metadata = {
  title:       'VedaVoice — Payroll & Site Safety',
  description: 'Voice-First Payroll & Duality Safety AI',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="bg-background text-on-surface min-h-screen">
        
        {/* Persistent TopAppBar Shell */}
        <header className="fixed top-0 w-full flex justify-between items-center px-6 py-4 bg-slate-50/80 backdrop-blur-xl shadow-sm z-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-fixed shadow-md">
              <img 
                alt="Supervisor Profile" 
                className="w-full h-full object-cover" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBnuRJhwTQqzIrQlwNsNVXhsSOW20BXFHFl1hgglsj4xz1omYcQzfJXNIx8QY4XLlGaiMA00KK9uYUtgtuNgQvwluwP0OZCDKTPkYF2ycOUkSzePeXjkQpcK2H9dNjL9sK9m2-cyb4o2N0cyOVtV97mjfCjsTZ3k1UbjWYM4B7Sxc48RmZSSIq8a7xmtvkOGuLukSbf-ijZGh25tYDoGlhcGDbkCHi1xzHnS3TO9wEggzeIPLAKBivrsGPK2abCwQRZIb72D33yKgvF" 
              />
            </div>
            <span className="text-primary font-extrabold uppercase tracking-widest font-headline">VedaVoice</span>
          </div>
          <button className="p-2 rounded-xl text-primary hover:bg-surface-container-low transition-colors active:scale-95">
            <span className="material-symbols-outlined">settings</span>
          </button>
        </header>

        <div className="relative min-h-screen pt-16 pb-20 md:pb-0 md:flex">
          {/* Desktop sidebar — hidden on /login via client component */}
          <Sidebar />

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {children}
          </div>

          {/* Mobile bottom nav — hidden on /login via client component */}
          <BottomNavWrapper />

          {/* Dev Simulation UI - High Fidelity */}
          <DevSimulator />
        </div>
      </body>
    </html>
  )
}