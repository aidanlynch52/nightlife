import { supabase } from '../lib/supabase'

export function useConnections() {

  async function sendRequest(receiverId, eventId) {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('connection_requests')
      .insert({ sender_id: user.id, receiver_id: receiverId, event_id: eventId })
    return { error }
  }

  async function acceptRequest(requestId) {
    const { error } = await supabase
      .from('connection_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId)
    return { error }
  }

  async function getConnections() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('connections')
      .select('*, user_a_profile:profiles!user_a(*), user_b_profile:profiles!user_b(*)')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    return { data, error }
  }

  async function getPendingRequests() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('connection_requests')
      .select('*, sender:profiles!sender_id(*)')
      .eq('receiver_id', user.id)
      .eq('status', 'pending')
    return { data, error }
  }

  async function isConnected(otherUserId) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('connections')
      .select('id')
      .or(
        `and(user_a.eq.${user.id},user_b.eq.${otherUserId}),and(user_a.eq.${otherUserId},user_b.eq.${user.id})`
      )
      .single()
    return !!data
  }

  return { sendRequest, acceptRequest, getConnections, getPendingRequests, isConnected }
}