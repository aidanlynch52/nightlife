import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const NightContext = createContext(null)

export function NightProvider({ children }) {
  const [activeNight, setActiveNight] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function restoreNight() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const { data: attendances } = await supabase
          .from('event_attendees')
          .select('event_id')
          .eq('user_id', user.id)

        if (!attendances || attendances.length === 0) { setLoading(false); return }

        const eventIds = attendances.map(a => a.event_id)

        const { data: events } = await supabase
          .from('events')
          .select('*')
          .in('id', eventIds)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)

        if (!events || events.length === 0) { setLoading(false); return }

        const event = events[0]

        if (event.auto_close_at && new Date(event.auto_close_at) < new Date()) {
          await supabase
            .from('events')
            .update({ status: 'closed', closed_at: new Date().toISOString() })
            .eq('id', event.id)
          setLoading(false)
          return
        }

        const isHost = event.host_id === user.id
        let role = 'attendee'

        if (isHost) {
          role = 'host'
        } else {
          const { data: cohost } = await supabase
            .from('event_hosts')
            .select('id')
            .eq('event_id', event.id)
            .eq('user_id', user.id)
            .single()
          if (cohost) role = 'cohost'
        }

        setActiveNight({
          id: event.id,
          name: event.name,
          qrToken: event.qr_code_token,
          role,
        })
      } catch (e) {
        console.error('restoreNight error:', e)
      }
      setLoading(false)
    }
    restoreNight()
  }, [])

  async function joinNight(night) {
    setActiveNight(night)
  }

  async function leaveNight() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !activeNight) return
      if (activeNight.role === 'host' || activeNight.role === 'cohost') {
        await supabase
          .from('events')
          .update({ status: 'closed', closed_at: new Date().toISOString() })
          .eq('id', activeNight.id)
      }
      setActiveNight(null)
    } catch (e) {}
  }

  return (
    <NightContext.Provider value={{ activeNight, joinNight, leaveNight, loading }}>
      {children}
    </NightContext.Provider>
  )
}

export function useNight() {
  return useContext(NightContext)
}

export default NightProvider
