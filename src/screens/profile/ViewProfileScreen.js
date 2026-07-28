import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../../contexts/ThemeContext'
import { supabase } from '../../lib/supabase'

function getPhotoUrl(path) {
  const { data } = supabase.storage.from('Photos').getPublicUrl(path)
  return data.publicUrl
}

export default function ViewProfileScreen() {
  const { colors } = useTheme()
  const styles = createStyles(colors)
  const { userId } = useLocalSearchParams()
  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState(null)
  const [blocked, setBlocked] = useState(false)

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
    { key: 'gold', emoji: '🥇', color: '#FFD700' },
    { key: 'silver', emoji: '🥈', color: '#B8B8B8' },
    { key: 'bronze', emoji: '🥉', color: '#CD7F32' },
  ]

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.topRow}>
          <View style={styles.avatar}>
            {profileData.avatar_url ? (
              <Image source={{ uri: profileData.avatar_url }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Text style={styles.avatarText}>{profileData.display_name?.charAt(0) || '?'}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profileData.display_name}</Text>
            <Text style={styles.username}>@{profileData.username}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}><Text style={styles.statNum}>{profileData.nights}</Text><Text style={styles.statLabel}>Nights</Text></View>
          <View style={styles.statItem}><Text style={styles.statNum}>{profileData.friends}</Text><Text style={styles.statLabel}>Friends</Text></View>
          <View style={styles.statItem}><Text style={styles.statNum}>{profileData.met}</Text><Text style={styles.statLabel}>Met</Text></View>
        </View>

        {profileData.medals_allowed ? (
          <View style={styles.medalsSection}>
            <View style={styles.medalsRow}>
              {medalConfig.map(m => {
                const medal = profileData.medals?.[m.key]
                return (
                  <View key={m.key} style={styles.medalWrapper}>
                    <View style={[styles.medalCircle, { borderColor: m.color }]}>
                      {medal?.photo_path ? (
                        <Image source={{ uri: getPhotoUrl(medal.photo_path) }} style={{ width: '100%', height: '100%', borderRadius: 38 }} />
                      ) : (
                        <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
                      )}
                    </View>
                    <Text style={styles.medalLabel} numberOfLines={2}>{medal?.event_name || '—'}</Text>
                  </View>
                )
              })}
            </View>
          </View>
        ) : (
          <View style={styles.lockedSection}>
            <Text style={styles.dim}>Medals are private</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Posts</Text>
        {profileData.posts_allowed ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16 }}>
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
              <Text style={[styles.dim, { padding: 16 }]}>No posts yet</Text>
            )}
          </View>
        ) : (
          <View style={styles.lockedSection}>
            <Text style={styles.dim}>Posts are private</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Statistics</Text>
        {profileData.stats_allowed ? (
          <View style={styles.lockedSection}>
            <Text style={styles.dim}>No stats yet</Text>
          </View>
        ) : (
          <View style={styles.lockedSection}>
            <Text style={styles.dim}>Statistics are private</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function createStyles(colors) {
  const TILE = 110
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    back: { fontSize: 14, color: colors.textSecondary },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    dim: { color: colors.textMuted, fontSize: 14 },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
    avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.inputBackground, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderStrong, overflow: 'hidden' },
    avatarText: { fontSize: 22, fontWeight: '600', color: colors.textSecondary },
    name: { fontSize: 18, fontWeight: '700', color: colors.text },
    username: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    statItem: { alignItems: 'center' },
    statNum: { fontSize: 20, fontWeight: '600', color: colors.text },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    medalsSection: { paddingVertical: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
    medalsRow: { flexDirection: 'row', gap: 16 },
    medalWrapper: { alignItems: 'center', gap: 4, width: 80 },
    medalCircle: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    medalLabel: { fontSize: 9, color: colors.textSecondary, textAlign: 'center' },
    sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.text, padding: 16, paddingBottom: 8 },
    lockedSection: { padding: 24, alignItems: 'center' },
    postTile: { width: TILE, height: TILE, margin: 1 },
    postTilePlaceholder: { backgroundColor: colors.inputBackground, alignItems: 'center', justifyContent: 'center' },
  })
}