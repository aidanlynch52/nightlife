import { useEffect, useState } from 'react'
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

export default function MessagesScreen({ navigation }) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadConversations()
  }, [user])

  async function loadConversations() {
    // Get all people user has shared a night with
    const { data: attendances } = await supabase
      .from('event_attendees')
      .select('event_id')
      .eq('user_id', user.id)

    if (!attendances?.length) { setLoading(false); return }

    const eventIds = attendances.map(a => a.event_id)

    const { data: coAttendees } = await supabase
      .from('event_attendees')
      .select('user_id')
      .in('event_id', eventIds)
      .neq('user_id', user.id)

    if (!coAttendees?.length) { setLoading(false); return }

    const uniqueUserIds = [...new Set(coAttendees.map(a => a.user_id))]

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', uniqueUserIds)

    // For each person, check if there's an existing conversation
    const convos = await Promise.all((profiles || []).map(async profile => {
      const { data: existing } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id)

      let lastMessage = null
      let conversationId = null

      if (existing?.length) {
        const convIds = existing.map(e => e.conversation_id)
        const { data: theirConvos } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', profile.id)
          .in('conversation_id', convIds)

        if (theirConvos?.length) {
          conversationId = theirConvos[0].conversation_id
          const { data: msgs } = await supabase
            .from('messages')
            .select('content, created_at, sender_id')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(1)
          lastMessage = msgs?.[0] || null
        }
      }

      return { profile, conversationId, lastMessage }
    }))

    // Sort: conversations with messages first, then by most recent
    convos.sort((a, b) => {
      if (a.lastMessage && !b.lastMessage) return -1
      if (!a.lastMessage && b.lastMessage) return 1
      if (a.lastMessage && b.lastMessage) {
        return new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at)
      }
      return 0
    })

    setConversations(convos)
    setLoading(false)
  }

  async function openOrCreateConversation(profile, existingConversationId) {
    let convId = existingConversationId

    if (!convId) {
      const { data: newConvo } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single()

      convId = newConvo.id

      await supabase.from('conversation_participants').insert([
        { conversation_id: convId, user_id: user.id },
        { conversation_id: convId, user_id: profile.id },
      ])
    }

    // Navigate to conversation - we'll use router
    const { router } = await import('expo-router')
    router.push({
      pathname: '/(tabs)/conversation',
      params: {
        conversationId: convId,
        otherUserId: profile.id,
        otherUserName: profile.display_name,
        otherUserAvatar: profile.avatar_url || '',
      }
    })
  }

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.loadingText}>Loading...</Text>
    </SafeAreaView>
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>
      <ScrollView>
        {conversations.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Share a night with someone to start messaging</Text>
          </View>
        )}
        {conversations.map(({ profile, conversationId, lastMessage }) => (
          <TouchableOpacity
            key={profile.id}
            style={styles.convoRow}
            onPress={() => openOrCreateConversation(profile, conversationId)}>
            <View style={styles.avatar}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{profile.display_name?.charAt(0) || '?'}</Text>
              )}
            </View>
            <View style={styles.convoInfo}>
              <Text style={styles.convoName}>{profile.display_name}</Text>
              {lastMessage ? (
                <Text style={styles.convoPreview} numberOfLines={1}>
                  {lastMessage.sender_id === user.id ? 'You: ' : ''}{lastMessage.content}
                </Text>
              ) : (
                <Text style={styles.convoPreviewEmpty}>Tap to start a conversation</Text>
              )}
            </View>
            {lastMessage && (
              <Text style={styles.convoTime}>
                {new Date(lastMessage.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#ebebeb' },
  title: { fontSize: 24, fontWeight: '700', color: '#111' },
  loadingText: { textAlign: 'center', marginTop: 40, color: '#888' },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: '#333', marginBottom: 6 },
  emptySubtext: { fontSize: 13, color: '#888' },
  convoRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ddd' },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { fontSize: 18, fontWeight: '600', color: '#555' },
  convoInfo: { flex: 1 },
  convoName: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 2 },
  convoPreview: { fontSize: 13, color: '#888' },
  convoPreviewEmpty: { fontSize: 13, color: '#bbb', fontStyle: 'italic' },
  convoTime: { fontSize: 11, color: '#aaa' },
})