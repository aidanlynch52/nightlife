import { exchangeCodeAsync, makeRedirectUri, refreshAsync, useAuthRequest } from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useState } from 'react'
import { Linking, Platform } from 'react-native'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

WebBrowser.maybeCompleteAuthSession()

const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID
const SCOPES = [
  'user-modify-playback-state',
  'user-read-playback-state',
  'user-read-currently-playing',
]

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
}

const redirectUri = Platform.OS === 'web'
  ? process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI
  : makeRedirectUri({ scheme: 'NightLife', path: 'spotify-callback' })

export function useSpotify() {
  const { user } = useAuth()
  const [connected, setConnected] = useState(false)
  const [accessToken, setAccessToken] = useState(null)
  const [loading, setLoading] = useState(true)

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: SPOTIFY_CLIENT_ID,
      scopes: SCOPES,
      usePKCE: true,
      redirectUri,
    },
    discovery
  )

  useEffect(() => {
    if (user) loadStoredToken()
  }, [user])

  useEffect(() => {
    if (response?.type === 'success') {
      handleAuthResponse(response)
    }
  }, [response])

  async function loadStoredToken() {
    setLoading(true)
    const { data } = await supabase
      .from('spotify_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!data) { setLoading(false); return }

    const expiresAt = new Date(data.expires_at)
    if (expiresAt > new Date()) {
      setAccessToken(data.access_token)
      setConnected(true)
    } else {
      await refreshToken(data.refresh_token)
    }
    setLoading(false)
  }

  async function handleAuthResponse(response) {
    try {
      const tokenResult = await exchangeCodeAsync(
        {
          clientId: SPOTIFY_CLIENT_ID,
          code: response.params.code,
          redirectUri,
          extraParams: { code_verifier: request.codeVerifier },
        },
        discovery
      )
      await storeTokens(tokenResult)
    } catch (e) {
      console.error('Spotify auth error:', e)
    }
  }

  async function refreshToken(refreshTokenValue) {
    try {
      const tokenResult = await refreshAsync(
        { clientId: SPOTIFY_CLIENT_ID, refreshToken: refreshTokenValue },
        discovery
      )
      await storeTokens(tokenResult)
    } catch (e) {
      console.error('Spotify refresh error:', e)
      setConnected(false)
    }
  }

  async function storeTokens(tokenResult) {
    const expiresAt = new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString()
    await supabase.from('spotify_tokens').upsert({
      user_id: user.id,
      access_token: tokenResult.accessToken,
      refresh_token: tokenResult.refreshToken,
      expires_at: expiresAt,
    }, { onConflict: 'user_id' })
    setAccessToken(tokenResult.accessToken)
    setConnected(true)
  }

  async function addToQueue(trackUri) {
    if (!accessToken) return { error: 'Not connected to Spotify' }
    const res = await fetch(`https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(trackUri)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.status === 401) {
      const { data } = await supabase.from('spotify_tokens').select('refresh_token').eq('user_id', user.id).single()
      if (data) await refreshToken(data.refresh_token)
      return { error: 'Token refreshed, try again' }
    }
    return { error: null }
  }

  async function searchTracks(query) {
    if (!accessToken) return []
    const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await res.json()
    return data.tracks?.items || []
  }

  async function disconnect() {
    await supabase.from('spotify_tokens').delete().eq('user_id', user.id)
    setAccessToken(null)
    setConnected(false)
  }

return {
  connected,
  loading,
  accessToken,
  connectSpotify: () => {
    if (Platform.OS !== 'web') {
      const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        response_type: 'code',
        redirect_uri: process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI,
        scope: SCOPES.join(' '),
      })
      Linking.openURL(`spotify://authorize?${params.toString()}`).catch(() => promptAsync())
    } else {
      promptAsync()
    }
  },
  addToQueue,
  searchTracks,
  disconnect,
}}