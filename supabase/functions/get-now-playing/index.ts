import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID')!

Deno.serve(async (req) => {
  try {
    const { event_id } = await req.json()
    if (!event_id) return json({ error: 'event_id required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: auxRow } = await supabase
      .from('aux_assignments')
      .select('user_id')
      .eq('event_id', event_id)
      .maybeSingle()

    if (!auxRow) return json({ track: null })

    let { data: tokenRow } = await supabase
      .from('spotify_tokens')
      .select('*')
      .eq('user_id', auxRow.user_id)
      .maybeSingle()

    if (!tokenRow) return json({ track: null })

    if (new Date(tokenRow.expires_at) <= new Date()) {
      const refreshRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokenRow.refresh_token,
          client_id: SPOTIFY_CLIENT_ID,
        }),
      })
      const refreshData = await refreshRes.json()
      if (!refreshData.access_token) return json({ track: null })

      const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
      await supabase.from('spotify_tokens').update({
        access_token: refreshData.access_token,
        expires_at: newExpiresAt,
        refresh_token: refreshData.refresh_token || tokenRow.refresh_token,
      }).eq('user_id', auxRow.user_id)

      tokenRow.access_token = refreshData.access_token
    }

    const npRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${tokenRow.access_token}` },
    })

    if (npRes.status === 204 || npRes.status === 404) return json({ track: null })
    if (!npRes.ok) return json({ track: null })

    const npData = await npRes.json()
    if (!npData?.item) return json({ track: null })

    const track = {
      spotify_track_id: npData.item.id,
      track_name: npData.item.name,
      artist_name: npData.item.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
      album_art_url: npData.item.album?.images?.[0]?.url || null,
      is_playing: npData.is_playing,
      progress_ms: npData.progress_ms,
      duration_ms: npData.item.duration_ms,
    }

    const { data: lastSong } = await supabase
      .from('songs')
      .select('spotify_track_id')
      .eq('event_id', event_id)
      .order('played_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!lastSong || lastSong.spotify_track_id !== track.spotify_track_id) {
      await supabase.from('songs').insert({
        event_id,
        spotify_track_id: track.spotify_track_id,
        track_name: track.track_name,
        artist_name: track.artist_name,
        album_art_url: track.album_art_url,
        played_at: new Date().toISOString(),
      })
    }

    return json({ track })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}