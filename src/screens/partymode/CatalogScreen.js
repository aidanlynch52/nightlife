import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState } from 'react'
import { Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../hooks/useAuth'
import { useNight } from '../../lib/NightContext'
import { supabase } from '../../lib/supabase'

const { width } = Dimensions.get('window')
const isDesktop = width > 700
const COLUMNS = isDesktop ? 6 : 3
const GAP = 2
const TILE_SIZE = (width - GAP * (COLUMNS - 1)) / COLUMNS

export default function CatalogScreen() {
  const { colors } = useTheme()
  const styles = createStyles(colors)
  const { activeNight } = useNight()
  const { user } = useAuth()
  const [photos, setPhotos] = useState([])
  const [sortBy, setSortBy] = useState('recent')
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [starredIds, setStarredIds] = useState(new Set())

  useEffect(() => {
    if (activeNight?.id) loadPhotos()
  }, [activeNight?.id, sortBy])

  async function loadPhotos() {
    if (!activeNight?.id) return
    let query = supabase
      .from('photos')
      .select('*, profiles(username, avatar_url)')
      .eq('event_id', activeNight.id)

    if (sortBy === 'recent') {
      query = query.order('created_at', { ascending: false })
    } else {
      query = query.order('heart_count', { ascending: false })
    }

    const { data } = await query
    setPhotos(data || [])

    if (user?.id) {
      const { data: starred } = await supabase
        .from('starred_photos')
        .select('photo_id')
        .eq('user_id', user.id)
      setStarredIds(new Set((starred || []).map(s => s.photo_id)))
    }
  }

  async function toggleStar(photoId) {
    const isStarred = starredIds.has(photoId)
    if (isStarred) {
      await supabase.from('starred_photos').delete().eq('photo_id', photoId).eq('user_id', user.id)
      setStarredIds(prev => {
        const next = new Set(prev)
        next.delete(photoId)
        return next
      })
    } else {
      await supabase.from('starred_photos').insert({ photo_id: photoId, user_id: user.id })
      setStarredIds(prev => new Set(prev).add(photoId))
    }
  }

  async function handleUpload() {
    if (!activeNight?.id || !user?.id) {
      console.error('No active night or user, cannot upload')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.8,
    })
    if (result.canceled) return

    setUploading(true)
    for (const asset of result.assets) {
      const uri = asset.uri
      const ext = asset.fileName ? asset.fileName.split('.').pop() : 'jpg'
      const fileName = `${activeNight.id}/${user.id}/${Date.now()}.${ext}`

      const res = await fetch(uri)
      const blob = await res.blob()

      const { error: uploadError } = await supabase.storage
        .from('Photos')
        .upload(fileName, blob, { contentType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg' })

      if (uploadError) {
        console.error('Photo upload error:', JSON.stringify(uploadError))
        continue
      }

      await supabase.from('photos').insert({
        event_id: activeNight.id,
        uploader_id: user.id,
        storage_path: fileName,
        is_retroactive: true,
      })
    }
    setUploading(false)
    loadPhotos()
  }

  async function openPhoto(photo) {
    setSelectedPhoto(photo)
    const { data } = await supabase
      .from('photo_comments')
      .select('*, profiles(display_name)')
      .eq('photo_id', photo.id)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  async function sendComment() {
    if (!commentText.trim() || !selectedPhoto) return
    await supabase.from('photo_comments').insert({
      photo_id: selectedPhoto.id,
      user_id: user.id,
      body: commentText.trim(),
    })
    setCommentText('')
    const { data } = await supabase
      .from('photo_comments')
      .select('*, profiles(display_name)')
      .eq('photo_id', selectedPhoto.id)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  function getPhotoUrl(path) {
    const { data } = supabase.storage.from('Photos').getPublicUrl(path)
    return data.publicUrl
  }

  return (
    <LinearGradient
      colors={colors.backgroundGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['left', 'right', 'top']}>

        <View style={styles.header}>
          <Text style={styles.title}>Catalog</Text>
          <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload} disabled={uploading}>
            <Text style={styles.uploadBtnText}>{uploading ? 'Uploading...' : '+ Upload'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sortRow}>
          <TouchableOpacity
            style={[styles.sortBtn, sortBy === 'recent' && styles.sortBtnActive]}
            onPress={() => setSortBy('recent')}>
            <Text style={[styles.sortText, sortBy === 'recent' && styles.sortTextActive]}>Recent</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortBtn, sortBy === 'popular' && styles.sortBtnActive]}
            onPress={() => setSortBy('popular')}>
            <Text style={[styles.sortText, sortBy === 'popular' && styles.sortTextActive]}>Popular</Text>
          </TouchableOpacity>
        </View>

        <ScrollView>
          <View style={styles.grid}>
            {photos.map(photo => (
              <TouchableOpacity
                key={photo.id}
                style={styles.tile}
                onPress={() => openPhoto(photo)}>
                <Image source={{ uri: getPhotoUrl(photo.storage_path) }} style={styles.tileImage} />
                <View style={styles.tileStats}>
                  <Text style={styles.tileStatsText}>♥ {photo.heart_count || 0}</Text>
                </View>
                <TouchableOpacity
                  style={styles.starBtn}
                  onPress={(e) => { e.stopPropagation(); toggleStar(photo.id) }}>
                  <Text style={[styles.starIcon, starredIds.has(photo.id) && styles.starIconActive]}>★</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
          {photos.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No photos yet</Text>
              <Text style={styles.emptySubtext}>Take a photo or upload one to get started</Text>
            </View>
          )}
        </ScrollView>

        <Modal visible={!!selectedPhoto} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedPhoto(null)}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            {selectedPhoto && (
              <Image
                source={{ uri: getPhotoUrl(selectedPhoto.storage_path) }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            )}
            <View style={styles.commentBox}>
              <ScrollView style={styles.commentList}>
                {comments.map(c => (
                  <View key={c.id} style={styles.commentRow}>
                    <Text style={styles.commentAuthor}>{c.profiles?.display_name}</Text>
                    <Text style={styles.commentText}>{c.body}</Text>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.commentInputRow}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Add a comment..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={commentText}
                  onChangeText={setCommentText}
                  onSubmitEditing={sendComment}
                />
                <TouchableOpacity onPress={sendComment}>
                  <Text style={styles.commentSend}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </LinearGradient>
  )
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    title: { fontSize: 20, fontWeight: '700', color: colors.text },
    uploadBtn: { borderWidth: 0.5, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
    uploadBtnText: { color: colors.text, fontSize: 13 },
    sortRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
    sortBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: 'transparent' },
    sortBtnActive: { backgroundColor: colors.inputBackground },
    sortText: { fontSize: 13, color: colors.textMuted },
    sortTextActive: { color: colors.text, fontWeight: '500' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 0 },
    tile: { width: TILE_SIZE, height: TILE_SIZE, marginRight: GAP, marginBottom: GAP, position: 'relative' },
    tileImage: { width: '100%', height: '100%', backgroundColor: colors.inputBackground },
    // Overlay badges sit directly on top of photos, need consistent contrast
    // against arbitrary image content regardless of theme — kept fixed.
    tileStats: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
    tileStatsText: { fontSize: 10, color: '#fff' },
    starBtn: { position: 'absolute', bottom: 4, left: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
    starIcon: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
    starIconActive: { color: '#FFD700' },
    emptyState: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: 15, color: colors.text, marginBottom: 6 },
    emptySubtext: { fontSize: 12, color: colors.textMuted },
    // Lightbox/comment overlay: intentionally fixed dark regardless of theme,
    // same reasoning as the other photo-viewer screens.
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
    closeBtn: { position: 'absolute', top: 40, right: 20, zIndex: 10 },
    closeBtnText: { color: '#fff', fontSize: 24 },
    fullImage: { width: '90%', height: '70%' },
    commentBox: { position: 'absolute', bottom: 40, right: 20, width: 260, maxHeight: 200, backgroundColor: 'rgba(20,20,30,0.95)', borderRadius: 12, padding: 12 },
    commentList: { maxHeight: 120, marginBottom: 8 },
    commentRow: { marginBottom: 6 },
    commentAuthor: { fontSize: 11, fontWeight: '600', color: '#fff' },
    commentText: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
    commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 8 },
    commentInput: { flex: 1, fontSize: 12, color: '#fff' },
    commentSend: { fontSize: 12, color: '#4a90e2', fontWeight: '500' },
  })
}