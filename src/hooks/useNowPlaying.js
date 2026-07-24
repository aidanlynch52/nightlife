import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useNowPlaying(eventId) {
  const [track, setTrack] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!eventId) return
    let cancelled = false

    async function poll() {
      const { data, error } = await supabase.functions.invoke('get-now-playing', {
        body: { event_id: eventId },
      })
      if (!cancelled) {
        if (!error) setTrack(data?.track || null)
        setLoading(false)
      }
    }

    poll()
    const interval = setInterval(poll, 10000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [eventId])

  return { track, loading }
}