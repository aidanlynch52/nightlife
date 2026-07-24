import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Alert, Animated, Clipboard, Dimensions, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import QRCodeLib from 'react-native-qrcode-svg'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../hooks/useAuth'
import { useNowPlaying } from '../../hooks/useNowPlaying'
import { useSpotify } from '../../hooks/useSpotify'
import { useNight } from '../../lib/NightContext'
import { supabase } from '../../lib/supabase'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const QR_SIZE = Math.min(SCREEN_WIDTH * 0.65, 280)
const QRCode = QRCodeLib?.default ?? QRCodeLib

const MODAL_WIDTH = SCREEN_WIDTH > 600 ? SCREEN_WIDTH * 0.4 : SCREEN_WIDTH * 0.9
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.7

function PulsingSpotifyDot({ styles }) {
  const pulseAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])
  const scale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] })
  const opacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] })
  return (
    <View style={styles.pulseDotWrap}>
      <Animated.View style={[styles.pulseRing, { transform: [{ scale }], opacity }]} />
      <View style={styles.pulseDotCore} />
    </View>
  )
}

function RequestSongModal({ visible, onClose, eventId, userId, spotifySearchTracks, connected, connectSpotify }) {
  const { colors } = useTheme()
  const styles = createStyles(colors)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [sentIds, setSentIds] = useState(new Set())

  useEffect(() => {
    if (!visible) { setQuery(''); setResults([]) }
  }, [visible])

  async function search(text) {
    setQuery(text)
    if (!text.trim() || !connected) { setResults([]); return }
    const tracks = await spotifySearchTracks(text)
    setResults(tracks)
  }

  async function sendRequest(track) {
    await supabase.from('song_requests').insert({
      event_id: eventId,
      requester_id: userId,
      spotify_track_id: track.id,
      track_name: track.name,
      artist_name: track.artists?.map(a => a.name).join(', ') || 'Unknown',
      album_art_url: track.album?.images?.[0]?.url || null,
    })
    setSentIds(prev => new Set(prev).add(track.id))
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.modalCenter}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request a song</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>

          {!connected ? (
            <View style={{ alignItems: 'center', paddingVertical: 30 }}>
              <Text style={{ color: colors.textSecondary, marginBottom: 14, textAlign: 'center' }}>
                Connect Spotify to search and request songs
              </Text>
              <TouchableOpacity style={styles.btnPrimary} onPress={connectSpotify}>
                <Text style={styles.btnPrimaryText}>Connect Spotify</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.searchInput}
                placeholder="Search a song or artist"
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={search}
              />
              <ScrollView showsVerticalScrollIndicator={false}>
                {results.map(track => (
                  <View key={track.id} style={styles.attendeeRow}>
                    {track.album?.images?.[0]?.url && (
                      <Image source={{ uri: track.album.images[0].url }} style={styles.attendeeAvatarImg} />
                    )}
                    <View style={styles.attendeeInfo}>
                      <Text style={styles.attendeeName} numberOfLines={1}>{track.name}</Text>
                      <Text style={styles.attendeeUsername} numberOfLines={1}>
                        {track.artists?.map(a => a.name).join(', ')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.actionBtn, sentIds.has(track.id) && styles.actionBtnDisabled]}
                      disabled={sentIds.has(track.id)}
                      onPress={() => sendRequest(track)}>
                      <Text style={styles.actionBtnText}>{sentIds.has(track.id) ? 'Sent' : 'Request'}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

function ViewRequestsModal({ visible, onClose, eventId, spotifyAddToQueue, onHandled }) {
  const { colors } = useTheme()
  const styles = createStyles(colors)
  const [requests, setRequests] = useState([])

  useEffect(() => {
    if (visible) loadRequests()
  }, [visible])

  async function loadRequests() {
    const { data } = await supabase
      .from('song_requests')
      .select('*')
      .eq('event_id', eventId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    setRequests(data || [])
  }

  async function handleQueue(req) {
    await spotifyAddToQueue(`spotify:track:${req.spotify_track_id}`)
    await supabase.from('song_requests').update({ status: 'queued' }).eq('id', req.id)
    setRequests(prev => prev.filter(r => r.id !== req.id))
    onHandled?.()
  }

  async function handleDecline(req) {
    await supabase.from('song_requests').update({ status: 'declined' }).eq('id', req.id)
    setRequests(prev => prev.filter(r => r.id !== req.id))
    onHandled?.()
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.modalCenter}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Song requests</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {requests.map(req => (
              <View key={req.id} style={styles.attendeeRow}>
                {req.album_art_url && <Image source={{ uri: req.album_art_url }} style={styles.attendeeAvatarImg} />}
                <View style={styles.attendeeInfo}>
                  <Text style={styles.attendeeName} numberOfLines={1}>{req.track_name}</Text>
                  <Text style={styles.attendeeUsername} numberOfLines={1}>{req.artist_name}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleQueue(req)}>
                    <Text style={styles.actionBtnText}>Queue</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnRed]} onPress={() => handleDecline(req)}>
                    <Text style={[styles.actionBtnText, { color: colors.danger }]}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {requests.length === 0 && (
              <Text style={{ color: colors.textMuted, textAlign: 'center', padding: 20, fontSize: 13 }}>No pending requests</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

export default function QRTabScreen() {
  const { colors } = useTheme()
  const styles = createStyles(colors)
  const { activeNight, leaveNight } = useNight()
  const { user } = useAuth()
  const { connected, loading: spotifyLoading, connectSpotify, addToQueue, searchTracks, saveTrack } = useSpotify()
  const [copied, setCopied] = useState(false)
  const [showPeople, setShowPeople] = useState(false)
  const [attendees, setAttendees] = useState([])
  const [filteredAttendees, setFilteredAttendees] = useState([])
  const [attendeeSearch, setAttendeeSearch] = useState('')
  const [sentRequests, setSentRequests] = useState(new Set())
  const [isAux, setIsAux] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showViewRequests, setShowViewRequests] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [savedTrackId, setSavedTrackId] = useState(null)
  const isOriginalHost = activeNight?.role === 'host'
  const isHostOrCohost = activeNight?.role === 'host' || activeNight?.role === 'cohost'
  const isPlainAttendee = !isHostOrCohost && !isAux

  const { track: nowPlaying } = useNowPlaying(isPlainAttendee ? activeNight?.id : null)

  useEffect(() => {
    async function checkIfAux() {
      if (!user?.id || !activeNight?.id) return
      const { data } = await supabase
        .from('aux_assignments')
        .select('id')
        .eq('event_id', activeNight.id)
        .eq('user_id', user.id)
        .single()
      setIsAux(!!data)
    }
    checkIfAux()
  }, [user?.id, activeNight?.id])

  useEffect(() => {
    if (!attendeeSearch.trim()) {
      setFilteredAttendees(attendees)
    } else {
      setFilteredAttendees(attendees.filter(a =>
        a.profiles?.display_name?.toLowerCase().includes(attendeeSearch.toLowerCase())
      ))
    }
  }, [attendeeSearch, attendees])

  useEffect(() => {
    if (!isAux || !activeNight?.id) return
    loadPendingCount()
    const interval = setInterval(loadPendingCount, 15000)
    return () => clearInterval(interval)
  }, [isAux, activeNight?.id])

  async function loadPendingCount() {
    const { count } = await supabase
      .from('song_requests')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', activeNight.id)
      .eq('status', 'pending')
    setPendingCount(count || 0)
  }

  function handlePrint() {
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html>
        <head>
          <style>
            body { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; margin:0; background:white; }
            img { width:500px; height:500px; }
          </style>
        </head>
        <body>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(`https://nightlifesocialmedia.com/join/${activeNight?.qrToken}`)}" />  
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print() }, 500)
  }

  function handleCopyLink() {
    const link = `https://nightlifesocialmedia.com/join/${activeNight?.qrToken}`
    Clipboard.setString(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function loadAttendees() {
    const { data } = await supabase
      .from('event_attendees')
      .select('user_id, profiles(id, display_name, username, avatar_url)')
      .eq('event_id', activeNight?.id)

    const { data: hosts } = await supabase
      .from('event_hosts')
      .select('user_id')
      .eq('event_id', activeNight?.id)

    const { data: auxData } = await supabase
      .from('aux_assignments')
      .select('user_id')
      .eq('event_id', activeNight?.id)

    const hostIds = new Set((hosts || []).map(h => h.user_id))
    const auxIds = new Set((auxData || []).map(a => a.user_id))

    const withRoles = (data || []).map(a => ({
      ...a,
      role: hostIds.has(a.user_id) ? 'host' : auxIds.has(a.user_id) ? 'aux' : 'attendee'
    }))

    const sorted = [
      ...withRoles.filter(a => a.role === 'host'),
      ...withRoles.filter(a => a.role === 'aux'),
      ...withRoles.filter(a => a.role === 'attendee'),
    ]

    setAttendees(sorted)
    setFilteredAttendees(sorted)
    setAttendeeSearch('')
    setShowPeople(true)
  }

  async function sendFriendRequest(receiverId) {
    await supabase.from('connection_requests').insert({
      sender_id: user.id,
      receiver_id: receiverId,
      event_id: activeNight?.id,
    })
    setSentRequests(prev => new Set(prev).add(receiverId))
  }

  async function handleSaveTrack() {
    if (!nowPlaying) return
    if (!connected) { connectSpotify(); return }
    await saveTrack(nowPlaying.spotify_track_id)
    setSavedTrackId(nowPlaying.spotify_track_id)
  }

  function handleEndOrLeave() {
    const isHost = activeNight?.role === 'host' || activeNight?.role === 'cohost'
    const title = isHost ? 'End night?' : 'Leave night?'
    const message = isHost ? 'This will end the night for everyone.' : 'You can still view the catalog after leaving.'
    const confirmText = isHost ? 'End Event' : 'Leave'

    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n${message}`)) {
        leaveNight().then(() => router.replace('/(tabs)/home'))
      }
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: confirmText, style: 'destructive', onPress: async () => {
          await leaveNight()
          router.replace('/(tabs)/home')
        }}
      ])
    }
  }

  return (
    <LinearGradient
      colors={colors.backgroundGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['left', 'right']}>

        {isAux && !connected && !spotifyLoading && (
          <TouchableOpacity style={styles.spotifyBanner} onPress={connectSpotify}>
            <View style={styles.spotifyBannerLeft}>
              <Text style={styles.spotifyBannerTitle}>🎵 Connect Spotify</Text>
              <Text style={styles.spotifyBannerSub}>You're on Aux!</Text>
            </View>
            <Text style={styles.spotifyBannerArrow}>→</Text>
          </TouchableOpacity>
        )}

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {isAux && connected && <PulsingSpotifyDot styles={styles} />}
          </View>

          <Text style={styles.title}>{activeNight?.name}</Text>

          <View style={styles.headerRight}>
            {SCREEN_WIDTH <= 600 && (
              <TouchableOpacity style={styles.peopleBtn} onPress={() => router.push('/(tabs)/messages')}>
                <Text style={styles.peopleBtnText}>💬</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.peopleBtn} onPress={loadAttendees}>
              <Text style={styles.peopleBtnText}>👥</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.endBtn} onPress={handleEndOrLeave}>
              <Text style={styles.endBtnText}>
                {activeNight?.role === 'host' || activeNight?.role === 'cohost' ? 'End Event' : 'Leave'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isHostOrCohost && (
          <>
            <View style={styles.qrSection}>
              <View style={styles.qrBox}>
                <QRCode
                  value={`https://nightlifesocialmedia.com/join/${activeNight?.qrToken}`}
                  size={QR_SIZE}
                  color="#000"
                  backgroundColor="#fff"
                />
              </View>
              <Text style={styles.hint}>Display or share this QR to let people in</Text>
            </View>
            <View style={styles.buttons}>
              <TouchableOpacity style={styles.btnPrimary} onPress={handlePrint}>
                <Text style={styles.btnPrimaryText}>Print QR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleCopyLink}>
                <Text style={styles.btnPrimaryText}>{copied ? 'Copied!' : 'Copy invite link'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {isAux && (
          <View style={styles.centerContent}>
            <TouchableOpacity style={styles.viewRequestsBtn} onPress={() => setShowViewRequests(true)}>
              <Text style={styles.viewRequestsText}>View Requests</Text>
              {pendingCount > 0 && (
                <View style={styles.requestBadge}>
                  <Text style={styles.requestBadgeText}>{pendingCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {isPlainAttendee && (
          <View style={styles.centerContent}>
            {nowPlaying ? (
              <>
                {nowPlaying.album_art_url && (
                  <Image source={{ uri: nowPlaying.album_art_url }} style={styles.nowPlayingArt} />
                )}
                <Text style={styles.nowPlayingTrack} numberOfLines={2}>{nowPlaying.track_name}</Text>
                <Text style={styles.nowPlayingArtist} numberOfLines={1}>{nowPlaying.artist_name}</Text>
                <TouchableOpacity
                  style={[styles.btnPrimary, savedTrackId === nowPlaying.spotify_track_id && styles.actionBtnDisabled]}
                  disabled={savedTrackId === nowPlaying.spotify_track_id}
                  onPress={handleSaveTrack}>
                  <Text style={styles.btnPrimaryText}>
                    {savedTrackId === nowPlaying.spotify_track_id ? 'Added ✓' : connected ? 'Add to my Spotify' : 'Connect Spotify to save'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.hint}>Nothing's playing right now</Text>
            )}

            <TouchableOpacity style={styles.requestSongBtn} onPress={() => setShowRequestModal(true)}>
              <Text style={styles.requestSongText}>Request a song</Text>
            </TouchableOpacity>
          </View>
        )}

        <Modal visible={showPeople} animationType="fade" transparent>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowPeople(false)} />
          <View style={styles.modalCenter}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>People</Text>
                <TouchableOpacity onPress={() => setShowPeople(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.searchInput}
                placeholder="Search by name..."
                placeholderTextColor={colors.textMuted}
                value={attendeeSearch}
                onChangeText={setAttendeeSearch}
              />

              <ScrollView showsVerticalScrollIndicator={false}>
                {filteredAttendees.map(a => {
                  const profile = a.profiles
                  const roleLabel = a.role === 'host' ? 'Host' : a.role === 'aux' ? 'Aux' : null
                  return (
                    <View key={a.user_id} style={styles.attendeeRow}>
                      <View style={styles.attendeeAvatar}>
                        {profile?.avatar_url ? (
                          <Image source={{ uri: profile.avatar_url }} style={styles.attendeeAvatarImg} />
                        ) : (
                          <Text style={styles.attendeeAvatarText}>
                            {profile?.display_name?.charAt(0) || '?'}
                          </Text>
                        )}
                      </View>
                      <View style={styles.attendeeInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.attendeeName}>{profile?.display_name}</Text>
                          {roleLabel && (
                            <View style={[styles.roleTag, a.role === 'host' ? styles.roleTagHost : styles.roleTagAux]}>
                              <Text style={styles.roleTagText}>{roleLabel}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.attendeeUsername}>@{profile?.username}</Text>
                      </View>

                      {a.user_id !== user?.id && (
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={async () => {
                              setShowPeople(false)
                              const { data: existing } = await supabase
                                .from('conversation_participants')
                                .select('conversation_id')
                                .eq('user_id', user.id)

                              let convId = null
                              if (existing?.length) {
                                const convIds = existing.map(e => e.conversation_id)
                                const { data: theirConvos } = await supabase
                                  .from('conversation_participants')
                                  .select('conversation_id')
                                  .eq('user_id', a.user_id)
                                  .in('conversation_id', convIds)
                                if (theirConvos?.length) convId = theirConvos[0].conversation_id
                              }

                              if (!convId) {
                                const { data: newConvo } = await supabase.from('conversations').insert({}).select().single()
                                convId = newConvo.id
                                await supabase.from('conversation_participants').insert([
                                  { conversation_id: convId, user_id: user.id },
                                  { conversation_id: convId, user_id: a.user_id },
                                ])
                              }

                              const { router } = await import('expo-router')
                              router.push({
                                pathname: '/(tabs)/conversation',
                                params: {
                                  conversationId: convId,
                                  otherUserId: a.user_id,
                                  otherUserName: profile?.display_name,
                                  otherUserAvatar: profile?.avatar_url || '',
                                }
                              })
                            }}>
                            <Text style={styles.actionBtnText}>💬</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.actionBtn, sentRequests.has(a.user_id) && styles.actionBtnDisabled]}
                            disabled={sentRequests.has(a.user_id)}
                            onPress={() => sendFriendRequest(a.user_id)}>
                            <Text style={styles.actionBtnText}>
                              {sentRequests.has(a.user_id) ? 'Pending' : 'Add'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {isOriginalHost && a.user_id !== user?.id && (
                        <View style={styles.attendeeActions}>
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={async () => {
                              await supabase.from('event_hosts').insert({ event_id: activeNight.id, user_id: a.user_id })
                            }}>
                            <Text style={styles.actionBtnText}>Host</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={async () => {
                              await supabase.from('aux_assignments').insert({ event_id: activeNight.id, user_id: a.user_id })
                            }}>
                            <Text style={styles.actionBtnText}>Aux</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.actionBtnRed]}
                            onPress={() => {
                              Alert.alert('Remove member?', `Remove ${profile?.display_name} from the night?`, [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Remove', style: 'destructive',
                                  onPress: async () => {
                                    await supabase.from('event_attendees')
                                      .delete()
                                      .eq('event_id', activeNight.id)
                                      .eq('user_id', a.user_id)
                                    setAttendees(attendees.filter(x => x.user_id !== a.user_id))
                                  }
                                }
                              ])
                            }}>
                            <Text style={[styles.actionBtnText, { color: colors.danger }]}>Remove</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )
                })}
                {filteredAttendees.length === 0 && (
                  <Text style={{ color: colors.textMuted, textAlign: 'center', padding: 20, fontSize: 13 }}>No results</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <RequestSongModal
          visible={showRequestModal}
          onClose={() => setShowRequestModal(false)}
          eventId={activeNight?.id}
          userId={user?.id}
          spotifySearchTracks={searchTracks}
          connected={connected}
          connectSpotify={connectSpotify}
        />

        <ViewRequestsModal
          visible={showViewRequests}
          onClose={() => setShowViewRequests(false)}
          eventId={activeNight?.id}
          spotifyAddToQueue={addToQueue}
          onHandled={loadPendingCount}
        />

      </SafeAreaView>
    </LinearGradient>
  )
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, padding: 24 },
    spotifyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(30,215,96,0.08)', borderWidth: 1, borderColor: 'rgba(30,215,96,0.4)', borderRadius: 12, padding: 14, marginBottom: 16 },
    spotifyBannerLeft: { flex: 1 },
    spotifyBannerTitle: { fontSize: 14, fontWeight: '600', color: '#1aa34a', marginBottom: 2 },
    spotifyBannerSub: { fontSize: 11, color: colors.textSecondary },
    spotifyBannerArrow: { fontSize: 18, color: '#1aa34a', marginLeft: 8 },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
    headerLeft: { width: 40, alignItems: 'flex-start', justifyContent: 'center' },
    title: { flex: 1, fontSize: SCREEN_WIDTH > 600 ? 28 : 0, fontWeight: '700', color: colors.text, textAlign: 'center', height: SCREEN_WIDTH > 600 ? 'auto' : 0 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' },

    pulseDotWrap: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
    pulseRing: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#1DB954' },
    pulseDotCore: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1DB954' },

    peopleBtn: { borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: SCREEN_WIDTH > 600 ? 10 : 7, paddingVertical: SCREEN_WIDTH > 600 ? 7 : 4, backgroundColor: colors.cardBackground, justifyContent: 'center' },
    peopleBtnText: { fontSize: SCREEN_WIDTH > 600 ? 16 : 13 },
    endBtn: { borderWidth: 1.5, borderColor: colors.danger, borderRadius: 8, paddingHorizontal: SCREEN_WIDTH > 600 ? 14 : 8, paddingVertical: SCREEN_WIDTH > 600 ? 7 : 4, backgroundColor: colors.cardBackground, justifyContent: 'center' },
    endBtnText: { color: colors.danger, fontSize: SCREEN_WIDTH > 600 ? 13 : 11, fontWeight: '500' },

    qrSection: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
    qrBox: { backgroundColor: '#fff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#ddd' },
    hint: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
    buttons: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingBottom: 20 },
    btnPrimary: { backgroundColor: colors.cardBackground, borderWidth: 2, borderColor: colors.text, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 20, alignItems: 'center' },
    btnPrimaryText: { color: colors.text, fontSize: 14, fontWeight: '600' },

    centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24 },
    nowPlayingArt: { width: 200, height: 200, borderRadius: 12, marginBottom: 8 },
    nowPlayingTrack: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
    nowPlayingArtist: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 8 },
    requestSongBtn: { borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 24, marginTop: 8 },
    requestSongText: { color: colors.text, fontSize: 14, fontWeight: '500' },

    viewRequestsBtn: { backgroundColor: '#1DB954', borderRadius: 24, paddingVertical: 14, paddingHorizontal: 32, position: 'relative' },
    viewRequestsText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    requestBadge: { position: 'absolute', top: -8, right: -8, backgroundColor: colors.danger, borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, borderWidth: 2, borderColor: colors.background },
    requestBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

    modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
    modalCenter: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -(MODAL_WIDTH / 2) }, { translateY: -(MODAL_HEIGHT / 2) }], width: MODAL_WIDTH, height: MODAL_HEIGHT },
    modalSheet: { flex: 1, backgroundColor: colors.cardBackground, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.borderStrong, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    modalTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    modalClose: { fontSize: 18, color: colors.textMuted },
    searchInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 9, fontSize: 13, color: colors.text, backgroundColor: colors.inputBackground, marginBottom: 12 },
    attendeeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 },
    attendeeInfo: { flex: 1 },
    attendeeName: { fontSize: 13, fontWeight: '500', color: colors.text },
    attendeeUsername: { fontSize: 11, color: colors.textMuted },
    attendeeActions: { flexDirection: 'row', gap: 4 },
    actionBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: colors.cardBackground },
    actionBtnDisabled: { opacity: 0.4 },
    actionBtnRed: { borderColor: 'rgba(200,0,0,0.3)' },
    actionBtnText: { fontSize: 10, color: colors.text },
    attendeeAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.inputBackground, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    attendeeAvatarImg: { width: 32, height: 32, borderRadius: 16 },
    attendeeAvatarText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    roleTag: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
    roleTagHost: { backgroundColor: colors.inputBackground },
    roleTagAux: { backgroundColor: 'rgba(30,215,96,0.12)' },
    roleTagText: { fontSize: 9, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  })
}