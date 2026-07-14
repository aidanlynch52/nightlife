import { supabase } from '../lib/supabase'

export function useEvent() {

  async function createEvent(name, autoCloseAt, coverPhotoUrl) {
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user?.id) {
      return {
        data: null,
        error: userError ?? { message: 'You need to be signed in to create a night.' },
      }
    }

    const { data, error } = await supabase
      .from('events')
      .insert({ name, host_id: user.id, auto_close_at: autoCloseAt, cover_photo_url: coverPhotoUrl })
      .select()
      .single()
    return { data, error }
  }

  async function joinEvent(qrCodeToken) {
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('qr_code_token', qrCodeToken)
      .eq('status', 'active')
      .single()

    if (eventError || !event) return { error: 'Event not found or already closed' }

    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('event_attendees')
      .insert({ event_id: event.id, user_id: user.id })

    return { data: event, error }
  }

  async function closeEvent(eventId) {
    const { error } = await supabase
      .from('events')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', eventId)
    return { error }
  }

  async function getMyEvents() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('event_attendees')
      .select('event_id, events(*)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
    return { data, error }
  }

  async function getEventAttendees(eventId) {
    const { data, error } = await supabase
      .from('event_attendees')
      .select('user_id, profiles(*)')
      .eq('event_id', eventId)
    return { data, error }
  }

  return { createEvent, joinEvent, closeEvent, getMyEvents, getEventAttendees }
}