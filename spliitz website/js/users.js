import { db } from './supabaseClient.js';
import { appState } from './state.js';

const PROFILE_PICTURE_BUCKET = 'profile_pictures';
const PROFILE_PICTURE_SIGNED_URL_TTL = 60 * 60; // seconds

const pendingSignupKey = (userId) => `spliitz_pending_signup_${userId}`;
const normalizeUsername = (value) =>
  String(value || '')
    .trim()
    .replace(/[^a-z0-9._-]/gi, '')
    .toLowerCase();

export function storePendingSignupProfile(userId, profile) {
  if (!userId) return;
  try {
    localStorage.setItem(pendingSignupKey(userId), JSON.stringify(profile));
  } catch (err) {
    console.warn('Unable to store pending signup profile', err);
  }
}

export function getPendingSignupProfile(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(pendingSignupKey(userId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Unable to read pending signup profile', err);
    return null;
  }
}

export function clearPendingSignupProfile(userId) {
  if (!userId) return;
  try {
    localStorage.removeItem(pendingSignupKey(userId));
  } catch (err) {
    console.warn('Unable to clear pending signup profile', err);
  }
}

async function isUsernameAvailable(username) {
  if (!username) return false;
  const { data, error } = await db
    .from('user_info')
    .select('user_id')
    .eq('username', username)
    .maybeSingle();
  if (error) throw error;
  return !data;
}

async function findAvailableUsername(base) {
  const safeBase = normalizeUsername(base) || 'user';
  let candidate = safeBase;
  let suffix = 0;
  while (suffix < 5) {
    const available = await isUsernameAvailable(candidate);
    if (available) return candidate;
    suffix += 1;
    candidate = `${safeBase}${suffix}`;
  }
  return '';
}

export async function ensureUserInfoForSession(user) {
  if (!user?.id) return;
  try {
    const { data: existing, error } = await db
      .from('user_info')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (existing) {
      clearPendingSignupProfile(user.id);
      return;
    }

    const metadata = user.user_metadata || {};
    const pending = getPendingSignupProfile(user.id);
    const email = pending?.email || user.email || metadata.email || '';
    if (!email) {
      console.warn('Unable to create user_info without email for user', user.id);
      return;
    }

    let username = normalizeUsername(pending?.username || metadata.preferred_username || metadata.username || '');
    if (username) {
      const available = await isUsernameAvailable(username);
      if (!available) username = '';
    }
    if (!username) {
      const base =
        normalizeUsername(pending?.username) ||
        normalizeUsername(metadata.preferred_username) ||
        normalizeUsername(metadata.username) ||
        normalizeUsername(email.split('@')[0]) ||
        normalizeUsername(metadata.name) ||
        normalizeUsername(metadata.full_name) ||
        `user${user.id.slice(0, 6)}`;
      username = (await findAvailableUsername(base)) || `user${user.id.slice(0, 6)}`;
    }

    const payload = {
      user_id: user.id,
      email,
      first_name: pending?.first_name || metadata.first_name || metadata.given_name || '',
      last_name: pending?.last_name || metadata.last_name || metadata.family_name || '',
      username,
      phone_number: pending?.phone_number || null
    };
    const { error: insertErr } = await db.from('user_info').insert(payload);
    if (insertErr) {
      console.warn('Unable to create user_info', insertErr);
      return;
    }
    clearPendingSignupProfile(user.id);
  } catch (err) {
    console.error('ensureUserInfoForSession failed', err);
  }
}


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
