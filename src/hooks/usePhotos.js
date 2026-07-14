import { supabase } from '../lib/supabase'

export function usePhotos() {

  async function uploadPhoto(eventId, uri, isRetroactive = false) {
    const { data: { user } } = await supabase.auth.getUser()
    const fileName = `${eventId}/${user.id}/${Date.now()}.jpg`

    const response = await fetch(uri)
    const blob = await response.blob()

    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, blob, { contentType: 'image/jpeg' })

    if (uploadError) return { error: uploadError }

    const { data, error } = await supabase
      .from('photos')
      .insert({
        event_id: eventId,
        uploader_id: user.id,
        storage_path: fileName,
        is_retroactive: isRetroactive,
      })
      .select()
      .single()

    return { data, error }
  }

  async function getEventPhotos(eventId) {
    const { data, error } = await supabase
      .from('photos')
      .select('*, profiles(username, avatar_url)')
      .eq('event_id', eventId)
      .order('heart_count', { ascending: false })
    return { data, error }
  }

  async function heartPhoto(photoId) {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('photo_hearts')
      .insert({ photo_id: photoId, user_id: user.id })
    return { error }
  }

  async function unheartPhoto(photoId) {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('photo_hearts')
      .delete()
      .eq('photo_id', photoId)
      .eq('user_id', user.id)
    return { error }
  }

  async function blockPhoto(photoId, tier) {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('photo_blocks')
      .insert({ photo_id: photoId, user_id: user.id, tier })
    return { error }
  }

  return { uploadPhoto, getEventPhotos, heartPhoto, unheartPhoto, blockPhoto }
}