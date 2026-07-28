import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

const NightContext = createContext(null)

export function NightProvider({ children }) {
  const [activeNight, setActiveNight] = useState(null)
  const [loading, setLoading] = useState(true)
  const activeNightRef = useRef(activeNight)

  useEffect(() => {
    activeNightRef.current = activeNight
  }, [activeNight])

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

  // Lightweight watchdog: while someone is actively in a night, periodically
  // confirm it hasn't been auto-closed (by the server-side pg_cron job) or
  // manually ended by the host. Skips entirely when there's no active night,
  // so it costs nothing outside a party. The real enforcement lives in
  // Postgres via pg_cron — this is just so the UI catches up promptly
  // instead of only on next app launch.
  useEffect(() => {
    const interval = setInterval(async () => {
      const current = activeNightRef.current
      if (!current?.id) return

      const { data: event } = await supabase
        .from('events')
        .select('status, auto_close_at')
        .eq('id', current.id)
        .single()

      if (!event) return

      const isExpired = event.auto_close_at && new Date(event.auto_close_at) < new Date()
      if (event.status === 'closed' || isExpired) {
        setActiveNight(null)
      }
    }, 60000)

    return () => clearInterval(interval)
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