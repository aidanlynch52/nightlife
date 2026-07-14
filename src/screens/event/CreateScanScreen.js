import { CameraView, useCameraPermissions } from 'expo-camera'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useIsFocused } from 'expo-router'
import { useEffect, useState } from 'react'
import { Clipboard, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useEvent } from '../../hooks/useEvent'
import { useNight } from '../../lib/NightContext'
import { supabase } from '../../lib/supabase'

export default function CreateScanScreen() {
  const [mode, setMode] = useState('default')
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('6')
  const [closeTime, setCloseTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cohostSearch, setCohostSearch] = useState('')
  const [cohostResults, setCohostResults] = useState([])
  const [cohosts, setCohosts] = useState([])
  const [auxSearch, setAuxSearch] = useState('')
  const [auxResults, setAuxResults] = useState([])
  const [aux, setAux] = useState(null)
  const [geoEnabled, setGeoEnabled] = useState(false)
  const [copied, setCopied] = useState(null)
  const [scanned, setScanned] = useState(false)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const { createEvent } = useEvent()
  const { joinNight } = useNight()
  const isFocused = useIsFocused()

  useEffect(() => {
    if (!cameraPermission?.granted) requestCameraPermission()
  }, [])

  useEffect(() => {
    if (mode === 'default') setScanned(false)
  }, [mode])

  useEffect(() => {
    const hours = parseFloat(duration)
    if (!duration || isNaN(hours)) { setCloseTime(''); return }
    const closeDate = new Date()
    closeDate.setMinutes(closeDate.getMinutes() + Math.round(hours * 60))
    const isNextDay = closeDate.getDate() !== new Date().getDate()
    const timeStr = closeDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    setCloseTime(`Your night will automatically close at ${timeStr}${isNextDay ? ' tomorrow' : ' today'}.`)
  }, [duration])

  async function handleBarcodeScanned({ data }) {
    if (scanned) return
    setScanned(true)
    try {
      const { data: eventData, error } = await supabase
        .from('events')
        .select('*')
        .eq('qr_code_token', data)
        .eq('status', 'active')
        .single()
      if (error || !eventData) {
        setScanned(false)
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('event_attendees').insert({ event_id: eventData.id, user_id: user.id }).single()
      joinNight({ id: eventData.id, name: eventData.name, qrToken: eventData.qr_code_token, role: 'attendee' })
      router.replace('/(tabs)/home')
    } catch (e) {
      console.error('Scan error:', e)
      setScanned(false)
    }
  }

  async function searchUsers(query, setResults) {
    if (!query.trim()) { setResults([]); return }
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .ilike('display_name', `%${query}%`)
      .limit(5)
    setResults(data || [])
  }

  function copyLink(role) {
    const link = `https://nightlife.app/invite/${role}`
    Clipboard.setString(link)
    setCopied(role)
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleCreate() {
    if (!name.trim()) { setError('Give your night a name'); return }
    setLoading(true)
    setError('')
    const hours = parseFloat(duration)
    const closeDate = new Date()
    closeDate.setMinutes(closeDate.getMinutes() + Math.round((isNaN(hours) ? 6 : hours) * 60))
    const autoCloseAt = closeDate.toISOString()
    const { data, error } = await createEvent(name.trim(), autoCloseAt, null)
    setLoading(false)
    if (error) { console.error('Create event error:', JSON.stringify(error)); setError(error.message || 'Something went wrong, try again'); return }
    if (!data?.id) { setError('The night could not be created. Please try again.'); return }
    for (const cohost of cohosts) {
      await supabase.from('event_hosts').insert({ event_id: data.id, user_id: cohost.id })
    }
    if (aux) {
      await supabase.from('aux_assignments').insert({ event_id: data.id, user_id: aux.id })
    }
    router.push({ pathname: '/(event)/qr-display', params: { eventId: data.id, eventName: data.name, qrToken: data.qr_code_token } })
  }

  function InviteButtons({ role }) {
    return (
      <TouchableOpacity style={styles.invitePill} onPress={() => copyLink(role)}>
        <Text style={styles.inviteText}>{copied === role ? 'Copied!' : 'Copy invite link'}</Text>
      </TouchableOpacity>
    )
  }

  if (mode === 'create') {
    return (
      <LinearGradient colors={['#000005', '#000510', '#001030', '#002060']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1 }}>
        <SafeAreaView style={styles.container}>
          <ScrollView>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setMode('default')}>
                <Text style={styles.back}>← Back</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Create a night</Text>
            </View>
            <View style={styles.form}>
              <Text style={styles.label}>Night name</Text>
              <TextInput style={styles.input} placeholder="e.g. Tommy's Rager" placeholderTextColor="rgba(255,255,255,0.3)" value={name} onChangeText={setName} />
              <Text style={styles.label}>How many hours until auto-close?</Text>
              <Text style={styles.sublabel}>You can also end the night manually at any time.</Text>
              <TextInput style={styles.input} placeholder="e.g. 6 or 6.25" placeholderTextColor="rgba(255,255,255,0.3)" value={duration} onChangeText={setDuration} keyboardType="decimal-pad" />
              {closeTime ? <View style={styles.closeTimeBox}><Text style={styles.closeTimeText}>{closeTime}</Text></View> : null}

              <View style={styles.sectionHeader}>
                <View style={styles.sectionText}>
                  <Text style={[styles.label, styles.sectionLabel]}>Co-hosts</Text>
                  <Text style={styles.sublabel}>They can manage the night just like you.</Text>
                </View>
                <InviteButtons role="host" />
              </View>
              <TextInput style={styles.input} placeholder="Search by name" placeholderTextColor="rgba(255,255,255,0.3)" value={cohostSearch} onChangeText={(t) => { setCohostSearch(t); searchUsers(t, setCohostResults) }} />
              {cohostResults.map(u => (
                <TouchableOpacity key={u.id} style={styles.resultRow} onPress={() => { if (!cohosts.find(c => c.id === u.id)) setCohosts([...cohosts, u]); setCohostSearch(''); setCohostResults([]) }}>
                  <Text style={styles.resultName}>{u.display_name}</Text>
                  <Text style={styles.resultUsername}>@{u.username}</Text>
                </TouchableOpacity>
              ))}
              {cohosts.map(c => (
                <View key={c.id} style={styles.addedRow}>
                  <Text style={styles.addedName}>{c.display_name}</Text>
                  <TouchableOpacity onPress={() => setCohosts(cohosts.filter(x => x.id !== c.id))}>
                    <Text style={styles.removeBtn}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <View style={styles.sectionHeader}>
                <View style={styles.sectionText}>
                  <Text style={[styles.label, styles.sectionLabel]}>Aux</Text>
                  <Text style={styles.sublabel}>Their Spotify will be linked to the night automatically.</Text>
                </View>
                <InviteButtons role="aux" />
              </View>
              <TextInput style={styles.input} placeholder="Search by name" placeholderTextColor="rgba(255,255,255,0.3)" value={auxSearch} onChangeText={(t) => { setAuxSearch(t); searchUsers(t, setAuxResults) }} />
              {auxResults.map(u => (
                <TouchableOpacity key={u.id} style={styles.resultRow} onPress={() => { setAux(u); setAuxSearch(''); setAuxResults([]) }}>
                  <Text style={styles.resultName}>{u.display_name}</Text>
                  <Text style={styles.resultUsername}>@{u.username}</Text>
                </TouchableOpacity>
              ))}
              {aux && (
                <View style={styles.addedRow}>
                  <Text style={styles.addedName}>{aux.display_name}</Text>
                  <TouchableOpacity onPress={() => setAux(null)}>
                    <Text style={styles.removeBtn}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.geoRow}>
                <View style={styles.geoLeft}>
                  <Text style={styles.label}>Geography check</Text>
                  <Text style={styles.sublabel}>Only let people join within 100m of the party.</Text>
                </View>
                <Switch value={geoEnabled} onValueChange={setGeoEnabled} thumbColor="#fff" trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#4a90e2' }} />
              </View>
              {geoEnabled && <View style={styles.closeTimeBox}><Text style={styles.closeTimeText}>Location will be set from your current position when you create the night.</Text></View>}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity style={styles.btnPrimary} onPress={handleCreate} disabled={loading}>
                <Text style={styles.btnPrimaryText}>{loading ? 'Creating...' : 'Create night'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    )
  }

  return (
    <View style={styles.container}>
      {isFocused && cameraPermission?.granted && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          active={isFocused}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
      )}

      {(!cameraPermission?.granted) && (
        <View style={styles.noCamera}>
          <Text style={styles.noCameraText}>Camera permission required to scan QR codes</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestCameraPermission}>
            <Text style={styles.permBtnText}>Grant permission</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.scanOverlay}>
        <View style={styles.scanViewfinder}>
          <View style={styles.scanCornerTL} />
          <View style={styles.scanCornerTR} />
          <View style={styles.scanCornerBL} />
          <View style={styles.scanCornerBR} />
        </View>
        <Text style={styles.scanText}>
          {scanned ? 'Joining night...' : 'Point at a QR code to join a night'}
        </Text>
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => setMode('create')}>
          <Text style={styles.btnPrimaryText}>+ Create a night</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scanOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanViewfinder: { width: 220, height: 220, borderRadius: 12, position: 'relative', marginBottom: 20 },
  scanCornerTL: { position: 'absolute', top: 0, left: 0, width: 28, height: 28, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#fff', borderTopLeftRadius: 8 },
  scanCornerTR: { position: 'absolute', top: 0, right: 0, width: 28, height: 28, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#fff', borderTopRightRadius: 8 },
  scanCornerBL: { position: 'absolute', bottom: 0, left: 0, width: 28, height: 28, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#fff', borderBottomLeftRadius: 8 },
  scanCornerBR: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#fff', borderBottomRightRadius: 8 },
  scanText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  bottom: { padding: 24, paddingBottom: 32 },
  noCamera: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  noCameraText: { color: '#fff', fontSize: 14, textAlign: 'center', marginBottom: 20, opacity: 0.6 },
  permBtn: { backgroundColor: '#fff', padding: 14, borderRadius: 10, paddingHorizontal: 32 },
  permBtnText: { color: '#000', fontWeight: '600' },
  header: { padding: 12, paddingTop: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.1)' },
  back: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 6 },
  title: { fontSize: 22, fontWeight: '600', color: '#fff' },
  form: { padding: 16 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 2, color: '#fff', marginTop: 14 },
  sublabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 },
  input: { borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 6, color: '#fff', backgroundColor: 'rgba(255,255,255,0.07)' },
  closeTimeBox: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: 10, marginBottom: 10 },
  closeTimeText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 8, marginBottom: 4, backgroundColor: 'rgba(255,255,255,0.05)' },
  resultName: { fontSize: 13, fontWeight: '500', color: '#fff' },
  resultUsername: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  addedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 8, marginBottom: 4, marginTop: 4, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)' },
  addedName: { fontSize: 13, fontWeight: '500', color: '#fff' },
  removeBtn: { fontSize: 12, color: '#ff6b6b' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 4 },
  sectionText: { flex: 1, marginRight: 12 },
  sectionLabel: { marginTop: 0 },
  invitePill: { alignSelf: 'flex-end', backgroundColor: 'rgba(100,180,255,0.15)', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9, borderWidth: 0.5, borderColor: 'rgba(100,180,255,0.35)' },
  inviteText: { fontSize: 13, color: 'rgba(140,210,255,0.95)', fontWeight: '500' },
  geoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingVertical: 4 },
  geoLeft: { flex: 1, marginRight: 16 },
  error: { color: '#ff6b6b', fontSize: 13, marginBottom: 12, marginTop: 8 },
  btnPrimary: { backgroundColor: '#fff', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 20, marginBottom: 40 },
  btnPrimaryText: { color: '#000', fontSize: 15, fontWeight: '600' },
})