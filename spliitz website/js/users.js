import { db } from './supabaseClient.js';
import { appState } from './state.js';

const PROFILE_PICTURE_BUCKET = 'profile_pictures';
const PROFILE_PICTURE_SIGNED_URL_TTL = 60 * 60; // seconds


export const UserTier = {
  FREE: 1,
  PAID: 2,
  TESTING: 3,
  ADMIN: 4
};

export function canUseCamera(tier) {
  return tier !== UserTier.FREE;
}

export function canJoinGroups(tier) {
  return tier !== UserTier.FREE;
}

/**
 * Fetches + caches profile metadata for the supplied user id.
 */
export async function getUserInfo(userId) {
  if (appState.userCache.has(userId)) return appState.userCache.get(userId);
  const { data, error } = await db
    .from('user_info')
    .select('first_name,last_name,email,username,profile_picture,tier')
    .eq('user_id', userId)
    .single();

  if (error) {
    return { first_name: 'Unknown', last_name: 'User', email: '', username: '', profile_picture: '', profile_picture_path: '', tier: 1 };
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
    .select('id_1, id_2')
    .or(`id_1.eq.${userId},id_2.eq.${userId}`);
  const blocked = new Set();
  if (!blockErr && Array.isArray(blocks)) {
    blocks.forEach((row) => {
      const otherId = row.id_1 === userId ? row.id_2 : row.id_1;
      if (otherId) blocked.add(otherId);
    });
  }

  const friendIds = friendships
    .map((row) => (row.id_1 === userId ? row.id_2 : row.id_1))
    .filter((fid) => fid && !blocked.has(fid));

  if (!friendIds.length) return [];

  const seen = new Set();
  const friendEntries = await Promise.all(
    friendIds.map(async (fid) => {
      if (!fid || seen.has(fid)) return null;
      seen.add(fid);
      const info = await getUserInfo(fid);
      return { friendId: fid, info };
    })
  );
  return friendEntries.filter(Boolean);
}
