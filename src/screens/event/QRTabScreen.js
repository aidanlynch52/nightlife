import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, Clipboard, Dimensions, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import QRCodeLib from 'react-native-qrcode-svg'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../hooks/useAuth'
import { useSpotify } from '../../hooks/useSpotify'
import { useNight } from '../../lib/NightContext'
import { supabase } from '../../lib/supabase'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const QR_SIZE = Math.min(SCREEN_WIDTH * 0.65, 280)
const QRCode = QRCodeLib?.default ?? QRCodeLib

const MODAL_WIDTH = SCREEN_WIDTH > 600 ? SCREEN_WIDTH * 0.4 : SCREEN_WIDTH * 0.9
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.7

export default function QRTabScreen() {
  const { activeNight, leaveNight } = useNight()
  const { user } = useAuth()
  const { connected, loading: spotifyLoading, connectSpotify } = useSpotify()
  const [copied, setCopied] = useState(false)
  const [showPeople, setShowPeople] = useState(false)
  const [attendees, setAttendees] = useState([])
  const [filteredAttendees, setFilteredAttendees] = useState([])
  const [attendeeSearch, setAttendeeSearch] = useState('')
  const [sentRequests, setSentRequests] = useState(new Set())
  const [isAux, setIsAux] = useState(false)
  const isOriginalHost = activeNight?.role === 'host'

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
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${activeNight?.qrToken}" />
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print() }, 500)
  }

  function handleCopyLink() {
    const link = `https://nightlife.app/join/${activeNight?.qrToken}`
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
      colors={['#f0f0f0', '#ffffff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['left', 'right']}>

        {isAux && !connected && !spotifyLoading && (
          <TouchableOpacity style={styles.spotifyBanner} onPress={connectSpotify}>
            <View style={styles.spotifyBannerLeft}>
              <Text style={styles.spotifyBannerTitle}>🎵 Connect Spotify</Text>
              <Text style={styles.spotifyBannerSub}>You're the Aux — connect Spotify to receive song requests</Text>
            </View>
            <Text style={styles.spotifyBannerArrow}>→</Text>
          </TouchableOpacity>
        )}

        {isAux && connected && (
          <View style={styles.spotifyConnected}>
            <Text style={styles.spotifyConnectedText}>🟢 Spotify connected</Text>
          </View>
        )}

        <View style={styles.header}>
          <Text style={styles.title}>{activeNight?.name}</Text>
          <View style={styles.headerRight}>
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

        <View style={styles.qrSection}>
          <View style={styles.qrBox}>
            <QRCode
              value={activeNight?.qrToken || 'nightlife'}
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
                placeholderTextColor="#aaa"
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
            <Text style={[styles.actionBtnText, { color: '#cc0000' }]}>Remove</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
})}
                {filteredAttendees.length === 0 && (
                  <Text style={{ color: '#aaa', textAlign: 'center', padding: 20, fontSize: 13 }}>No results</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  spotifyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(30,215,96,0.08)', borderWidth: 1, borderColor: 'rgba(30,215,96,0.4)', borderRadius: 12, padding: 14, marginBottom: 16 },
  spotifyBannerLeft: { flex: 1 },
  spotifyBannerTitle: { fontSize: 14, fontWeight: '600', color: '#1aa34a', marginBottom: 2 },
  spotifyBannerSub: { fontSize: 11, color: '#555' },
  spotifyBannerArrow: { fontSize: 18, color: '#1aa34a', marginLeft: 8 },
  spotifyConnected: { backgroundColor: 'rgba(30,215,96,0.08)', borderWidth: 1, borderColor: 'rgba(30,215,96,0.3)', borderRadius: 10, padding: 10, marginBottom: 12, alignItems: 'center' },
  spotifyConnectedText: { fontSize: 12, color: '#1aa34a' },
  header: { alignItems: 'center', marginBottom: 32, position: 'relative' },
  title: { fontSize: 28, fontWeight: '700', color: '#111', textAlign: 'center' },
  headerRight: { position: 'absolute', right: 0, top: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  peopleBtn: { borderWidth: 1.5, borderColor: '#888', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#fff', minHeight: 36, justifyContent: 'center' },
  peopleBtnText: { fontSize: 16 },
  endBtn: { borderWidth: 1.5, borderColor: '#cc0000', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff', minHeight: 36, justifyContent: 'center' },
  endBtnText: { color: '#cc0000', fontSize: 13, fontWeight: '500' },
  qrSection: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  qrBox: { backgroundColor: '#fff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#ddd' },
  hint: { fontSize: 13, color: '#888', textAlign: 'center' },
  buttons: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingBottom: 20 },
  btnPrimary: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#111', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 20, alignItems: 'center' },
  btnPrimaryText: { color: '#111', fontSize: 14, fontWeight: '600' },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCenter: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -(MODAL_WIDTH / 2) }, { translateY: -(MODAL_HEIGHT / 2) }], width: MODAL_WIDTH, height: MODAL_HEIGHT },
  modalSheet: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#ddd', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#111' },
  modalClose: { fontSize: 18, color: '#999' },
  searchInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 9, fontSize: 13, color: '#111', backgroundColor: '#f9f9f9', marginBottom: 12 },
  attendeeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: 8 },
  attendeeInfo: { flex: 1 },
  attendeeName: { fontSize: 13, fontWeight: '500', color: '#111' },
  attendeeUsername: { fontSize: 11, color: '#888' },
  attendeeActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: '#fff' },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnRed: { borderColor: 'rgba(200,0,0,0.3)' },
  actionBtnText: { fontSize: 10, color: '#333' },
  attendeeAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ddd' },
  attendeeAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  attendeeAvatarText: { fontSize: 13, fontWeight: '600', color: '#555' },
roleTag: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
roleTagHost: { backgroundColor: 'rgba(0,0,0,0.08)' },
roleTagAux: { backgroundColor: 'rgba(30,215,96,0.12)' },
roleTagText: { fontSize: 9, fontWeight: '600', color: '#555', textTransform: 'uppercase', letterSpacing: 0.4 },
})