import { useEffect, useRef } from 'react'
import { useNight } from '../lib/NightContext'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useSpotify } from './useSpotify'

export function useSongPoller() {
  const { user } = useAuth()
  const { accessToken, connected } = useSpotify()
  const { activeNight } = useNight()
  const lastTrackId = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!connected || !accessToken || !activeNight?.id || activeNight?.role !== 'aux' && activeNight?.role !== 'host') return

    async function checkIsAux() {
      const { data } = await supabase
        .from('aux_assignments')
        .select('id')
        .eq('event_id', activeNight.id)
        .eq('user_id', user.id)
        .single()
      return !!data
    }

    async function pollCurrentTrack() {
      try {
        const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (res.status === 204 || res.status === 404) return
        const data = await res.json()
        if (!data?.item) return

        const track = data.item
        if (track.id === lastTrackId.current) return
        lastTrackId.current = track.id

        const { data: existing } = await supabase
          .from('songs')
          .select('id')
          .eq('event_id', activeNight.id)
          .eq('spotify_track_id', track.id)
          .single()

        if (existing) {
          await supabase
            .from('songs')
            .update({ play_count: existing.play_count + 1, played_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          await supabase.from('songs').insert({
            event_id: activeNight.id,
            spotify_track_id: track.id,
            track_name: track.name,
            artist_name: track.artists?.[0]?.name || '',
            album_art_url: track.album?.images?.[0]?.url || null,
            played_at: new Date().toISOString(),
            play_count: 1,
          })
        }
      } catch (e) {
        console.error('Song poll error:', e)
      }
    }

    checkIsAux().then(isAux => {
      if (!isAux) return
      pollCurrentTrack()
      intervalRef.current = setInterval(pollCurrentTrack, 30000)
    })

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [connected, accessToken, activeNight?.id])
}