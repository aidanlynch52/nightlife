import { useEffect, useRef, useState } from 'react'
import { Dimensions, FlatList, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import CreatePostScreen from '../posts/CreatePostScreen'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const isDesktop = SCREEN_WIDTH > 600

// Post card width: 60% of screen on desktop, full width on mobile.
const CONTENT_WIDTH = isDesktop ? SCREEN_WIDTH * 0.6 : SCREEN_WIDTH
// Post photo never exceeds 66% of screen height, and never wider than the card itself.
const MAX_IMAGE_HEIGHT = SCREEN_HEIGHT * 0.66
const IMAGE_SIZE = Math.min(CONTENT_WIDTH, MAX_IMAGE_HEIGHT)

function getPhotoUrl(path) {
  const { data } = supabase.storage.from('Photos').getPublicUrl(path)
  return data.publicUrl
}

function getAvatarUrl(userId) {
  const { data } = supabase.storage.from('Avatars').getPublicUrl(`${userId}.jpg`)
  return data.publicUrl
}

function SearchModal({ visible, onClose, userId }) {
  const { colors } = useTheme()
  const styles = createStyles(colors)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [sharedNightIds, setSharedNightIds] = useState(new Set())
  const [sentRequests, setSentRequests] = useState(new Set())

  useEffect(() => {
    if (!visible) { setQuery(''); setResults([]) }
  }, [visible])

  async function searchAccounts(text) {
    setQuery(text)
    if (!text.trim()) { setResults([]); return }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .neq('id', userId)
      .or(`display_name.ilike.%${text}%,username.ilike.%${text}%`)
      .limit(15)

    if (!profiles?.length) { setResults([]); return }

    const { data: myEvents } = await supabase
      .from('event_attendees')
      .select('event_id')
      .eq('user_id', userId)
    const myEventIds = new Set((myEvents || []).map(e => e.event_id))

    const withShared = new Set()
    await Promise.all(profiles.map(async p => {
      const { data: theirEvents } = await supabase
        .from('event_attendees')
        .select('event_id')
        .eq('user_id', p.id)
      const shared = (theirEvents || []).some(e => myEventIds.has(e.event_id))
      if (shared) withShared.add(p.id)
    }))

    setSharedNightIds(withShared)
    setResults(profiles)
  }

  async function sendFriendRequest(receiverId) {
    await supabase.from('connection_requests').insert({
      sender_id: userId,
      receiver_id: receiverId,
    })
    setSentRequests(prev => new Set(prev).add(receiverId))
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <TouchableOpacity style={styles.searchBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.searchCenter}>
        <View style={styles.searchSheet}>
          <View style={styles.searchHeader}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search accounts"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={searchAccounts}
              autoFocus
            />
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.searchCancel}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={results}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 320 }}
            renderItem={({ item }) => {
              const canAdd = sharedNightIds.has(item.id)
              return (
                <View style={styles.resultRow}>
                  <View style={styles.resultAvatar}>
                    <Image
                      source={{ uri: item.avatar_url || getAvatarUrl(item.id) }}
                      style={styles.resultAvatarImg}
                    />
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{item.display_name}</Text>
                    <Text style={styles.resultUsername}>@{item.username}</Text>
                  </View>
                  {canAdd && (
                    <TouchableOpacity
                      style={[styles.addBtn, sentRequests.has(item.id) && styles.addBtnDisabled]}
                      disabled={sentRequests.has(item.id)}
                      onPress={() => sendFriendRequest(item.id)}>
                      <Text style={styles.addBtnText}>
                        {sentRequests.has(item.id) ? 'Pending' : 'Add'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
            }}
            ListEmptyComponent={
              query.trim() ? (
                <Text style={styles.noResults}>No accounts found</Text>
              ) : null
            }
          />
        </View>
      </View>
    </Modal>
  )
}

function PostCard({ post, styles }) {
  const sortedPhotos = (post.post_photos || []).slice().sort((a, b) => a.display_order - b.display_order)
  const firstPhoto = sortedPhotos[0]
  const extraCount = sortedPhotos.length - 1

  return (
    <View style={styles.postCardWrap}>
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.postAvatar}>
            {post.profiles?.avatar_url ? (
              <Image source={{ uri: post.profiles.avatar_url }} style={styles.postAvatarImg} />
            ) : (
              <Text style={styles.postAvatarText}>{post.profiles?.display_name?.charAt(0) || '?'}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.postAuthor}>{post.profiles?.display_name}</Text>
            {post.events?.name && <Text style={styles.postEvent}>{post.events.name}</Text>}
          </View>
        </View>

        {firstPhoto?.photos?.storage_path && (
          <View style={styles.postImageWrap}>
            <Image
              source={{ uri: getPhotoUrl(firstPhoto.photos.storage_path) }}
              style={styles.postImage}
              resizeMode="cover"
            />
            {extraCount > 0 && (
              <View style={styles.postMoreBadge}>
                <Text style={styles.postMoreBadgeText}>+{extraCount}</Text>
              </View>
            )}
          </View>
        )}

        {post.caption ? <Text style={styles.postCaption}>{post.caption}</Text> : null}
      </View>
    </View>
  )
}

export default function HomeScreen() {
  const { colors } = useTheme()
  const styles = createStyles(colors)
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSearch, setShowSearch] = useState(false)
  const [showCreatePost, setShowCreatePost] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    if (user?.id) loadFeed()
  }, [user?.id])

  async function loadFeed() {
    setLoading(true)

    const { data: connections } = await supabase
      .from('connections')
      .select('user_a, user_b')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)

    const connectionIds = (connections || []).map(c => c.user_a === user.id ? c.user_b : c.user_a)

    if (!connectionIds.length) {
      setPosts([])
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('posts')
      .select('id, caption, created_at, user_id, events(name), profiles(display_name, avatar_url), post_photos(photo_id, display_order, photos(storage_path))')
      .in('user_id', connectionIds)
      .order('created_at', { ascending: false })

    setPosts(data || [])
    setLoading(false)
  }

  function handleRefresh() {
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
    loadFeed()
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleRefresh}>
          <Text style={styles.title}>NightLife</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSearch(true)}>
            <Text style={styles.iconBtnText}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowCreatePost(true)}>
            <Text style={styles.iconBtnText}>＋</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={posts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <PostCard post={item} styles={styles} />}
          contentContainerStyle={{ paddingBottom: 20, paddingTop: 8 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No posts yet</Text>
              <Text style={styles.emptySubtext}>Posts from your connections will show up here</Text>
            </View>
          }
        />
      )}

      <SearchModal visible={showSearch} onClose={() => setShowSearch(false)} userId={user?.id} />

      {showCreatePost && (
        <CreatePostScreen
          onClose={() => setShowCreatePost(false)}
          onPostCreated={() => { setShowCreatePost(false); loadFeed() }}
        />
      )}
    </SafeAreaView>
  )
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    title: { fontSize: 20, fontWeight: '700', color: colors.text },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    iconBtnText: { fontSize: 18, color: colors.text },

    emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
    emptyText: { fontSize: 15, color: colors.text, marginBottom: 6 },
    emptySubtext: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },

    // Post card: centered column, capped width/height per platform.
    postCardWrap: { width: '100%', alignItems: 'center' },
    postCard: { width: CONTENT_WIDTH, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 },
    postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
    postAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.inputBackground, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    postAvatarImg: { width: '100%', height: '100%' },
    postAvatarText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    postAuthor: { fontSize: 13, fontWeight: '600', color: colors.text },
    postEvent: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
    postImageWrap: { width: IMAGE_SIZE, height: IMAGE_SIZE, backgroundColor: colors.inputBackground, alignSelf: 'center', position: 'relative', borderRadius: 8, overflow: 'hidden' },
    postImage: { width: '100%', height: '100%' },
    postMoreBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
    postMoreBadgeText: { fontSize: 11, color: '#fff', fontWeight: '600' },
    postCaption: { fontSize: 13, color: colors.text, paddingHorizontal: 16, paddingTop: 10, lineHeight: 18 },

    // Search: centered popup, not full screen.
    searchBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
    searchCenter: { position: 'absolute', top: '50%', left: 0, right: 0, alignItems: 'center', transform: [{ translateY: -220 }] },
    searchSheet: { width: isDesktop ? 420 : SCREEN_WIDTH * 0.9, maxHeight: 440, backgroundColor: colors.cardBackground, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 },
    searchHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    searchInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: colors.text, backgroundColor: colors.inputBackground },
    searchCancel: { fontSize: 16, color: colors.textMuted, paddingHorizontal: 4 },
    resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    resultAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.inputBackground, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
    resultAvatarImg: { width: '100%', height: '100%' },
    resultInfo: { flex: 1 },
    resultName: { fontSize: 14, fontWeight: '500', color: colors.text },
    resultUsername: { fontSize: 12, color: colors.textMuted },
    addBtn: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.cardBackground },
    addBtnDisabled: { opacity: 0.4 },
    addBtnText: { fontSize: 12, color: colors.text, fontWeight: '500' },
    noResults: { textAlign: 'center', color: colors.textMuted, padding: 30, fontSize: 13 },
  })
}