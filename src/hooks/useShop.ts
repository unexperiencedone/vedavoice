'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Shop } from '@/types'

export function useShop() {
  const [shop, setShop]       = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchShop() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('shops')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setShop(data)
      } else {
        // First time user — create shop record
        const { data: newShop } = await supabase
          .from('shops')
          .insert({
            user_id:    user.id,
            shop_name:  'My Construction Site',
            owner_name: 'Thekedar',
            phone:      user.phone ?? null,
          })
          .select()
          .single()
        setShop(newShop)
      }
      setLoading(false)
    }
    fetchShop()
  }, [])

  async function updateShop(updates: Partial<Pick<Shop, 'shop_name' | 'owner_name' | 'phone'>>) {
    if (!shop) return
    const { data, error } = await supabase
      .from('shops')
      .update(updates)
      .eq('id', shop.id)
      .select()
      .single()
    if (!error && data) setShop(data)
  }

  async function logout() {
    await supabase.auth.signOut()
    document.cookie = "parchi_ui_auth=; path=/; max-age=0; SameSite=Lax"
    window.location.href = '/login'
  }

  return { shop, loading, updateShop, logout }
}