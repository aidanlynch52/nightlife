import { useEffect, useState } from 'react'
import { Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const PHOTO_SIZE = (SCREEN_WIDTH - 48) / 3

function getPhotoUrl(path) {
  const { data } = supabase.storage.from('Photos').getPublicUrl(path)
  return data.publicUrl
}

export default function CreatePostScreen({ onClose, eventId, onPostCreated }) {
  const { user } = useAuth()
  const [step, setStep] = useState('select_night')
  const [nights, setNights] = useState([])
  const [selectedNight, setSelectedNight] = useState(eventId ? { id: eventId } : null)
  const [photos, setPhotos] = useState([])
  const [selectedPhotos, setSelectedPhotos] = useState([])
  const [caption, setCaption] = useState('')
  const [songs, setSongs] = useState([])
  const [selectedSongs, setSelectedSongs] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    if (eventId) {
      setSelectedNight({ id: eventId })
      setStep('select_photos')
      loadPhotos(eventId)
    } else {
      loadNights()
    }
  }, [eventId, user?.id])

  async function loadNights() {
    if (!user?.id) return
    const { data: attendances } = await supabase.from('event_attendees').select('event_id').eq('user_id', user.id)
    if (!attendances?.length) return
    const eventIds = attendances.map(a => a.event_id)
    const { data } = await supabase
      .from('events')
      .select('id, name, created_at, photo_count')
      .in('id', eventIds)
      .eq('status', 'closed')
      .gt('photo_count', 0)
      .order('created_at', { ascending: false })
    setNights(data || [])
  }

  async function loadPhotos(eid) {
    const { data } = await supabase
      .from('photos')
      .select('id, storage_path')
      .eq('event_id', eid)
      .order('created_at', { ascending: false })
    setPhotos(data || [])
  }

  async function loadNightSongs(eid) {
    const { data } = await supabase.from('songs').select('*').eq('event_id', eid)
    setSongs(data || [])
  }

  function togglePhoto(photo) {
    setSelectedPhotos(prev =>
      prev.find(p => p.id === photo.id)
        ? prev.filter(p => p.id !== photo.id)
        : [...prev, photo]
    )
  }

  function toggleSong(song) {
    setSelectedSongs(prev =>
      prev.find(s => s.id === song.id)
        ? prev.filter(s => s.id !== song.id)
        : [...prev, song]
    )
  }

  async function searchSpotify(query) {
    if (!query.trim()) { setSearchResults([]); return }
    setSearching(true)
    try {
      const { data: tokenData } = await supabase
        .from('spotify_tokens')
        .select('access_token')
        .eq('user_id', user.id)
        .single()
      if (!tokenData) { setSearching(false); return }
      const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=8`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      const data = await res.json()
      setSearchResults(data.tracks?.items || [])
    } catch (e) {
      console.error('Search error:', e)
    }
    setSearching(false)
  }

  async function handlePost() {
    if (selectedPhotos.length === 0) return
    setPosting(true)
    try {
      const { data: post, error } = await supabase
        .from('posts')
        .insert({ user_id: user.id, event_id: selectedNight.id, caption: caption.trim() || null })
        .select()
        .single()
      if (error) { console.error(error); setPosting(false); return }
      if (selectedPhotos.length > 0) {
        await supabase.from('post_photos').insert(
          selectedPhotos.map((p, i) => ({ post_id: post.id, photo_id: p.id, display_order: i }))
        )
      }
      if (selectedSongs.length > 0) {
        await supabase.from('post_songs').insert(
          selectedSongs.map((s, i) => ({
            post_id: post.id,
            spotify_track_id: s.spotify_track_id || s.id,
            track_name: s.track_name || s.name,
            artist_name: s.artist_name || s.artists?.[0]?.name || '',
            album_art_url: s.album_art_url || s.album?.images?.[0]?.url || null,
            display_order: i,
          }))
        )
      }
      onPostCreated?.()
      onClose()
    } catch (e) {
      console.error(e)
    }
    setPosting(false)
  }

  return (
    <Modal visible animationType="slide">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.headerCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {step === 'select_night' ? 'Pick a night' : step === 'select_photos' ? 'Select photos' : 'Add details'}
          </Text>
          {step === 'select_photos' && selectedPhotos.length > 0 && (
            <TouchableOpacity onPress={() => { setStep('add_details'); loadNightSongs(selectedNight.id) }}>
              <Text style={styles.headerNext}>Next</Text>
            </TouchableOpacity>
          )}
          {step === 'add_details' && (
            <TouchableOpacity onPress={handlePost} disabled={posting}>
              <Text style={styles.headerNext}>{posting ? 'Posting...' : 'Post'}</Text>
            </TouchableOpacity>
          )}
          {step !== 'select_photos' && step !== 'add_details' && <View style={{ width: 50 }} />}
        </View>

        {step === 'select_night' && (
          <ScrollView style={{ flex: 1 }}>
            {nights.map(night => (
              <TouchableOpacity
                key={night.id}
                style={styles.nightRow}
                onPress={() => {
                  setSelectedNight(night)
                  loadPhotos(night.id)
                  setStep('select_photos')
                }}>
                <View style={styles.nightInfo}>
                  <Text style={styles.nightName}>{night.name}</Text>
                  <Text style={styles.nightMeta}>
                    {new Date(night.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    {' · '}{night.photo_count} photos
                  </Text>
                </View>
                <Text style={styles.nightArrow}>›</Text>
              </TouchableOpacity>
            ))}
            {!nights.length && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No nights yet</Text>
                <Text style={styles.emptySubtext}>Attend and end a night with photos to create a post</Text>
              </View>
            )}
          </ScrollView>
        )}

        {step === 'select_photos' && (
          <View style={{ flex: 1 }}>
            <Text style={styles.selectionHint}>
              {selectedPhotos.length === 0 ? 'Tap photos to select' : `${selectedPhotos.length} selected`}
            </Text>
            <ScrollView>
              <View style={styles.photoGrid}>
                {photos.map(photo => {
                  const selected = selectedPhotos.find(p => p.id === photo.id)
                  const selectedIndex = selectedPhotos.findIndex(p => p.id === photo.id)
                  return (
                    <TouchableOpacity
                      key={photo.id}
                      style={[styles.photoTile, selected && styles.photoTileSelected]}
                      onPress={() => togglePhoto(photo)}>
                      <Image source={{ uri: getPhotoUrl(photo.storage_path) }} style={styles.photoImg} />
                      {selected && (
                        <View style={styles.photoCheckmark}>
                          <Text style={styles.photoCheckmarkText}>{selectedIndex + 1}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {step === 'add_details' && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedPhotosRow}>
              {selectedPhotos.map(photo => (
                <Image key={photo.id} source={{ uri: getPhotoUrl(photo.storage_path) }} style={styles.selectedPhotoThumb} />
              ))}
            </ScrollView>

            <Text style={styles.detailLabel}>Caption</Text>
            <TextInput
              style={styles.captionInput}
              value={caption}
              onChangeText={setCaption}
              placeholder="Write a caption..."
              placeholderTextColor="#aaa"
              multiline
              maxLength={300}
            />
            <Text style={styles.charCount}>{caption.length}/300</Text>

            <Text style={styles.detailLabel}>Songs</Text>
            {songs.length > 0 && (
              <View style={styles.nightSongs}>
                <Text style={styles.nightSongsLabel}>From this night</Text>
                {songs.map(song => (
                  <TouchableOpacity
                    key={song.id}
                    style={[styles.songRow, selectedSongs.find(s => s.id === song.id) && styles.songRowSelected]}
                    onPress={() => toggleSong(song)}>
                    {song.album_art_url && <Image source={{ uri: song.album_art_url }} style={styles.songArt} />}
                    <View style={styles.songInfo}>
                      <Text style={styles.songName}>{song.track_name}</Text>
                      <Text style={styles.songArtist}>{song.artist_name}</Text>
                    </View>
                    {selectedSongs.find(s => s.id === song.id) && <Text style={styles.songCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.searchLabel}>Search Spotify</Text>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={q => { setSearchQuery(q); searchSpotify(q) }}
              placeholder="Search for a song..."
              placeholderTextColor="#aaa"
            />
            {searching && <Text style={styles.searchingText}>Searching...</Text>}
            {searchResults.map(track => (
              <TouchableOpacity
                key={track.id}
                style={[styles.songRow, selectedSongs.find(s => (s.spotify_track_id || s.id) === track.id) && styles.songRowSelected]}
                onPress={() => toggleSong(track)}>
                {track.album?.images?.[0] && <Image source={{ uri: track.album.images[0].url }} style={styles.songArt} />}
                <View style={styles.songInfo}>
                  <Text style={styles.songName}>{track.name}</Text>
                  <Text style={styles.songArtist}>{track.artists?.[0]?.name}</Text>
                </View>
                {selectedSongs.find(s => (s.spotify_track_id || s.id) === track.id) && <Text style={styles.songCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#ebebeb' },
  headerCancel: { fontSize: 15, color: '#888', width: 60 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  headerNext: { fontSize: 15, fontWeight: '600', color: '#111', width: 60, textAlign: 'right' },
  nightRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  nightInfo: { flex: 1 },
  nightName: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 2 },
  nightMeta: { fontSize: 12, color: '#888' },
  nightArrow: { fontSize: 20, color: '#ccc' },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: '#333', marginBottom: 6 },
  emptySubtext: { fontSize: 12, color: '#888', textAlign: 'center', paddingHorizontal: 32 },
  selectionHint: { fontSize: 13, color: '#888', textAlign: 'center', paddingVertical: 10 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 2 },
  photoTile: { width: PHOTO_SIZE, height: PHOTO_SIZE, margin: 2, position: 'relative' },
  photoTileSelected: { opacity: 0.85 },
  photoImg: { width: '100%', height: '100%' },
  photoCheckmark: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  photoCheckmarkText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  selectedPhotosRow: { marginBottom: 16 },
  selectedPhotoThumb: { width: 80, height: 80, borderRadius: 8, marginRight: 8 },
  detailLabel: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 16 },
  captionInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, color: '#111', backgroundColor: '#f9f9f9', minHeight: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#bbb', textAlign: 'right', marginTop: 4 },
  nightSongs: { marginBottom: 8 },
  nightSongsLabel: { fontSize: 11, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  searchLabel: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 8 },
  searchInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, fontSize: 14, color: '#111', backgroundColor: '#f9f9f9', marginBottom: 8 },
  searchingText: { color: '#aaa', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  songRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, marginBottom: 4, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ebebeb' },
  songRowSelected: { backgroundColor: '#f0f0f0', borderColor: '#111' },
  songArt: { width: 44, height: 44, borderRadius: 6, marginRight: 10 },
  songInfo: { flex: 1 },
  songName: { fontSize: 13, fontWeight: '500', color: '#111' },
  songArtist: { fontSize: 11, color: '#888' },
  songCheck: { fontSize: 16, color: '#111' },
})