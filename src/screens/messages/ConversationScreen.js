import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

export default function ConversationScreen() {
  const { conversationId, otherUserId, otherUserName, otherUserAvatar } = useLocalSearchParams()
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isFriend, setIsFriend] = useState(false)
  const [friendRequestSent, setFriendRequestSent] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    loadMessages()
    checkFriendship()

    const subscription = supabase
      .channel(`conversation:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new])
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
      })
      .subscribe()

    return () => supabase.removeChannel(subscription)
  }, [conversationId])

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100)
  }

  async function checkFriendship() {
    const { data } = await supabase
      .from('connections')
      .select('id')
      .or(`and(user_a.eq.${user.id},user_b.eq.${otherUserId}),and(user_a.eq.${otherUserId},user_b.eq.${user.id})`)
      .maybeSingle()
    setIsFriend(!!data)
  }

  async function sendMessage() {
    if (!input.trim()) return
    const content = input.trim()
    setInput('')
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
    })
  }

  async function sendFriendRequest() {
    await supabase.from('connection_requests').insert({
      sender_id: user.id,
      receiver_id: otherUserId,
    })
    setFriendRequestSent(true)
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerAvatar}>
          {otherUserAvatar ? (
            <Image source={{ uri: otherUserAvatar }} style={styles.headerAvatarImg} />
          ) : (
            <Text style={styles.headerAvatarText}>{otherUserName?.charAt(0) || '?'}</Text>
          )}
        </View>
        <Text style={styles.headerName}>{otherUserName}</Text>
        {!isFriend && !friendRequestSent && (
          <TouchableOpacity style={styles.addFriendBtn} onPress={sendFriendRequest}>
            <Text style={styles.addFriendText}>+ Add</Text>
          </TouchableOpacity>
        )}
        {friendRequestSent && (
          <Text style={styles.pendingText}>Pending</Text>
        )}
      </View>

      {!isFriend && (
        <View style={styles.addFriendBanner}>
          <Text style={styles.addFriendBannerText}>You met at a NightLife event. Add each other as friends?</Text>
          {!friendRequestSent ? (
            <TouchableOpacity style={styles.addFriendBannerBtn} onPress={sendFriendRequest}>
              <Text style={styles.addFriendBannerBtnText}>Send request</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.addFriendBannerSent}>Request sent ✓</Text>
          )}
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={{ padding: 16, gap: 8 }}>
        {messages.map(msg => {
          const isMine = msg.sender_id === user.id
          return (
            <View key={msg.id} style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
              <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{msg.content}</Text>
              </View>
            </View>
          )
        })}
        {messages.length === 0 && (
          <Text style={styles.emptyText}>Say hello 👋</Text>
        )}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message..."
            placeholderTextColor="#aaa"
            multiline
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
            <Text style={styles.sendBtnText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#ebebeb', gap: 10 },
  backBtn: { marginRight: 4 },
  backText: { fontSize: 22, color: '#111' },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ddd' },
  headerAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  headerAvatarText: { fontSize: 14, fontWeight: '600', color: '#555' },
  headerName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111' },
  addFriendBtn: { borderWidth: 1, borderColor: '#111', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  addFriendText: { fontSize: 12, color: '#111', fontWeight: '500' },
  pendingText: { fontSize: 12, color: '#888' },
  addFriendBanner: { backgroundColor: '#f9f9f9', borderBottomWidth: 1, borderBottomColor: '#ebebeb', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  addFriendBannerText: { flex: 1, fontSize: 12, color: '#555' },
  addFriendBannerBtn: { backgroundColor: '#111', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  addFriendBannerBtnText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  addFriendBannerSent: { fontSize: 12, color: '#1aa34a' },
  messages: { flex: 1 },
  bubbleRow: { flexDirection: 'row', marginBottom: 4 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '75%', padding: 10, borderRadius: 16, backgroundColor: '#f0f0f0' },
  bubbleMine: { backgroundColor: '#111', borderBottomRightRadius: 4 },
  bubbleTheirs: { borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, color: '#111' },
  bubbleTextMine: { color: '#fff' },
  emptyText: { textAlign: 'center', color: '#bbb', marginTop: 40, fontSize: 14 },
  inputBar: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#ebebeb', gap: 8, alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, color: '#111', backgroundColor: '#f9f9f9', maxHeight: 100 },
  sendBtn: { backgroundColor: '#111', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9 },
  sendBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
})