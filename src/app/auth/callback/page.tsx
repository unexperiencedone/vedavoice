'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    // The Supabase JS client automatically handles exchanging the code in the hash/URL
    // We just need to wait for the session to be available
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Auth error:', error.message)
        router.replace('/login')
      } else if (session) {
        router.replace('/settings')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        document.cookie = "parchi_ui_auth=1; path=/; max-age=31536000; SameSite=Lax"
        router.replace('/settings')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-primary-container gap-4">
      <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin" />
      <p className="text-white font-headline font-semibold">Login ho raha hai...</p>
    </div>
  )
}
