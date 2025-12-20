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
 * Only relationships that are mutual (rows exist in both directions) are shown.
 * Blocked users are filtered out.
 */
export async function getFriendsForUser(userId) {
  if (!userId) return [];

  const { data: friendships, error: friendErr } = await db
    .from('friend_list')
    .select('id_1, id_2')
    .or(`id_1.eq.${userId},id_2.eq.${userId}`);
  if (friendErr || !friendships?.length) return [];

  const { data: blocks, error: blockErr } = await db
    .from('block_list')
    .select('user_id_1, user_id_2')
    .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);
  const blocked = new Set();
  const blockedBy = new Set();
  if (!blockErr && Array.isArray(blocks)) {
    blocks.forEach((row) => {
      if (row.user_id_1 === userId) blocked.add(row.user_id_2);
      if (row.user_id_2 === userId) blockedBy.add(row.user_id_1);
    });
  }

  const relationMap = new Map();
  friendships.forEach((row) => {
    if (row.id_1 === userId) {
      const existing = relationMap.get(row.id_2) || { incoming: false, outgoing: false };
      existing.outgoing = true;
      relationMap.set(row.id_2, existing);
    } else {
      const existing = relationMap.get(row.id_1) || { incoming: false, outgoing: false };
      existing.incoming = true;
      relationMap.set(row.id_1, existing);
    }
  });

  const mutualIds = Array.from(relationMap.entries())
    .filter(([fid, rel]) => rel.incoming && rel.outgoing && !blocked.has(fid) && !blockedBy.has(fid))
    .map(([fid]) => fid);

  if (!mutualIds.length) return [];

  const seen = new Set();
  const friendEntries = await Promise.all(
    mutualIds.map(async (fid) => {
      if (!fid || seen.has(fid)) return null;
      seen.add(fid);
      const info = await getUserInfo(fid);
      return { friendId: fid, info };
    })
  );
  return friendEntries.filter(Boolean);
}
