import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const isMobile = SCREEN_WIDTH < 600

function getPhotoUrl(path) {
  const { data } = supabase.storage.from('Photos').getPublicUrl(path)
  return data.publicUrl
}

export default function ViewProfileScreen() {
  const { colors } = useTheme()
  const styles = createStyles(colors)
  const { userId } = useLocalSearchParams()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('posts')
  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState(null)
  const [blocked, setBlocked] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  useEffect(() => {
    if (userId) loadProfile()
  }, [userId])

  async function loadProfile() {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_profile_view', { p_target_id: userId })
    if (error || !data || data.relationship === 'none') {
      setBlocked(true)
      setLoading(false)
      return
    }
    setProfileData(data)
    setLoading(false)
  }

  async function sendFriendRequest() {
    await supabase.from('connection_requests').insert({
      sender_id: user.id,
      receiver_id: userId,
    })
    setRequestSent(true)
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><Text style={styles.dim}>Loading...</Text></View>
      </SafeAreaView>
    )
  }

  if (blocked) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={styles.dim}>You haven't met this person yet</Text>
        </View>
      </SafeAreaView>
    )
  }

  const medalConfig = [
    { key: 'gold', circle: styles.goldCircle, emoji: '🥇' },
    { key: 'silver', circle: styles.silverCircle, emoji: '🥈' },
    { key: 'bronze', circle: styles.bronzeCircle, emoji: '🥉' },
  ]

  const showAddFriend = profileData.relationship === 'met'
  const firstName = profileData.display_name?.split(' ')[0] || 'them'

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.backRow}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
      </View>

      <ScrollView bounces={true} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.topRow}>
          <View style={styles.leftCol}>
            <View style={styles.avatar}>
              {profileData.avatar_url ? (
                <Image source={{ uri: profileData.avatar_url }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text style={styles.avatarText}>{profileData.display_name?.charAt(0) || '?'}</Text>
              )}
            </View>
<View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
  <View>
    <Text style={styles.name}>{profileData.display_name}</Text>
    <Text style={[styles.username, { marginTop: 2 }]}>@{profileData.username}</Text>
  </View>
  {showAddFriend && (
    <TouchableOpacity
      style={[styles.addFriendBtn, requestSent && styles.addFriendBtnDisabled]}
      disabled={requestSent}
      onPress={sendFriendRequest}>
      <Text style={styles.addFriendText}>{requestSent ? 'Pending' : 'Add friend'}</Text>
    </TouchableOpacity>
  )}
</View>
          </View>
          <View style={styles.statsRight}>
            <View style={styles.statItem}><Text style={styles.statNum}>{profileData.nights}</Text><Text style={styles.statLabel}>Nights</Text></View>
            <View style={styles.statItem}><Text style={styles.statNum}>{profileData.friends}</Text><Text style={styles.statLabel}>Friends</Text></View>
            <View style={styles.statItem}><Text style={styles.statNum}>{profileData.met}</Text><Text style={styles.statLabel}>Met</Text></View>
          </View>
        </View>

        <View style={styles.medalsSection}>
          {profileData.medals_allowed ? (
            <View style={styles.medalsRow}>
              {medalConfig.map(m => {
                const medal = profileData.medals?.[m.key]
                return (
                  <View key={m.key} style={styles.medalWrapper}>
                    <View style={[styles.medalCircle, m.circle]}>
                      {medal?.photo_path ? (
                        <Image source={{ uri: getPhotoUrl(medal.photo_path) }} style={{ width: '100%', height: '100%', borderRadius: 38 }} resizeMode="cover" />
                      ) : (
                        <Text style={styles.medalEmoji}>{m.emoji}</Text>
                      )}
                    </View>
                    <Text style={styles.medalLabel} numberOfLines={2}>{medal?.event_name || '—'}</Text>
                  </View>
                )
              })}
            </View>
          ) : (
            <View style={styles.medalsRow}>
              {medalConfig.map(m => (
                <View key={m.key} style={styles.medalWrapper}>
                  <View style={[styles.medalCircle, styles.medalCircleLocked]}>
                    <Text style={styles.lockIcon}>🔒</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          {!profileData.medals_allowed && (
            <Text style={styles.lockedText}> </Text>
          )}
        </View>

        <View style={styles.tabs}>
          {['posts', 'stats'].map(tab => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'posts' && (
          profileData.posts_allowed ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {(profileData.posts || []).map(post => (
                <View key={post.id} style={styles.postTile}>
                  {post.photo_path ? (
                    <Image source={{ uri: getPhotoUrl(post.photo_path) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View style={[styles.postTile, styles.postTilePlaceholder]}>
                      <Text style={{ fontSize: 20 }}>📷</Text>
                    </View>
                  )}
                </View>
              ))}
              {(!profileData.posts || profileData.posts.length === 0) && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No posts yet</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.lockedSection}>
              <Text style={styles.lockedText}> </Text>
              <Text style={styles.lockedText}> </Text>
              <Text style={styles.lockedText}>Add {firstName} as a friend to see this information</Text>
            </View>
          )
        )}

        {activeTab === 'stats' && (
          profileData.stats_allowed ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No stats yet</Text>
            </View>
          ) : (
            <View style={styles.lockedSection}>
              <Text style={styles.lockIcon}>🔒</Text>
              <Text style={styles.lockedText}>Add {firstName} as a friend to see this information</Text>
            </View>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function createStyles(colors) {
  const TILE = (SCREEN_WIDTH - 4) / 3
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    backRow: { padding: 16, paddingBottom: 8 },
    back: { fontSize: 14, color: colors.textSecondary },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    dim: { color: colors.textMuted, fontSize: 14 },

    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    leftCol: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    avatar: { width: isMobile ? 52 : 70, height: isMobile ? 52 : 70, borderRadius: isMobile ? 26 : 35, backgroundColor: colors.inputBackground, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderStrong, overflow: 'hidden' },
    avatarText: { fontSize: isMobile ? 20 : 26, fontWeight: '600', color: colors.textSecondary },
    name: { fontSize: isMobile ? 15 : 20, fontWeight: '600', color: colors.text },
    username: { fontSize: isMobile ? 12 : 15, color: colors.textSecondary },

    addFriendBtn: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#3B82F6', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8 },
addFriendBtnDisabled: { opacity: 0.5 },
addFriendText: { fontSize: 13, color: '#3B82F6', fontWeight: '700' },
    statsRight: { flexDirection: 'row', gap: isMobile ? 10 : 16, alignItems: 'center' },
    statItem: { alignItems: 'center' },
    statNum: { fontSize: isMobile ? 18 : 25, fontWeight: '600', color: colors.text },
    statLabel: { fontSize: isMobile ? 10 : 12, color: colors.textSecondary, marginTop: 2 },

    medalsSection: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
    medalsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
    medalWrapper: { alignItems: 'center', gap: 4, width: isMobile ? 70 : 90 },
    medalCircle: { width: isMobile ? 60 : 80, height: isMobile ? 60 : 80, borderRadius: isMobile ? 30 : 40, alignItems: 'center', justifyContent: 'center', borderWidth: 2, overflow: 'hidden' },
    medalCircleLocked: { borderColor: colors.borderStrong, backgroundColor: colors.inputBackground },
    goldCircle: { borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.08)' },
    silverCircle: { borderColor: '#B8B8B8', backgroundColor: 'rgba(184,184,184,0.08)' },
    bronzeCircle: { borderColor: '#CD7F32', backgroundColor: 'rgba(205,127,50,0.08)' },
    medalEmoji: { fontSize: isMobile ? 18 : 24 },
    medalLabel: { fontSize: 9, color: colors.textSecondary, fontWeight: '500', letterSpacing: 0.5, textAlign: 'center' },

    tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
    tab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: colors.text },
    tabText: { fontSize: 11, color: colors.textSecondary },
    tabTextActive: { color: colors.text, fontWeight: '600' },

    postTile: { width: TILE, height: TILE, margin: 0.5 },
    postTilePlaceholder: { backgroundColor: colors.inputBackground, alignItems: 'center', justifyContent: 'center' },

    emptyState: { alignItems: 'center', paddingTop: 48, paddingBottom: 40, width: '100%' },
    emptyText: { fontSize: 15, color: colors.text },

    lockedSection: { alignItems: 'center', paddingTop: 48, paddingBottom: 40, paddingHorizontal: 40, gap: 10 },
    lockIcon: { fontSize: 28, opacity: 0.4 },
    lockedText: { fontSize: 15, color: colors.textMuted, textAlign: 'center' },
  })
}