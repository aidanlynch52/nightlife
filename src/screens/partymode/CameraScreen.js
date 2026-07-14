import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera'
import { LinearGradient } from 'expo-linear-gradient'
import { useIsFocused } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Animated, Dimensions,
  PanResponder, Platform,
  Image as RNImage,
  StyleSheet, Text, TouchableOpacity, View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../hooks/useAuth'
import { useNight } from '../../lib/NightContext'
import { supabase } from '../../lib/supabase'

const { width, height } = Dimensions.get('window')

function DigitalTimestamp() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const pad = n => String(n).padStart(2, '0')
  const d = time
  const dateStr = `${pad(d.getMonth() + 1)}.${pad(d.getDate())}.${String(d.getFullYear()).slice(2)}`
  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  return (
    <View style={styles.timestamp}>
      <Text style={styles.timestampText}>{dateStr}  {timeStr}</Text>
    </View>
  )
}

function GrainOverlay() {
  return (
    <View style={styles.grainOverlay} pointerEvents="none">
      {Array.from({ length: 80 }).map((_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: Math.random() * 3 + 1,
            height: Math.random() * 3 + 1,
            borderRadius: 1,
            backgroundColor: `rgba(255,255,255,${Math.random() * 0.08})`,
          }}
        />
      ))}
    </View>
  )
}

