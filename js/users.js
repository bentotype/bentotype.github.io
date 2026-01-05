import { db } from './supabaseClient.js';
import { appState } from './state.js';

const PROFILE_PICTURE_BUCKET = 'profile_pictures';
const PROFILE_PICTURE_SIGNED_URL_TTL = 60 * 60; // seconds

/**
 * Fetches + caches profile metadata for the supplied user id.
 */
export async function getUserInfo(userId) {
  if (appState.userCache.has(userId)) return appState.userCache.get(userId);
  const { data, error } = await db
    .from('user_info')
    .select('first_name,last_name,email,username,profile_picture')
    .eq('user_id', userId)
    .single();

  if (error) {
    return { first_name: 'Unknown', last_name: 'User', email: '', username: '', profile_picture: '', profile_picture_path: '' };
  }

  let signedUrl = '';
  const profilePath = data.profile_picture;
  if (profilePath) {
    const { data: signed, error: signedErr } = await db.storage
      .from(PROFILE_PICTURE_BUCKET)
      .createSignedUrl(profilePath, PROFILE_PICTURE_SIGNED_URL_TTL);
    if (!signedErr && signed?.signedUrl) {
      signedUrl = signed.signedUrl;
    }
  }

  const hydrated = {
    ...data,
    profile_picture_path: profilePath || '',
    profile_picture: signedUrl || ''
  };
  appState.userCache.set(userId, hydrated);
  return hydrated;
}

/**
 * Returns all friends for the current user with cached profile info.
 */
export async function getFriendsForUser(userId) {
  if (!userId) return [];
  const { data, error } = await db
    .from('friend_list')
    .select('id_1, id_2')
    .or(`id_1.eq.${userId},id_2.eq.${userId}`);

  if (error || !data?.length) return [];
  const seen = new Set();
  const friendEntries = await Promise.all(
    data.map(async (row) => {
      const friendId = row.id_1 === userId ? row.id_2 : row.id_1;
      if (!friendId || seen.has(friendId)) return null;
      seen.add(friendId);
      const info = await getUserInfo(friendId);
      return { friendId, info };
    })
  );
  return friendEntries.filter(Boolean);
}
