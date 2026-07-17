import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState } from 'react'
import { Dimensions, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../hooks/useAuth'
import { useSpotify } from '../../hooks/useSpotify'
import { supabase } from '../../lib/supabase'
import CreatePostScreen from '../posts/CreatePostScreen'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

function getPhotoUrl(path) {
  const { data } = supabase.storage.from('Photos').getPublicUrl(path)
  return data.publicUrl
}

function getAvatarUrl(userId) {
  const { data } = supabase.storage.from('Avatars').getPublicUrl(`${userId}.jpg`)
  return data.publicUrl
}

function NightCatalogModal({ night, onClose }) {
  const [photos, setPhotos] = useState([])
  const COLUMNS = SCREEN_WIDTH > 700 ? 6 : 3
  const GAP = 2
  const TILE_SIZE = (SCREEN_WIDTH - GAP * (COLUMNS - 1)) / COLUMNS

  useEffect(() => {
    async function loadPhotos() {
      if (!night?.id) return
      const { data } = await supabase.from('photos').select('id, storage_path').eq('event_id', night.id).order('created_at', { ascending: false })
      setPhotos(data || [])
    }
    loadPhotos()
  }, [night?.id])

  return (
    <LinearGradient colors={['#f0f0f0', '#ffffff']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1, minHeight: '100%' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={nightStyles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={nightStyles.modalBack}>← Back</Text></TouchableOpacity>
          <Text style={nightStyles.modalTitle}>{night?.name}</Text>
        </View>
        <ScrollView>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {photos.map(photo => (
              <Image key={photo.id} source={{ uri: getPhotoUrl(photo.storage_path) }} style={{ width: TILE_SIZE, height: TILE_SIZE, marginRight: GAP, marginBottom: GAP }} />
            ))}
          </View>
          {!photos.length && <View style={styles.emptyState}><Text style={styles.emptyText}>No photos</Text></View>}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  )
}

function NightPickerModal({ visible, onClose, onSelect, userId, excludeIds }) {
  const [nights, setNights] = useState([])

  useEffect(() => {
    async function load() {
      if (!userId || !visible) return
      const { data: attendances } = await supabase.from('event_attendees').select('event_id').eq('user_id', userId)
      if (!attendances?.length) return
      const eventIds = attendances.map(a => a.event_id)
      const { data } = await supabase.from('events').select('id, name, created_at').in('id', eventIds).eq('status', 'closed').gt('photo_count', 0).order('created_at', { ascending: false })
      setNights((data || []).filter(n => !excludeIds?.includes(n.id)))
    }
    load()
  }, [userId, visible])

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={nightStyles.editOverlay}>
        <View style={[nightStyles.editSheet, { maxHeight: '70%' }]}>
          <Text style={nightStyles.editTitle}>Pick a night</Text>
          <ScrollView>
            {nights.map(n => (
              <TouchableOpacity key={n.id} style={nightStyles.pickerRow} onPress={() => onSelect(n)}>
                <Text style={nightStyles.pickerName}>{n.name}</Text>
                <Text style={nightStyles.pickerDate}>{new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
              </TouchableOpacity>
            ))}
            {!nights.length && <Text style={{ color: '#555', padding: 16 }}>No eligible nights yet</Text>}
          </ScrollView>
          <TouchableOpacity style={[nightStyles.editCancel, { marginTop: 12 }]} onPress={onClose}>
            <Text style={nightStyles.editCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const SORT_OPTIONS = [
  { key: 'chronological', icon: 'Chronological' },
  { key: 'most_people', icon: 'Most Attended' },
  { key: 'least_people', icon: 'Least Attended' },
]

function FilterModal({ visible, onClose, onApply, userId, allNights, onSearchChange, searchText }) {
  const [minPeople, setMinPeople] = useState('')
  const [maxPeople, setMaxPeople] = useState('')
  const [friends, setFriends] = useState([])
  const [selectedFriends, setSelectedFriends] = useState([])

  useEffect(() => {
    if (!userId || !visible) return
    async function loadFriends() {
      const { data } = await supabase.from('connections').select('user_a, user_b').or(`user_a.eq.${userId},user_b.eq.${userId}`)
      if (!data?.length) return
      const friendIds = data.map(c => c.user_a === userId ? c.user_b : c.user_a)
      const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', friendIds)
      setFriends(profiles || [])
    }
    loadFriends()
  }, [userId, visible])

  function toggleFriend(id) {
    setSelectedFriends(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  }

  function handleApply() {
    onApply({ minPeople: parseInt(minPeople) || 0, maxPeople: parseInt(maxPeople) || 0, selectedFriends })
    onClose()
  }

  function handleReset() {
    setMinPeople('')
    setMaxPeople('')
    setSelectedFriends([])
    onSearchChange('')
    onApply({ minPeople: 0, maxPeople: 0, selectedFriends: [] })
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <TouchableOpacity style={filterStyles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={filterStyles.centerSheet}>
        <TouchableOpacity style={filterStyles.closeBtn} onPress={onClose}>
          <Text style={filterStyles.closeBtnText}>✕</Text>
        </TouchableOpacity>

        <Text style={filterStyles.sheetTitle}>Filter & Search</Text>

        <TextInput
          style={filterStyles.searchInput}
          placeholder="Search by night name"
          placeholderTextColor="#666"
          value={searchText}
          onChangeText={onSearchChange}
        />

        <Text style={filterStyles.sectionLabel}>Attendees</Text>
        <View style={filterStyles.peopleRow}>
          <View style={filterStyles.peopleInput}>
            <Text style={filterStyles.peopleLabel}>Min</Text>
            <TextInput
              style={filterStyles.peopleTextInput}
              value={minPeople}
              onChangeText={setMinPeople}
              placeholder="0"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
          </View>
          <Text style={filterStyles.peopleDash}>—</Text>
          <View style={filterStyles.peopleInput}>
            <Text style={filterStyles.peopleLabel}>Max</Text>
            <TextInput
              style={filterStyles.peopleTextInput}
              value={maxPeople}
              onChangeText={setMaxPeople}
              placeholder="Any"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
          </View>
        </View>

        <Text style={filterStyles.sectionLabel}>Friends</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={filterStyles.friendsScroll}>
          {friends.map(f => (
            <TouchableOpacity key={f.id} style={filterStyles.friendChip} onPress={() => toggleFriend(f.id)}>
              <View style={[filterStyles.friendAvatarWrap, selectedFriends.includes(f.id) && filterStyles.friendAvatarSelected]}>
                <Image
                  source={{ uri: getAvatarUrl(f.id) }}
                  style={filterStyles.friendAvatar}
                  defaultSource={require('../../../assets/images/icon.png')}
                />
                {selectedFriends.includes(f.id) && (
                  <View style={filterStyles.friendCheck}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>✓</Text>
                  </View>
                )}
              </View>
              <Text style={[filterStyles.friendChipName, selectedFriends.includes(f.id) && { color: '#000', fontWeight: '600' }]} numberOfLines={1}>
                {f.display_name?.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
          {!friends.length && <Text style={{ color: '#555', fontSize: 12, padding: 8 }}>No friends yet</Text>}
        </ScrollView>

        <View style={filterStyles.footer}>
          <TouchableOpacity style={filterStyles.resetBtn} onPress={handleReset}>
            <Text style={filterStyles.resetBtnText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={filterStyles.applyBtn} onPress={handleApply}>
            <Text style={filterStyles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

function NightsTab({ userId }) {
  const [nights, setNights] = useState([])
  const [filteredNights, setFilteredNights] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedNight, setSelectedNight] = useState(null)
  const [editingNight, setEditingNight] = useState(null)
  const [editName, setEditName] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [sortBy, setSortBy] = useState('chronological')
  const [searchText, setSearchText] = useState('')
  const [activeFilters, setActiveFilters] = useState({ minPeople: 0, maxPeople: 0, selectedFriends: [] })

  useEffect(() => { loadNights() }, [userId])

  async function loadNights() {
    if (!userId) return
    const { data: attendances } = await supabase.from('event_attendees').select('event_id').eq('user_id', userId)
    if (!attendances?.length) { setLoading(false); return }
    const eventIds = attendances.map(a => a.event_id)
    const { data: events } = await supabase.from('events').select('id, name, created_at, photo_count, closed_at').in('id', eventIds).eq('status', 'closed').gt('photo_count', 0).order('created_at', { ascending: false })
    if (!events?.length) { setLoading(false); return }
    const nightsWithData = await Promise.all(events.map(async event => {
      const { data: photos } = await supabase.from('photos').select('id, storage_path').eq('event_id', event.id).limit(1)
      const { count } = await supabase.from('event_attendees').select('id', { count: 'exact', head: true }).eq('event_id', event.id)
      return { ...event, coverPhoto: photos?.[0] || null, attendeeCount: count || 0 }
    }))
    setNights(nightsWithData)
    setFilteredNights(nightsWithData)
    setLoading(false)
  }

  function applyAllFilters(nights, search, filters, sort) {
    let result = [...nights]
    if (search.trim()) result = result.filter(n => n.name.toLowerCase().includes(search.toLowerCase()))
    if (filters.minPeople > 0) result = result.filter(n => n.attendeeCount >= filters.minPeople)
    if (filters.maxPeople > 0) result = result.filter(n => n.attendeeCount <= filters.maxPeople)
    if (sort === 'most_people') result.sort((a, b) => b.attendeeCount - a.attendeeCount)
    else if (sort === 'least_people') result.sort((a, b) => a.attendeeCount - b.attendeeCount)
    else result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    setFilteredNights(result)
  }

  async function applyFilters(filters) {
    setActiveFilters(filters)
    let result = [...nights]
    if (searchText.trim()) result = result.filter(n => n.name.toLowerCase().includes(searchText.toLowerCase()))
    if (filters.minPeople > 0) result = result.filter(n => n.attendeeCount >= filters.minPeople)
    if (filters.maxPeople > 0) result = result.filter(n => n.attendeeCount <= filters.maxPeople)
    if (filters.selectedFriends.length > 0) {
      const sets = await Promise.all(filters.selectedFriends.map(async fid => {
        const { data } = await supabase.from('event_attendees').select('event_id').eq('user_id', fid)
        return new Set(data?.map(a => a.event_id) || [])
      }))
      result = result.filter(n => sets.every(s => s.has(n.id)))
    }
    if (sortBy === 'most_people') result.sort((a, b) => b.attendeeCount - a.attendeeCount)
    else if (sortBy === 'least_people') result.sort((a, b) => a.attendeeCount - b.attendeeCount)
    setFilteredNights(result)
  }

  function handleSearchChange(text) {
    setSearchText(text)
    applyAllFilters(nights, text, activeFilters, sortBy)
  }

  function handleSortChange(key) {
    setSortBy(key)
    setShowSortDropdown(false)
    applyAllFilters(nights, searchText, activeFilters, key)
  }

  async function saveNightName() {
    if (!editingNight || !editName.trim()) { setEditingNight(null); return }
    await supabase.from('events').update({ name: editName.trim() }).eq('id', editingNight.id)
    setNights(nights.map(n => n.id === editingNight.id ? { ...n, name: editName.trim() } : n))
    setFilteredNights(filteredNights.map(n => n.id === editingNight.id ? { ...n, name: editName.trim() } : n))
    setEditingNight(null)
  }

  const hasActiveFilters = searchText.trim() || activeFilters.selectedFriends.length > 0 || activeFilters.minPeople > 0 || activeFilters.maxPeople > 0
  const currentSort = SORT_OPTIONS.find(s => s.key === sortBy)

  if (loading) return <View style={styles.emptyState}><Text style={styles.emptyText}>Loading...</Text></View>
  if (!nights.length) return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>No nights yet</Text>
      <Text style={styles.emptySubtext}>Every night you join will appear here once it ends</Text>
    </View>
  )

  return (
    <View style={{ padding: 16, overflow: 'visible' }}>
      <View style={nightStyles.filterRow}>
        <View style={nightStyles.sortWrap}>
          <TouchableOpacity style={nightStyles.sortBtn} onPress={() => setShowSortDropdown(!showSortDropdown)}>
  <Text style={nightStyles.sortBtnText}>{currentSort?.icon}</Text>
  <Text style={{ fontSize: 8, color: '#555', marginTop: 1 }}>▼</Text>
</TouchableOpacity>
          {showSortDropdown && (
            <View style={nightStyles.sortDropdown}>
              {SORT_OPTIONS.map(opt => (
                <TouchableOpacity key={opt.key} style={[nightStyles.sortOption, sortBy === opt.key && nightStyles.sortOptionActive]} onPress={() => handleSortChange(opt.key)}>
                  <Text style={nightStyles.sortOptionText}>{opt.icon}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[nightStyles.filterSearchBtn, hasActiveFilters && nightStyles.filterBtnActive]}
          onPress={() => setShowFilter(true)}>
          <Text style={[nightStyles.filterBtnText, hasActiveFilters && nightStyles.filterBtnTextActive]}>
            {searchText.trim() ? `"${searchText}"` : hasActiveFilters ? '⚙ Filters active' : '🔍 Filter / Search'}
          </Text>
        </TouchableOpacity>
      </View>

      {filteredNights.map(night => (
        <TouchableOpacity key={night.id} style={nightStyles.card} onPress={() => setSelectedNight(night)} onLongPress={() => { setEditingNight(night); setEditName(night.name) }}>
          {night.coverPhoto ? (
            <Image source={{ uri: getPhotoUrl(night.coverPhoto.storage_path) }} style={nightStyles.cardImage} />
          ) : (
            <View style={[nightStyles.cardImage, { backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontSize: 24 }}>🌙</Text>
            </View>
          )}
          <View style={nightStyles.cardInfo}>
            <Text style={nightStyles.cardName}>{night.name}</Text>
            <Text style={nightStyles.cardMeta}>{new Date(night.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
            <Text style={nightStyles.cardMeta}>{night.photo_count} photo{night.photo_count !== 1 ? 's' : ''} · {night.attendeeCount} people</Text>
          </View>
          <Text style={nightStyles.cardArrow}>›</Text>
        </TouchableOpacity>
      ))}

      {filteredNights.length === 0 && nights.length > 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No nights match</Text>
          <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
        </View>
      )}

      <FilterModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        onApply={applyFilters}
        userId={userId}
        allNights={nights}
        onSearchChange={handleSearchChange}
        searchText={searchText}
      />

      <Modal visible={!!selectedNight} animationType="slide">
        {selectedNight && <NightCatalogModal night={selectedNight} onClose={() => setSelectedNight(null)} />}
      </Modal>

      <Modal visible={!!editingNight} animationType="fade" transparent>
        <View style={nightStyles.editOverlay}>
          <View style={nightStyles.editSheet}>
            <Text style={nightStyles.editTitle}>Rename night</Text>
            <TextInput style={nightStyles.editInput} value={editName} onChangeText={setEditName} placeholder="Night name" placeholderTextColor="#555" autoFocus />
            <View style={nightStyles.editBtns}>
              <TouchableOpacity style={nightStyles.editCancel} onPress={() => setEditingNight(null)}><Text style={nightStyles.editCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={nightStyles.editSave} onPress={saveNightName}><Text style={nightStyles.editSaveText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function HallOfFameTab({ userId }) {
  const [hofNights, setHofNights] = useState([])
  const [showPicker, setShowPicker] = useState(false)
  const [selectedNight, setSelectedNight] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadHof() }, [userId])

  async function loadHof() {
    if (!userId) return
    const { data } = await supabase.from('hall_of_fame').select('id, event_id, display_order, events(id, name, created_at, photo_count)').eq('user_id', userId).not('event_id', 'is', null).order('display_order', { ascending: true })
    if (!data?.length) { setLoading(false); setHofNights([]); return }
    const withPhotos = await Promise.all(data.map(async item => {
      const { data: photos } = await supabase.from('photos').select('id, storage_path').eq('event_id', item.event_id).limit(4)
      return { ...item, photos: photos || [] }
    }))
    setHofNights(withPhotos)
    setLoading(false)
  }

  async function addToHof(night) {
    setShowPicker(false)
    if (hofNights.some(n => n.event_id === night.id)) return
    const { error } = await supabase.from('hall_of_fame').insert({ user_id: userId, event_id: night.id, display_order: hofNights.length })
    if (error) { console.error('HOF insert error:', JSON.stringify(error)); return }
    loadHof()
  }

  async function removeFromHof(id) {
    await supabase.from('hall_of_fame').delete().eq('id', id)
    setHofNights(hofNights.filter(n => n.id !== id))
  }

  const photoSize = Math.min(80, (SCREEN_WIDTH - 32) / 5)

  if (loading) return <View style={styles.emptyState}><Text style={styles.emptyText}>Loading...</Text></View>

  return (
    <View style={{ padding: 16 }}>
      <TouchableOpacity style={nightStyles.addBtn} onPress={() => setShowPicker(true)}>
        <Text style={nightStyles.addBtnText}>+ Add a night</Text>
      </TouchableOpacity>
      {hofNights.map(item => (
        <TouchableOpacity key={item.id} style={nightStyles.hofCard} onPress={() => setSelectedNight(item.events)} onLongPress={() => removeFromHof(item.id)}>
          <View style={nightStyles.hofPhotoGrid}>
            {item.photos.slice(0, 4).map(photo => (
              <Image key={photo.id} source={{ uri: getPhotoUrl(photo.storage_path) }} style={{ width: photoSize, height: photoSize, margin: 1, borderRadius: 4 }} />
            ))}
            {item.photos.length === 0 && (
              <View style={{ width: SCREEN_WIDTH - 32, height: 100, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 32 }}>⭐</Text>
              </View>
            )}
          </View>
          <View style={nightStyles.hofCardInfo}>
            <Text style={nightStyles.hofCardName}>{item.events?.name}</Text>
            <Text style={nightStyles.hofCardMeta}>
              {item.events?.created_at ? new Date(item.events.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
              {item.events?.photo_count ? ` · ${item.events.photo_count} photos` : ''}
            </Text>
            <Text style={nightStyles.hofCardHint}>Long press to remove</Text>
          </View>
        </TouchableOpacity>
      ))}
      {!hofNights.length && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No favorites yet</Text>
          <Text style={styles.emptySubtext}>Add your best nights to Hall of Fame</Text>
        </View>
      )}
      <NightPickerModal visible={showPicker} onClose={() => setShowPicker(false)} onSelect={addToHof} userId={userId} excludeIds={hofNights.map(n => n.event_id)} />
      <Modal visible={!!selectedNight} animationType="slide">
        {selectedNight && <NightCatalogModal night={selectedNight} onClose={() => setSelectedNight(null)} />}
      </Modal>
    </View>
  )
}
function PostsTab({ userId }) {
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadPosts() }, [userId])

  async function loadPosts() {
    if (!userId) return
    const { data } = await supabase
      .from('posts')
      .select('id, caption, created_at, events(name), post_photos(photo_id, display_order, photos(storage_path))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setPosts(data || [])
    setLoading(false)
  }

  function getPhotoUrl(path) {
    const { data } = supabase.storage.from('Photos').getPublicUrl(path)
    return data.publicUrl
  }

  const TILE = (SCREEN_WIDTH - 4) / 3

  if (loading) return <View style={styles.emptyState}><Text style={styles.emptyText}>Loading...</Text></View>

  return (
    <View>
      <TouchableOpacity
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, alignItems: 'center', margin: 16, backgroundColor: '#fff' }}
        onPress={() => setShowCreatePost(true)}>
        <Text style={{ color: '#555', fontSize: 14 }}>+ Create a post</Text>
      </TouchableOpacity>

      {!posts.length && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No posts yet</Text>
          <Text style={styles.emptySubtext}>Create your first post from a night</Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {posts.map(post => {
          const firstPhoto = post.post_photos?.sort((a, b) => a.display_order - b.display_order)?.[0]
          return (
            <TouchableOpacity key={post.id} style={{ width: TILE, height: TILE, margin: 0.5 }}>
              {firstPhoto?.photos?.storage_path ? (
                <Image
                  source={{ uri: getPhotoUrl(firstPhoto.photos.storage_path) }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{ width: '100%', height: '100%', backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 24 }}>📷</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </View>

      {showCreatePost && (
        <CreatePostScreen
          onClose={() => setShowCreatePost(false)}
          onPostCreated={() => { setShowCreatePost(false); loadPosts() }}
        />
      )}
    </View>
  )
}
function StatsTab() {
  const { connected, connectSpotify, disconnect } = useSpotify()
  const [showSpotifyModal, setShowSpotifyModal] = useState(false)

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 16 }}>
        {connected ? (
          <TouchableOpacity
            style={{ backgroundColor: '#1DB954', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}
            onPress={() => setShowSpotifyModal(true)}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>● Spotify Connected</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={{ borderWidth: 1, borderColor: '#1DB954', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}
            onPress={connectSpotify}>
            <Text style={{ color: '#1DB954', fontSize: 12, fontWeight: '600' }}>Connect Spotify</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No stats yet</Text>
        <Text style={styles.emptySubtext}>Attend nights to build your stats</Text>
      </View>

      <Modal visible={showSpotifyModal} animationType="fade" transparent>
        <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setShowSpotifyModal(false)} />
        <View style={{ position: 'absolute', top: '50%', left: 20, right: 20, transform: [{ translateY: -80 }], backgroundColor: '#fff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#ddd' }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 8 }}>Spotify Connected</Text>
          <Text style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Would you like to switch to a different Spotify account?</Text>
          <TouchableOpacity
            style={{ backgroundColor: '#1DB954', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 10 }}
            onPress={() => { setShowSpotifyModal(false); connectSpotify() }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Switch Account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 10 }}
            onPress={() => { setShowSpotifyModal(false); disconnect() }}>
            <Text style={{ color: '#cc0000', fontWeight: '500' }}>Disconnect Spotify</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSpotifyModal(false)} style={{ alignItems: 'center' }}>
            <Text style={{ color: '#888', fontSize: 13 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}
export default function ProfileScreen() {
  const [activeTab, setActiveTab] = useState('posts')
  const [avatarUri, setAvatarUri] = useState(null)
  const [profile, setProfile] = useState(null)
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [medals, setMedals] = useState({ gold: null, silver: null, bronze: null })
  const [medalPicker, setMedalPicker] = useState(null)
  const [stats, setStats] = useState({ nights: 0, friends: 0, met: 0 })
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    loadProfile(); loadMedals(); loadStats()
  }, [user])

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('display_name, username, avatar_url').eq('id', user.id).single()
    if (data) { setProfile(data); if (data.avatar_url) setAvatarUri(data.avatar_url) }
  }

  async function loadStats() {
    const { data: attendances } = await supabase.from('event_attendees').select('event_id').eq('user_id', user.id)
    let nightCount = 0
    if (attendances?.length) {
      const eventIds = attendances.map(a => a.event_id)
      const { data: closedEvents } = await supabase.from('events').select('id').in('id', eventIds).eq('status', 'closed').gt('photo_count', 0)
      nightCount = closedEvents?.length || 0
    }
    const { count: friendCount } = await supabase.from('connections').select('id', { count: 'exact', head: true }).or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    let metCount = 0
    if (attendances?.length) {
      const eventIds = attendances.map(a => a.event_id)
      const { data: coAttendees } = await supabase.from('event_attendees').select('user_id').in('event_id', eventIds).neq('user_id', user.id)
      metCount = new Set(coAttendees?.map(a => a.user_id) || []).size
    }
    setStats({ nights: nightCount, friends: friendCount || 0, met: metCount })
  }

  async function loadMedals() {
    const { data } = await supabase.from('medal_assignments').select('medal_type, event_id, events(id, name)').eq('user_id', user.id)
    if (data) {
      const m = { gold: null, silver: null, bronze: null }
      await Promise.all(data.map(async d => {
        const { data: photos } = await supabase.from('photos').select('storage_path').eq('event_id', d.event_id).limit(1)
        m[d.medal_type] = { ...d.events, coverPhoto: photos?.[0] || null }
      }))
      setMedals(m)
    }
  }

  async function assignMedal(night) {
    const type = medalPicker
    setMedalPicker(null)
    await supabase.from('medal_assignments').upsert({ user_id: user.id, event_id: night.id, medal_type: type }, { onConflict: 'user_id,medal_type' })
    const { data: photos } = await supabase.from('photos').select('storage_path').eq('event_id', night.id).limit(1)
    setMedals(prev => ({ ...prev, [type]: { ...night, coverPhoto: photos?.[0] || null } }))
  }

  async function pickAvatar() {
    if (Platform.OS === 'web') {
      const input = document.createElement('input')
      input.type = 'file'; input.accept = 'image/*'
      input.onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return
        const fileName = `${user.id}.jpg`
        const { error: uploadError } = await supabase.storage.from('Avatars').upload(fileName, file, { contentType: file.type, upsert: true })
        if (uploadError) { console.error(uploadError); return }
        const { data } = supabase.storage.from('Avatars').getPublicUrl(fileName)
        await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id)
        setAvatarUri(data.publicUrl + '?t=' + Date.now())
      }
      input.click()
    } else {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 })
      if (!result.canceled) {
        const uri = result.assets[0].uri; const fileName = `${user.id}.jpg`
        const response = await fetch(uri); const blob = await response.blob()
        const { error: uploadError } = await supabase.storage.from('Avatars').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })
        if (uploadError) { console.error(uploadError); return }
        const { data } = supabase.storage.from('Avatars').getPublicUrl(fileName)
        await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id)
        setAvatarUri(data.publicUrl + '?t=' + Date.now())
      }
    }
  }

  async function saveProfileEdits() {
    await supabase.from('profiles').update({ display_name: editName.trim(), username: editUsername.trim() }).eq('id', user.id)
    setProfile({ ...profile, display_name: editName.trim(), username: editUsername.trim() })
    setShowEditModal(false)
  }

  const medalConfig = [
    { key: 'gold', circle: styles.goldCircle, emoji: '🥇' },
    { key: 'silver', circle: styles.silverCircle, emoji: '🥈' },
    { key: 'bronze', circle: styles.bronzeCircle, emoji: '🥉' },
  ]

  return (
    <LinearGradient colors={['#e8e8e8', '#ffffff']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ScrollView bounces={true} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.topRow}>
            <View style={styles.leftCol}>
              <TouchableOpacity onPress={() => setShowAvatarModal(true)}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatar}><Text style={styles.avatarText}>{profile?.display_name ? profile.display_name.charAt(0).toUpperCase() : '?'}</Text></View>
                )}
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
  <View style={styles.nameRow}>
    <Text style={styles.name}>{profile?.display_name || 'Loading...'}</Text>
    <TouchableOpacity onPress={() => { setEditName(profile?.display_name || ''); setEditUsername(profile?.username || ''); setShowEditModal(true) }}>
      <Text style={styles.editPencil}>✎</Text>
    </TouchableOpacity>
  </View>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}>
    <Text style={styles.username}>@{profile?.username || ''}</Text>
    <TouchableOpacity
      style={styles.signOutBtn}
      onPress={() => {
        if (Platform.OS === 'web') {
          if (window.confirm('Are you sure you want to sign out?')) {
            supabase.auth.signOut()
          }
        } else {
          Alert.alert('Sign out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
          ])
        }
      }}>
      <Text style={styles.signOutText}>Sign out</Text>
    </TouchableOpacity>
  </View>
</View>
            </View>
            <View style={styles.statsRight}>
              <View style={styles.statItem}><Text style={styles.statNum}>{stats.nights}</Text><Text style={styles.statLabel}>Nights</Text></View>
              <View style={styles.statItem}><Text style={styles.statNum}>{stats.friends}</Text><Text style={styles.statLabel}>Friends</Text></View>
              <View style={styles.statItem}><Text style={styles.statNum}>{stats.met}</Text><Text style={styles.statLabel}>Met</Text></View>
            </View>
          </View>

          <View style={styles.medalsSection}>
            <View style={styles.medalsRow}>
              {medalConfig.map(m => (
                <View key={m.key} style={styles.medalWrapper}>
                  <TouchableOpacity style={[styles.medalCircle, m.circle]} onPress={() => setMedalPicker(m.key)}>
                    {medals[m.key]?.coverPhoto ? (
                      <Image source={{ uri: getPhotoUrl(medals[m.key].coverPhoto.storage_path) }} style={{ width: '100%', height: '100%', borderRadius: 38 }} resizeMode="cover" />
                    ) : (
                      <Text style={styles.medalEmoji}>{m.emoji}</Text>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.medalLabel} numberOfLines={2}>{medals[m.key] ? medals[m.key].name : 'Add night'}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.tabs}>
            {['posts', 'nights', 'hof', 'stats'].map(tab => (
              <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'hof' ? 'Hall of Fame' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {activeTab === 'posts' && <PostsTab userId={user?.id} />}
          {activeTab === 'nights' && <NightsTab userId={user?.id} />}
          {activeTab === 'hof' && <HallOfFameTab userId={user?.id} />}
          {activeTab === 'stats' && <StatsTab />}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={showAvatarModal} animationType="fade" transparent>
        <TouchableOpacity style={styles.avatarModalOverlay} activeOpacity={1} onPress={() => setShowAvatarModal(false)}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarModalImage} resizeMode="cover" />
          ) : (
            <View style={styles.avatarModalPlaceholder}>
              <Text style={{ fontSize: 64, color: '#ccc' }}>{profile?.display_name?.charAt(0).toUpperCase() || '?'}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Modal>

      <NightPickerModal visible={!!medalPicker} onClose={() => setMedalPicker(null)} onSelect={assignMedal} userId={user?.id} />

      <Modal visible={showEditModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.editModalSheet}>
            <Text style={styles.editModalTitle}>Edit profile</Text>
            <TouchableOpacity onPress={pickAvatar} style={styles.editAvatarRow}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.editAvatarImg} />
              ) : (
                <View style={styles.editAvatarImg}><Text style={{ fontSize: 24, color: '#ccc' }}>{editName ? editName.charAt(0).toUpperCase() : '?'}</Text></View>
              )}
              <Text style={styles.editAvatarLabel}>Change photo</Text>
            </TouchableOpacity>
            <Text style={styles.editLabel}>Display name</Text>
            <TextInput style={styles.editInput} value={editName} onChangeText={setEditName} placeholder="Display name" placeholderTextColor="#666" />
            <Text style={styles.editLabel}>Username</Text>
            <TextInput style={styles.editInput} value={editUsername} onChangeText={setEditUsername} placeholder="Username" placeholderTextColor="#666" autoCapitalize="none" />
            <View style={styles.editModalBtns}>
              <TouchableOpacity style={styles.editCancelBtn} onPress={() => setShowEditModal(false)}><Text style={styles.editCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.editSaveBtn} onPress={saveProfileEdits}><Text style={styles.editSaveText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  )
}

const filterStyles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  centerSheet: { position: 'absolute', top: '50%', left: SCREEN_WIDTH > 600 ? '25%' : 16, right: SCREEN_WIDTH > 600 ? '25%' : 16, transform: [{ translateY: -200 }], backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1.5, borderColor: '#888', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
  closeBtn: { position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: 14, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  closeBtnText: { color: '#666', fontSize: 13, fontWeight: '600' },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 14, textAlign: 'center' },
  sectionLabel: { fontSize: 11, color: '#444', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8, marginTop: 14 },
searchInput: { backgroundColor: '#dcd7d7', borderWidth: 1, borderColor: '#e0e0e0a4', borderRadius: 10, padding: 10, color: '#111', fontSize: 14 },
peopleTextInput: { backgroundColor: '#dcd7d7', borderWidth: 1, borderColor: '#e0e0e0b4', borderRadius: 8, padding: 8, color: '#111', fontSize: 14, textAlign: 'center', width: '100%' },
  peopleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  peopleInput: { flex: 1, alignItems: 'center' },
  peopleLabel: { fontSize: 11, color: '#555', marginBottom: 4 },
  peopleDash: { fontSize: 16, color: '#ccc', marginTop: 16 },
  friendsScroll: { marginTop: 4 },
  friendChip: { alignItems: 'center', marginRight: 14, width: 56 },
  friendAvatarWrap: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden', marginBottom: 4 },
  friendAvatarSelected: { borderColor: '#111' },
  friendAvatar: { width: '100%', height: '100%' },
  friendCheck: { position: 'absolute', bottom: 0, right: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  friendChipName: { fontSize: 10, color: '#444', textAlign: 'center' },
  footer: { flexDirection: 'row', gap: 10, paddingTop: 14, marginTop: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  resetBtn: { flex: 1, borderWidth: .75, borderColor: '#444', borderRadius: 10, padding: 11, alignItems: 'center' },
  resetBtnText: { color: '#666', fontSize: 13 },
  applyBtn: { flex: 1, backgroundColor: '#111', borderRadius: 10, padding: 11, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
})

const nightStyles = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14, zIndex: 100 },
  filterSearchBtn: { flex: 0.8, borderWidth: 1.25, borderColor: '#444', borderRadius: 10, padding: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  filterBtnActive: { backgroundColor: '#111', borderColor: '#111' },
  filterBtnText: { color: '#444', fontSize: 13 },
  filterBtnTextActive: { color: '#fff' },
  sortWrap: { flex: 0.2, position: 'relative', zIndex: 100 },
  sortOption: { padding: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  sortOptionActive: { backgroundColor: '#f5f5f5' },
  sortDropdown: { position: 'absolute', top: 44, left: 0, right: 0, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1.5, borderColor: '#888', zIndex: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
sortBtn: { borderWidth: 1.25, borderColor: '#444', borderRadius: 10, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', flexDirection: 'row', gap: 4, paddingHorizontal: 8 },
sortBtnText: { fontSize: 12, color: '#333', fontWeight: '500' },
sortOptionText: { fontSize: 12, color: '#333' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#ebebeb', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  cardImage: { width: 90, height: 90 },
  cardInfo: { flex: 1, padding: 12 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#555', marginBottom: 2 },
  cardArrow: { fontSize: 20, color: '#ccc', paddingRight: 12 },
  hofCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#ebebeb', overflow: 'hidden', maxHeight: 220, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  hofPhotoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  hofCardInfo: { padding: 14 },
  hofCardName: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 4 },
  hofCardMeta: { fontSize: 12, color: '#555', marginBottom: 4 },
  hofCardHint: { fontSize: 10, color: '#666' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#ebebeb', gap: 16 },
  modalBack: { fontSize: 14, color: '#444' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#111' },
  editOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  editSheet: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#ebebeb' },
  editTitle: { fontSize: 18, fontWeight: '600', color: '#111', marginBottom: 16 },
  editInput: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 10, color: '#111', fontSize: 14, backgroundColor: '#f9f9f9', marginBottom: 16 },
  editBtns: { flexDirection: 'row', gap: 10 },
  editCancel: { flex: 1, borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 12, alignItems: 'center' },
  editCancelText: { color: '#666', fontSize: 14 },
  editSave: { flex: 1, backgroundColor: '#111', borderRadius: 8, padding: 12, alignItems: 'center' },
  editSaveText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  pickerRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  pickerName: { fontSize: 15, fontWeight: '500', color: '#111', marginBottom: 2 },
  pickerDate: { fontSize: 12, color: '#555' },
  addBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 16, backgroundColor: '#fff' },
  addBtnText: { color: '#555', fontSize: 14 },
})

const styles = StyleSheet.create({
  container: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#ebebeb' },
  leftCol: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#e8e8e8', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ddd' },
  avatarText: { fontSize: 20, fontWeight: '500', color: '#555' },
  name: { fontSize: 20, fontWeight: '600', color: '#111' },
  username: { fontSize: 15, color: '#555', marginTop: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editPencil: { fontSize: 14, color: '#555' },
  statsRight: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: 25, fontWeight: '600', color: '#111' },
  statLabel: { fontSize: 12, color: '#555', marginTop: 2 },
  medalsSection: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#ebebeb', alignItems: 'center' },
  medalsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  medalWrapper: { alignItems: 'center', gap: 4, width: 90 },
  medalCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 2, overflow: 'hidden' },
  goldCircle: { borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.08)' },
  silverCircle: { borderColor: '#B8B8B8', backgroundColor: 'rgba(184,184,184,0.08)' },
  bronzeCircle: { borderColor: '#CD7F32', backgroundColor: 'rgba(205,127,50,0.08)' },
  medalEmoji: { fontSize: 24 },
  medalLabel: { fontSize: 9, color: '#555', fontWeight: '500', letterSpacing: 0.5, textAlign: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ebebeb' },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#111' },
  tabText: { fontSize: 11, color: '#555' },
  tabTextActive: { color: '#111', fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingTop: 48, paddingBottom: 40 },
  emptyText: { fontSize: 15, color: '#333', marginBottom: 6 },
  emptySubtext: { fontSize: 12, color: '#555' },
  avatarModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  avatarModalImage: { width: 280, height: 280, borderRadius: 140 },
  avatarModalPlaceholder: { width: 280, height: 280, borderRadius: 140, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  editModalSheet: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#ebebeb' },
  editModalTitle: { fontSize: 18, fontWeight: '600', color: '#111', marginBottom: 20 },
  editAvatarRow: { alignItems: 'center', marginBottom: 20 },
  editAvatarImg: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#e8e8e8', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  editAvatarLabel: { fontSize: 12, color: '#444' },
  editLabel: { fontSize: 11, color: '#444', marginBottom: 6, marginTop: 12 },
  editInput: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 10, color: '#111', fontSize: 14, backgroundColor: '#f9f9f9' },
  editModalBtns: { flexDirection: 'row', gap: 10, marginTop: 24 },
  editCancelBtn: { flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 12, alignItems: 'center' },
  editCancelText: { color: '#666', fontSize: 14 },
  editSaveBtn: { flex: 1, backgroundColor: '#111', borderRadius: 8, padding: 12, alignItems: 'center' },
  editSaveText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  signOutBtn: { position: 'absolute', right: -95, top: -18, borderWidth: 1, borderColor: '#e53935', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
signOutText: { color: '#e53935', fontSize: 11, fontWeight: '500' },
})