export default function CameraScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const [micPermission, requestMicPermission] = useMicrophonePermissions()
  const [lens, setLens] = useState('standard')
  const [facing, setFacing] = useState('back')
  const [preview, setPreview] = useState(null)
  const [recording, setRecording] = useState(false)
  const [recordProgress, setRecordProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const cameraRef = useRef(null)
  const recordTimer = useRef(null)
  const isRecording = useRef(false)
  const slideAnim = useRef(new Animated.Value(0)).current
  const { activeNight } = useNight()
  const { user } = useAuth()
  const isFocused = useIsFocused()

  const MAX_RECORD_SECONDS = 30

  useEffect(() => {
    if (!isFocused) {
      if (recordTimer.current) {
        clearInterval(recordTimer.current)
        recordTimer.current = null
      }
      isRecording.current = false
      setRecording(false)
      setRecordProgress(0)
      return
    }

    if (!cameraPermission?.granted) requestCameraPermission()
    if (!micPermission?.granted) requestMicPermission()

    return () => {
      if (recordTimer.current) {
        clearInterval(recordTimer.current)
        recordTimer.current = null
      }
      isRecording.current = false
      setRecording(false)
      setRecordProgress(0)
      if (typeof cameraRef.current?.stopRecording === 'function') {
        try {
          cameraRef.current.stopRecording()
        } catch (e) {
          console.warn('Camera cleanup warning:', e)
        }
      }
    }
  }, [isFocused, cameraPermission?.granted, micPermission?.granted, requestCameraPermission, requestMicPermission])

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10,
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) slideAnim.setValue(g.dy)
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 120) {
        discardPreview()
      } else {
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false }).start()
      }
    },
  })

  function discardPreview() {
    Animated.timing(slideAnim, {
      toValue: height,
      duration: 250,
      useNativeDriver: false,
    }).start(() => {
      setPreview(null)
      slideAnim.setValue(0)
    })
  }

  async function flipImageHorizontally(uri) {
    return new Promise((resolve) => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx.translate(img.width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = uri
    })
  }

  async function takePhoto() {
    if (!cameraRef.current) return
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 })
      let uri = photo.uri
      if (Platform.OS === 'web' && facing === 'front') {
        uri = await flipImageHorizontally(uri)
      }
      setPreview({ uri, type: 'photo', lens, facing })
    } catch (e) {
      console.error('Photo error:', e)
    }
  }

  async function startRecording() {
    if (!cameraRef.current || isRecording.current) return
    isRecording.current = true
    setRecording(true)
    setRecordProgress(0)
    let elapsed = 0
    recordTimer.current = setInterval(() => {
      elapsed += 0.1
      setRecordProgress(elapsed / MAX_RECORD_SECONDS)
      if (elapsed >= MAX_RECORD_SECONDS) stopRecording()
    }, 100)
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: MAX_RECORD_SECONDS })
      if (video?.uri) {
        setPreview({ uri: video.uri, type: 'video', lens, facing })
      }
    } catch (e) {
      console.error('Video error:', e)
    } finally {
      isRecording.current = false
      setRecording(false)
    }
  }

  function stopRecording() {
    if (!isRecording.current) return
    if (recordTimer.current) {
      clearInterval(recordTimer.current)
      recordTimer.current = null
    }
    isRecording.current = false
    setRecording(false)
    setRecordProgress(0)
    if (typeof cameraRef.current?.stopRecording === 'function') {
      cameraRef.current.stopRecording()
    }
  }

  async function sendToCatalog() {
    if (!preview || !activeNight?.id || !user?.id) return
    setUploading(true)
    try {
      const ext = preview.type === 'video' ? 'mp4' : 'jpg'
      const fileName = `${activeNight.id}/${user.id}/${Date.now()}_${lens}.${ext}`
      const res = await fetch(preview.uri)
      const blob = await res.blob()
      const { error: uploadError } = await supabase.storage
        .from('Photos')
        .upload(fileName, blob, {
          contentType: preview.type === 'video' ? 'video/mp4' : 'image/jpeg',
        })
      if (uploadError) { console.error('Upload error:', uploadError); setUploading(false); return }
      await supabase.from('photos').insert({
        event_id: activeNight.id,
        uploader_id: user.id,
        storage_path: fileName,
        lens_type: lens,
        is_retroactive: false,
        created_at: new Date().toISOString(),
      })
      setPreview(null)
      slideAnim.setValue(0)
    } catch (e) {
      console.error('Send error:', e)
    }
    setUploading(false)
  }

  if (!isFocused) return <View style={styles.container} />

  if (!cameraPermission) return <View style={styles.container} />

  if (!cameraPermission.granted) {
    return (
      <LinearGradient colors={['#000005', '#000510', '#001030', '#002060']} style={{ flex: 1 }}>
        <SafeAreaView style={styles.permContainer}>
          <Text style={styles.permText}>Camera access is required</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestCameraPermission}>
            <Text style={styles.permBtnText}>Grant permission</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    )
  }

  return (
    <View style={styles.container}>
      {isFocused && (
        <CameraView
          ref={cameraRef}
          style={[StyleSheet.absoluteFill, facing === 'front' && { transform: [{ scaleX: -1 }] }]}
          facing={facing}
          mode="picture"
        >
          {lens === 'digital' && (
            <>
              <View style={styles.digitalWarm} pointerEvents="none" />
              <GrainOverlay />
              <DigitalTimestamp />
            </>
          )}

          <SafeAreaView style={styles.topBar} edges={['top']}>
            <View style={styles.lensToggle}>
              <TouchableOpacity
                style={[styles.lensBtn, lens === 'standard' && styles.lensBtnActive]}
                onPress={() => setLens('standard')}>
                <Text style={[styles.lensBtnText, lens === 'standard' && styles.lensBtnTextActive]}>Standard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.lensBtn, lens === 'digital' && styles.lensBtnActive]}
                onPress={() => setLens('digital')}>
                <Text style={[styles.lensBtnText, lens === 'digital' && styles.lensBtnTextActive]}>Digital</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.flipBtn} onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
              <Text style={styles.flipText}>⇄</Text>
            </TouchableOpacity>
          </SafeAreaView>

          {recording && (
            <View style={styles.recordBar}>
              <View style={[styles.recordFill, { width: `${recordProgress * 100}%` }]} />
            </View>
          )}

          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.captureBtn, recording && styles.captureBtnRecording]}
              onPress={recording ? stopRecording : takePhoto}
              onLongPress={startRecording}
              delayLongPress={300}>
              <View style={[styles.captureInner, recording && styles.captureInnerRecording]} />
            </TouchableOpacity>
          </View>
        </CameraView>
      )}

      {preview && (
        <Animated.View
          style={[styles.previewOverlay, { transform: [{ translateY: slideAnim }] }]}
          {...panResponder.panHandlers}>

          {preview.type === 'photo' ? (
            <RNImage
              source={{ uri: preview.uri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontSize: 48 }}>🎥</Text>
              <Text style={{ color: '#fff', opacity: 0.5, fontSize: 13, marginTop: 10 }}>Video ready</Text>
            </View>
          )}

          {preview.lens === 'digital' && (
            <>
              <View style={styles.digitalWarm} pointerEvents="none" />
              <GrainOverlay />
              <DigitalTimestamp />
            </>
          )}

          <TouchableOpacity style={styles.previewClose} onPress={discardPreview}>
            <Text style={styles.previewCloseText}>✕</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sendBtn} onPress={sendToCatalog} disabled={uploading}>
            <Text style={styles.sendText}>{uploading ? 'Sending...' : 'Send'}</Text>
          </TouchableOpacity>

        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  permText: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 24 },
  permBtn: { backgroundColor: '#fff', padding: 14, borderRadius: 10, alignItems: 'center', paddingHorizontal: 32 },
  permBtnText: { color: '#000', fontWeight: '600' },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12 },

  lensToggle: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)' },
  lensBtn: { paddingHorizontal: 18, paddingVertical: 8 },
  lensBtnActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  lensBtnText: { fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  lensBtnTextActive: { color: '#fff' },

  flipBtn: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  flipText: { color: '#fff', fontSize: 18 },
digitalWarm: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,220,120,0.07)' },
grainOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  grainOverlay: { position: 'absolute', inset: 0, overflow: 'hidden' },

  timestamp: { position: 'absolute', bottom: 120, right: 16 },
  timestampText: { color: '#ff3333', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },

  recordBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  recordFill: { height: 3, backgroundColor: '#ff3333' },

  bottomBar: { position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center' },
  captureBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'transparent', borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  captureBtnRecording: { borderColor: '#ff3333' },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  captureInnerRecording: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#ff3333' },

previewOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  previewClose: { position: 'absolute', top: 10, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  previewCloseText: { color: '#fff', fontSize: 16 },

  sendBtn: { position: 'absolute', bottom: 48, right: 32, backgroundColor: '#fff', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 24, zIndex: 10 },
  sendText: { color: '#000', fontWeight: '600', fontSize: 15 },
})