import { db } from './supabaseClient.js';
import { appState, modalContainer, resetPendingReceiptState } from './state.js';
import { setLoading, showAlert, showConfirm } from './ui.js';
import {
  fetchFriends,
  fetchPendingFriendRequests,
  fetchUserGroups,
  fetchGroupInvites,
  fetchPendingProposals,
  fetchGroupPendingExpenses,
  fetchGroupExpenseActivity,
  fetchGroupMembers
} from './fetchers.js';
import { render } from './views.js';
import { navigate } from './router.js';
import { getUserInfo, storePendingSignupProfile } from './users.js';
import { formatCurrency } from './format.js';
import { scanReceiptImage } from './receiptScan.js';

const PROFILE_PICTURE_BUCKET = 'profile_pictures';
const MAX_PROFILE_UPLOAD_BYTES = 5 * 1024 * 1024;
const RECEIPT_BUCKET = 'expense_receipts';
const MAX_RECEIPT_UPLOAD_BYTES = 10 * 1024 * 1024;
const PASSWORD_POLICY_MESSAGE =
  'Error: Password should contain atleast one uppercase letter, one lowercase letter, and one symbol';

const orderUserIds = (idA, idB) => {
  if (!idA || !idB) return [idA, idB];
  return String(idA) < String(idB) ? [idA, idB] : [idB, idA];
};

const mapPasswordPolicyMessage = (message) => {
  if (!message) return message;
  if (/password should contain/i.test(message)) return PASSWORD_POLICY_MESSAGE;
  return message;
};

async function getBlockSetsForCurrentUser() {
  if (!appState.currentUser?.id) {
    return { blocked: new Set(), blockedBy: new Set() };
  }
  const userId = appState.currentUser.id;
  try {
    const { data, error } = await db
      .from('block_list')
      .select('id_1, id_2')
      .or(`id_1.eq.${userId},id_2.eq.${userId}`);
    if (error) throw error;

    const blocked = new Set();
    const blockedBy = new Set();
    (data || []).forEach((row) => {
      const otherId = row.id_1 === userId ? row.id_2 : row.id_1;
      if (!otherId) return;
      blocked.add(otherId);
      blockedBy.add(otherId);
    });
    return { blocked, blockedBy };
  } catch (err) {
    console.error('block_list lookup failed', err);
    return { blocked: new Set(), blockedBy: new Set() };
  }
}

/**
 * ===============================================================
 * AUTH HANDLERS
 * ===============================================================
 */

export async function handleLogout() {
  setLoading(true);
  let signOutOk = false;
  try {
    const { error } = await db.auth.signOut();
    if (error && !/auth session missing/i.test(error.message || '')) throw error;
    signOutOk = true;
  } catch (err) {
    console.warn('signOut failed, attempting local sign out', err);
    try {
      const { error: localErr } = await db.auth.signOut({ scope: 'local' });
      if (localErr && !/auth session missing/i.test(localErr.message || '')) throw localErr;
      signOutOk = true;
    } catch (localErr) {
      showAlert('Sign out failed', localErr?.message || 'Unable to sign out right now.');
    }
  } finally {
    setLoading(false);
  }

  if (!signOutOk) return;
  appState.currentUser = null;
  appState.currentView = 'auth';
  appState.currentGroup = null;
  appState.currentGroupMembers = [];
  appState.currentGroupMemberIds = [];
  appState.userCache.clear();
  appState.pendingProfilePicturePath = '';
  appState.pendingProfilePictureUrl = '';
  navigate('/signin', { replace: true });
}

export async function handleSignUp(form) {
  setLoading(true);
  const fd = new FormData(form);
  const email = (fd.get('email') || '').trim();
  const password = fd.get('password');
  const confirmPassword = fd.get('confirm_password');
  const first_name = fd.get('first_name');
  const last_name = fd.get('last_name');
  let username = (fd.get('username') || '').trim();
  const phone_number = (fd.get('phone_number') || '').trim() || null;

  if (!email) {
    setLoading(false);
    showAlert('Error', 'Email is required to create an account.');
    return;
  }

  if (password !== confirmPassword) {
    setLoading(false);
    showAlert('Error', 'Passwords do not match');
    return;
  }

  const { data: existingEmail, error: emailErr } = await db
    .from('user_info')
    .select('user_id')
    .eq('email', email)
    .maybeSingle();
  if (emailErr) {
    setLoading(false);
    showAlert('Error', emailErr.message);
    return;
  }
  if (existingEmail) {
    setLoading(false);
    showAlert('Error', 'Email has been taken');
    return;
  }

  const { data: existingUsername, error: usernameErr } = await db
    .from('user_info')
    .select('user_id')
    .eq('username', username)
    .maybeSingle();
  if (usernameErr) {
    setLoading(false);
    showAlert('Error', usernameErr.message);
    return;
  }
  if (existingUsername) {
    setLoading(false);
    showAlert('Error', 'Username has been taken');
    return;
  }

  if (!username) {
    const base = email.split('@')[0]?.replace(/[^a-z0-9._-]/gi, '').toLowerCase() || 'user';
    let candidate = base;
    let suffix = 0;
    while (suffix < 5) {
      const { data: candidateRow, error: candidateErr } = await db
        .from('user_info')
        .select('user_id')
        .eq('username', candidate)
        .maybeSingle();
      if (candidateErr) {
        setLoading(false);
        showAlert('Error', candidateErr.message);
        return;
      }
      if (!candidateRow) {
        username = candidate;
        break;
      }
      suffix += 1;
      candidate = `${base}${suffix}`;
    }
    if (!username) {
      setLoading(false);
      showAlert('Error', 'Please choose a different username.');
      return;
    }
  }

  const { data: authData, error: authErr } = await db.auth.signUp({
    email,
    password,
    options: {
      data: { first_name, last_name, username, phone_number }
    }
  });
  if (authErr) {
    setLoading(false);
    showAlert('Error', mapPasswordPolicyMessage(authErr.message));
    return;
  }
  if (authData?.user?.id) {
    storePendingSignupProfile(authData.user.id, { email, first_name, last_name, username, phone_number });
  }
  setLoading(false);
  if (!authData?.session) {
    localStorage.setItem('spliitz_pending_email', email);
    window.location.href = `/verify.html?email=${encodeURIComponent(email)}`;
  }
  // If a session exists, auth state listener will handle navigation and user_info creation.
}

export async function handleVerifyOtp(form) {
  const fd = new FormData(form);
  const email = (fd.get('email') || '').trim();
  const token = (fd.get('token') || '').trim();
  const submitBtn = form.querySelector('button[type="submit"]');

  if (!email || !token) {
    alert('Email and Code are required.');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';
  }

  try {
    const { data, error } = await db.auth.verifyOtp({
      email,
      token,
      type: 'signup'
    });

    if (error) throw error;

    if (data?.session?.user) {
      // Critical: Ensure profile exists
      await import('./users.js').then(m => m.ensureUserInfoForSession(data.session.user));
      alert('Verification successful! You can now sign in.');
      window.location.href = '/signin';
    } else {
      // Should not happen on success usually
      throw new Error('Verification failed. Please try again.');
    }

  } catch (err) {
    alert(err.message || 'Verification failed');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Verify Account';
    }
  }
}

export function startResendTimer() {
  let timeLeft = 60;
  const timerEl = document.getElementById('resend-timer');
  const btnEl = document.getElementById('resend-btn');
  if (!timerEl || !btnEl) return;

  timerEl.classList.remove('hidden');
  btnEl.classList.add('hidden');
  timerEl.textContent = `Resend in ${timeLeft}s`;

  const interval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(interval);
      timerEl.classList.add('hidden');
      btnEl.classList.remove('hidden');
    } else {
      timerEl.textContent = `Resend in ${timeLeft}s`;
    }
  }, 1000);
}

export async function handleResendOtp() {
  const emailInput = document.getElementById('verify-email-input');
  const email = (emailInput?.value || '').trim();
  const msgEl = document.getElementById('resend-msg');

  if (!email) {
    alert('Email not found. Please restart sign up.');
    return;
  }

  try {
    const { error } = await db.auth.resend({
      type: 'signup',
      email: email
    });

    if (error) throw error;

    if (msgEl) {
      msgEl.textContent = 'Code resent successfully!';
      msgEl.classList.remove('hidden');
      setTimeout(() => msgEl.classList.add('hidden'), 5000);
    }
    startResendTimer();

  } catch (err) {
    alert(err.message || 'Failed to resend code. Please try again later.');
  }
}

export async function handleAppleLogin() {
  setLoading(true);
  try {
    const { error } = await db.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/`
      }
    });
    if (error) throw error;
  } catch (err) {
    showAlert('Error', err?.message || 'Unable to start Apple sign-in.');
  } finally {
    setLoading(false);
  }
}

export async function handleGoogleLogin() {
  setLoading(true);
  try {
    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`
      }
    });
    if (error) throw error;
  } catch (err) {
    showAlert('Error', err?.message || 'Unable to start Google sign-in.');
  } finally {
    setLoading(false);
  }
}

export async function handleLogin(form) {
  setLoading(true);
  const fd = new FormData(form);
  const email = fd.get('email');
  const password = fd.get('password');
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  setLoading(false);
  if (error) {
    showAlert('Login Error', error.message);
    return;
  }
  if (data?.user) {
    // Auth state listener in main.js will handle navigation
  }
}

export async function handleChangePassword(form) {
  if (!appState.currentUser?.email) {
    showAlert('Error', 'You must be signed in.');
    return;
  }

  const fd = new FormData(form);
  const oldPassword = (fd.get('old_password') || '').trim();
  const newPassword = (fd.get('new_password') || '').trim();
  const confirmPassword = (fd.get('confirm_password') || '').trim();

  if (!oldPassword || !newPassword || !confirmPassword) {
    showAlert('Error', 'Please fill out all password fields.');
    return;
  }
  if (newPassword.length < 6) {
    showAlert('Error', 'New password must be at least 6 characters.');
    return;
  }
  if (newPassword !== confirmPassword) {
    showAlert('Error', 'New passwords do not match.');
    return;
  }
  if (newPassword === oldPassword) {
    showAlert('Error', 'New password must be different from old password.');
    return;
  }

  setLoading(true);
  try {
    const { error: verifyErr } = await db.auth.signInWithPassword({
      email: appState.currentUser.email,
      password: oldPassword
    });
    if (verifyErr) {
      throw new Error('Old password is incorrect.');
    }

    const { error: updateErr } = await db.auth.updateUser({ password: newPassword });
    if (updateErr) {
      throw new Error(updateErr.message || 'Unable to change password.');
    }

    modalContainer.innerHTML = '';
    showAlert('Success', 'Password changed successfully.');
  } catch (err) {
    const message = mapPasswordPolicyMessage(err?.message) || 'Unable to change password.';
    showAlert('Error', message);
  } finally {
    setLoading(false);
  }
}

/**
 * ===============================================================
 * PROFILE & SOCIAL
 * ===============================================================
 */
export async function handleUpdateProfile(form) {
  setLoading(true);
  const fd = new FormData(form);
  const first_name = fd.get('first_name');
  const last_name = fd.get('last_name');
  const username = fd.get('username');
  const email = fd.get('email');
  const pendingProfilePicturePath = appState.pendingProfilePicturePath || null;

  const currentInfo = await getUserInfo(appState.currentUser.id);
  const previousProfilePath = currentInfo?.profile_picture_path || '';

  const { error } = await db.auth.updateUser({ email });
  if (error) {
    setLoading(false);
    showAlert('Error', error.message);
    return;
  }
  const payload = { first_name, last_name, username, email };
  if (pendingProfilePicturePath) {
    payload.profile_picture = pendingProfilePicturePath;
  }

  const { error: infoErr } = await db.from('user_info').update(payload).eq('user_id', appState.currentUser.id);
  setLoading(false);
  if (infoErr) {
    showAlert('Error', infoErr.message);
    return;
  }

  if (pendingProfilePicturePath && previousProfilePath && previousProfilePath !== pendingProfilePicturePath) {
    try {
      await db.storage.from(PROFILE_PICTURE_BUCKET).remove([previousProfilePath]);
    } catch (err) {
      console.error('Failed to remove previous profile picture', err);
    }
  }

  appState.pendingProfilePicturePath = '';
  appState.pendingProfilePictureUrl = '';
  appState.userCache.delete(appState.currentUser.id);
  showAlert('Success', 'Profile updated');
  render();
}

export async function handleProfilePictureFileChange(inputEl) {
  if (!appState.currentUser) {
    showAlert('Error', 'You must be signed in.');
    return;
  }
  const file = inputEl?.files?.[0];
  if (!file) return;
  if (file.size > MAX_PROFILE_UPLOAD_BYTES) {
    showAlert('Error', 'Image must be 5MB or smaller.');
    inputEl.value = '';
    return;
  }
  const userId = appState.currentUser.id;
  const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const filePath = `${userId}/${Date.now()}.${fileExt}`;
  setLoading(true);
  try {
    if (appState.pendingProfilePicturePath) {
      await db.storage.from(PROFILE_PICTURE_BUCKET).remove([appState.pendingProfilePicturePath]);
    }
    const { error: uploadErr } = await db.storage
      .from(PROFILE_PICTURE_BUCKET)
      .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: file.type || 'image/jpeg' });
    if (uploadErr) throw uploadErr;

    const { data: signed, error: signedErr } = await db.storage
      .from(PROFILE_PICTURE_BUCKET)
      .createSignedUrl(filePath, 60 * 60);
    if (signedErr) throw signedErr;

    appState.pendingProfilePicturePath = filePath;
    appState.pendingProfilePictureUrl = signed?.signedUrl || '';
    showAlert('Success', 'Photo uploaded. Click Save Changes to apply.');
    render();
  } catch (err) {
    showAlert('Error', err?.message || 'Unable to upload profile picture.');
  } finally {
    setLoading(false);
    inputEl.value = '';
  }
}

export async function handleAddFriend(targetUserId) {
  if (!appState.currentUser) {
    showAlert('Error', 'You must be signed in.');
    return;
  }
  setLoading(true);
  try {
    const userId = appState.currentUser.id;

    const [blockId1, blockId2] = orderUserIds(userId, targetUserId);
    const { data: blockRow, error: blockErr } = await db
      .from('block_list')
      .select('id_1, id_2')
      .eq('id_1', blockId1)
      .eq('id_2', blockId2)
      .maybeSingle();
    if (blockErr) throw blockErr;

    if (blockRow) {
      setLoading(false);
      const confirmUnblock = await showConfirm(
        'User is blocked',
        'A block exists between you and this user. Remove the block and send a friend request?',
        {
          confirmText: 'Remove Block & Send',
          cancelText: 'Cancel'
        }
      );
      if (!confirmUnblock) return;
      setLoading(true);
      const { error: unblockErr } = await db
        .from('block_list')
        .delete({ returning: 'minimal' })
        .eq('id_1', blockId1)
        .eq('id_2', blockId2);
      if (unblockErr) {
        showAlert('Error', unblockErr.message || 'Unable to remove block.');
        return;
      }
    }

    const payload = { id_1: targetUserId, id_2: appState.currentUser.id };
    const { error } = await db.from('friend_request').insert(payload);
    if (error) {
      if (/duplicate key value violates unique constraint "friend_request_id_2_key"/i.test(error.message || '')) {
        throw new Error('Friend request already sent');
      }
      throw error;
    }
    showAlert('Success', 'Friend request sent');
  } catch (err) {
    showAlert('Error', err?.message || 'Unable to send friend request.');
  } finally {
    setLoading(false);
  }
}

export async function handleFriendRequestResponse(requesterId, requesteeId, response) {
  if (!requesterId || !requesteeId || !response) return;
  setLoading(true);
  try {
    const [blockId1, blockId2] = orderUserIds(requesterId, requesteeId);
    const { data: blocks, error: blockErr } = await db
      .from('block_list')
      .select('id_1, id_2')
      .eq('id_1', blockId1)
      .eq('id_2', blockId2);
    if (blockErr) throw blockErr;
    if (blocks?.length) {
      await db.from('friend_request').delete().eq('id_1', requesteeId).eq('id_2', requesterId);
      showAlert('Error', 'Friend request cannot be processed because a block is in place.');
      fetchPendingFriendRequests();
      return;
    }

    if (response === 'accept') {
      const [pairId1, pairId2] = orderUserIds(requesterId, requesteeId);
      const { data: existing, error: existingErr } = await db
        .from('friend_list')
        .select('id_1, id_2')
        .eq('id_1', pairId1)
        .eq('id_2', pairId2);
      if (existingErr) throw existingErr;

      if (!existing?.length) {
        const { error: friendErr } = await db
          .from('friend_list')
          .insert({ id_1: pairId1, id_2: pairId2 }, { returning: 'minimal' });
        if (friendErr) throw friendErr;
      }
    }
    const { error: deleteErr } = await db
      .from('friend_request')
      .delete()
      .eq('id_1', requesteeId)
      .eq('id_2', requesterId);
    if (deleteErr) throw deleteErr;
    showAlert('Success', response === 'accept' ? 'Friend request accepted.' : 'Friend request rejected.');
    fetchPendingFriendRequests();
    fetchFriends();
  } catch (err) {
    showAlert('Error', err.message || 'Unable to update friend request.');
  } finally {
    setLoading(false);
  }
}

export async function handleRemoveFriend(friendId) {
  if (!appState.currentUser?.id || !friendId) {
    showAlert('Error', 'Unable to remove friend.');
    return;
  }
  setLoading(true);
  try {
    const userId = appState.currentUser.id;
    const [pairId1, pairId2] = orderUserIds(userId, friendId);
    const { error: primaryErr } = await db.from('friend_list').delete({ returning: 'minimal' }).eq('id_1', pairId1).eq('id_2', pairId2);
    if (primaryErr) throw primaryErr;

    showAlert('Success', 'Friend removed');
    fetchFriends();
  } catch (err) {
    console.error('remove friend error', err);
    showAlert('Error', err?.message || 'Unable to remove friend.');
  } finally {
    setLoading(false);
  }
}

export async function handleBlockFriend(friendId) {
  if (!appState.currentUser?.id || !friendId) {
    showAlert('Error', 'Unable to block friend.');
    return;
  }
  setLoading(true);
  try {
    const userId = appState.currentUser.id;
    const [pairId1, pairId2] = orderUserIds(userId, friendId);
    const { error: primaryErr } = await db.from('friend_list').delete({ returning: 'minimal' }).eq('id_1', pairId1).eq('id_2', pairId2);
    if (primaryErr) throw primaryErr;

    const { error: requestErr } = await db
      .from('friend_request')
      .delete()
      .or(`and(id_1.eq.${userId},id_2.eq.${friendId}),and(id_1.eq.${friendId},id_2.eq.${userId})`);
    if (requestErr) {
      console.error('block friend - remove pending request failed', requestErr);
      throw requestErr;
    }

    const { error: blockErr } = await db
      .from('block_list')
      .insert({ id_1: pairId1, id_2: pairId2 }, { upsert: true, onConflict: 'id_1,id_2', returning: 'minimal' });
    if (blockErr) {
      console.error('block friend - insert block failed', blockErr);
      throw blockErr;
    }

    showAlert('Success', 'Friend blocked');
    fetchFriends();
    fetchPendingFriendRequests();
  } catch (err) {
    console.error('block friend error', err);
    showAlert('Error', err?.message || 'Unable to block user.');
  } finally {
    setLoading(false);
  }
}

/**
 * ===============================================================
 * GROUPS
 * ===============================================================
 */
export async function handleCreateGroup(form) {
  setLoading(true);
  const fd = new FormData(form);
  const title = (fd.get('group_title') || '').trim() || 'Untitled group';
  const descriptionField = (fd.get('description') || '').trim();
  const description = descriptionField === '' ? null : descriptionField;
  const group_id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `grp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  const { error: infoErr } = await db
    .from('group_info')
    .insert({
      group_id,
      group_title: title,
      description,
      owner_id: appState.currentUser.id
    });

  if (infoErr) {
    setLoading(false);
    showAlert('Error', 'Could not save group details: ' + infoErr.message);
    return;
  }

  const { error } = await db.from('split_groups').insert({
    user_id: appState.currentUser.id,
    group_id,
    invite: false
  });

  if (error) {
    // Attempt to clean up the orphaned group_info record if membership fails.
    try {
      await db.from('group_info').delete().eq('group_id', group_id);
    } catch (cleanupErr) {
      console.error('group_info cleanup failed', cleanupErr);
    }
    console.error('groups insert', error);
    setLoading(false);
    showAlert('Error', 'Unable to add you to the new group: ' + error.message);
    return;
  }

  setLoading(false);
  modalContainer.innerHTML = '';
  fetchUserGroups();
  showAlert('Success', 'Group has been created.');
}

export async function handleUpdateGroup(form) {
  const groupId = form.dataset.groupId;
  if (!groupId) {
    showAlert('Error', 'Unable to find this group.');
    return;
  }
  const fd = new FormData(form);
  const title = (fd.get('group_title') || '').trim() || 'Untitled group';
  const descriptionField = (fd.get('description') || '').trim();
  const description = descriptionField === '' ? null : descriptionField;

  setLoading(true);
  const { error } = await db
    .from('group_info')
    .update({
      group_title: title,
      description
    })
    .eq('group_id', groupId);
  setLoading(false);

  if (error) {
    showAlert('Error', error.message);
    return;
  }

  modalContainer.innerHTML = '';
  if (appState.currentGroup && appState.currentGroup.id === groupId) {
    appState.currentGroup = {
      ...appState.currentGroup,
      group_title: title,
      description: description || ''
    };
    render();
  }
  fetchUserGroups();
  showAlert('Success', 'Group settings updated.');
}

export async function handleDeleteGroup(groupId) {
  if (!groupId || !appState.currentUser?.id) {
    showAlert('Error', 'Group not found.');
    return;
  }

  setLoading(true);
  try {
    const { data: info, error: infoErr } = await db.from('group_info').select('owner_id').eq('group_id', groupId).single();
    if (infoErr) throw infoErr;
    if (info?.owner_id && info.owner_id !== appState.currentUser.id) {
      showAlert('Error', 'Only the owner can delete this group.');
      return;
    }

    const { data: expenseRows, error: expenseFetchErr } = await db.from('expense_info').select('expense_id').eq('group_id', groupId);
    if (expenseFetchErr) throw expenseFetchErr;
    const expenseIds = (expenseRows || []).map((row) => row.expense_id).filter(Boolean);
    if (expenseIds.length) {
      const { error: expenseDeleteErr } = await db.from('expense').delete().in('expense_id', expenseIds);
      if (expenseDeleteErr) throw expenseDeleteErr;
    }

    const { error: expenseInfoDeleteErr } = await db.from('expense_info').delete().eq('group_id', groupId);
    if (expenseInfoDeleteErr) throw expenseInfoDeleteErr;

    const { error: groupsDeleteErr } = await db.from('split_groups').delete().eq('group_id', groupId);
    if (groupsDeleteErr) throw groupsDeleteErr;

    const { error: groupInfoDeleteErr } = await db.from('group_info').delete().eq('group_id', groupId);
    if (groupInfoDeleteErr) throw groupInfoDeleteErr;

    if (appState.currentGroup?.id === groupId) {
      appState.currentGroup = null;
      appState.currentView = 'groups';
      render();
    }
    await fetchUserGroups();
    modalContainer.innerHTML = '';
    showAlert('Success', 'Group deleted.');
  } catch (err) {
    showAlert('Error', err?.message || 'Unable to delete group.');
  } finally {
    setLoading(false);
  }
}

export async function handleInviteFriendToGroup(friendId) {
  if (!friendId || !appState.currentGroup?.id) {
    showAlert('Error', 'Select a group before inviting friends.');
    return false;
  }
  setLoading(true);
  try {
    const { data: existing, error: checkErr } = await db
      .from('split_groups')
      .select('invite')
      .eq('group_id', appState.currentGroup.id)
      .eq('user_id', friendId)
      .maybeSingle();
    if (checkErr) throw checkErr;
    if (existing) {
      showAlert('Info', existing.invite ? 'Invite already sent to that friend.' : 'That friend is already part of the group.');
      return true;
    }

    const payload = { group_id: appState.currentGroup.id, user_id: friendId, invite: true };
    const { error } = await db.from('split_groups').insert(payload);
    if (error) throw error;
    const existingIds = new Set(appState.currentGroupMemberIds || []);
    existingIds.add(friendId);
    appState.currentGroupMemberIds = Array.from(existingIds);
    showAlert('Success', 'Invite sent to your friend.');
    return true;
  } catch (err) {
    showAlert('Error', err.message || 'Unable to invite friend.');
    return false;
  } finally {
    setLoading(false);
  }
}

export async function handleRemoveGroupMember(memberId, groupIdOverride = null) {
  const groupId = groupIdOverride || appState.currentGroup?.id;
  if (!memberId || !groupId || !appState.currentUser?.id) {
    showAlert('Error', 'Unable to remove that member.');
    return;
  }

  setLoading(true);
  try {
    const { data: info, error: infoErr } = await db
      .from('group_info')
      .select('owner_id')
      .eq('group_id', groupId)
      .single();
    if (infoErr) throw infoErr;
    if (!info?.owner_id || info.owner_id !== appState.currentUser.id) {
      showAlert('Error', 'Only the group owner can remove members.');
      return;
    }
    if (memberId === info.owner_id) {
      showAlert('Error', 'The group owner cannot be removed.');
      return;
    }

    const { error: deleteErr } = await db
      .from('split_groups')
      .delete({ returning: 'minimal' })
      .eq('group_id', groupId)
      .eq('user_id', memberId);
    if (deleteErr) throw deleteErr;

    const { data: stillExists, error: checkErr } = await db
      .from('split_groups')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('user_id', memberId)
      .maybeSingle();
    if (checkErr) throw checkErr;
    if (stillExists) {
      throw new Error('Member could not be removed due to a database rule.');
    }

    appState.currentGroupMemberIds = (appState.currentGroupMemberIds || []).filter((id) => id !== memberId);
    appState.currentGroupMembers = (appState.currentGroupMembers || []).filter((m) => m.user_id !== memberId);
    await fetchGroupMembers(groupId);
    modalContainer.innerHTML = '';
    showAlert('Success', 'Member removed from the group.');
  } catch (err) {
    showAlert('Error', err?.message || 'Unable to remove member.');
  } finally {
    setLoading(false);
  }
}

export async function handleGroupInviteResponse(groupId, response) {
  if (!groupId || !appState.currentUser?.id || !response) return;
  setLoading(true);
  try {
    const userId = appState.currentUser.id;
    const { data: membership, error: membershipErr } = await db
      .from('split_groups')
      .select('invite')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();
    if (membershipErr) throw membershipErr;
    if (!membership) {
      showAlert('Info', 'Invite no longer exists.');
      await fetchGroupInvites();
      return;
    }

    let refreshGroups = false;
    if (response === 'accept') {
      if (membership.invite === false) {
        showAlert('Info', 'You are already part of this group.');
      } else {
        const { error: updateErr } = await db
          .from('split_groups')
          .update({ invite: false })
          .eq('group_id', groupId)
          .eq('user_id', userId);
        if (updateErr) throw updateErr;
        showAlert('Success', 'Invite accepted. You have joined the group.');
      }
      refreshGroups = true;
    } else {
      const { error: deleteErr } = await db
        .from('split_groups')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);
      if (deleteErr) throw deleteErr;
      showAlert('Success', 'Invite declined.');
    }

    if (refreshGroups || appState.currentView === 'groups') {
      await fetchUserGroups();
    }
    await fetchGroupInvites();
  } catch (err) {
    showAlert('Error', err?.message || 'Unable to process invite.');
  } finally {
    setLoading(false);
  }
}

/**
 * ===============================================================
 * DISCOVERY / MEMBERS
 * ===============================================================
 */
export async function handleSearchUser(form) {
  if (!appState.currentUser?.id) {
    showAlert('Error', 'You must be signed in to search.');
    return;
  }
  const fd = new FormData(form);
  const rawQuery = (fd.get('query') || '').trim();
  if (!rawQuery) return;
  const query = rawQuery.replace(/,/g, '');
  const res = document.getElementById('search-results');
  setLoading(true);
  const emailOrUsername = `email.ilike.%${query}%,username.ilike.%${query}%`;
  const { data, error } = await db
    .from('user_info')
    .select('user_id, first_name, last_name, email, username')
    .or(emailOrUsername)
    .limit(10);
  setLoading(false);

  let blockSets = await getBlockSetsForCurrentUser();

  if (error) {
    res.innerHTML = '<div class="text-red-500">' + error.message + '</div>';
    return;
  }
  // Blocked users (that you blocked) remain visible so you can choose to unblock and re-add.
  // Users who have blocked you are hidden from your search results.
  const visibleUsers = (data || []).filter((u) => !blockSets.blockedBy.has(u.user_id));
  if (!visibleUsers.length) {
    res.innerHTML = '<div class="text-gray-500">No users.</div>';
    return;
  }
  const enriched = await Promise.all(
    visibleUsers.map(async (u) => {
      const profile = await getUserInfo(u.user_id);
      return { ...u, profile };
    })
  );

  res.innerHTML = enriched
    .map((u) => {
      const initials = `${u.profile.first_name?.[0] ?? ''}${u.profile.last_name?.[0] ?? ''}`.trim().toUpperCase() || 'U';
      const avatar = u.profile.profile_picture
        ? `<img src="${u.profile.profile_picture}" alt="${u.profile.first_name || ''} ${u.profile.last_name || ''}" class="friend-avatar__img" />`
        : `<span>${initials}</span>`;
      return `
        <div class="p-3 border-b border-gray-700 flex justify-between items-center hover:bg-gray-700 transition">
            <div class="flex items-center gap-3">
                <div class="friend-avatar friend-avatar--small">${avatar}</div>
                <div>
                    <div class="font-medium text-black">${u.first_name} ${u.last_name} <span class="text-xs text-indigo-400">@${u.username || ''}</span></div>
                    <div class="text-xs text-gray-400">${u.email}</div>
                </div>
            </div>
            <div>
                <button data-action="add-friend" data-userid="${u.user_id}" class="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-500">Add Friend</button>
            </div>
        </div>`;
    })
    .join('');
}

export async function handleAddMember(form) {
  const email = form.querySelector('#add-member-email')?.value;
  if (!email) return;
  setLoading(true);
  const { data: user, error } = await db.from('user_info').select('user_id').eq('email', email).single();
  if (error || !user) {
    setLoading(false);
    showAlert('Error', 'User not found');
    return;
  }
  const { error: aerr } = await db
    .from('split_groups')
    .insert({ user_id: user.user_id, group_id: appState.currentGroup.id });
  setLoading(false);
  if (aerr) {
    showAlert('Error', aerr.message);
    return;
  }
  showAlert('Success', 'User added');
}

/**
 * ===============================================================
 * EXPENSES
 * ===============================================================
 */
export function calculateExpenseShares(totalAmountInput, splits) {
  const totalCents = Math.max(0, Math.round((Number(totalAmountInput) || 0) * 100));
  const normalized = (splits || [])
    .map((entry) => ({
      userId: entry.userId,
      weight: Math.max(0, Math.min(100, Number(entry.weight) || 0))
    }))
    .filter((entry) => entry.userId);

  if (!normalized.length || totalCents === 0) {
    return {
      totalCents,
      allocations: normalized.map((entry) => ({ ...entry, cents: 0 }))
    };
  }

  let weights = normalized.map((entry) => entry.weight);
  const fullShareIndex = weights.findIndex((w) => w === 100 && weights.length > 1);
  if (fullShareIndex !== -1) {
    weights = weights.map((w, idx) => (idx === fullShareIndex ? 100 : 0));
  }

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) {
    return {
      totalCents,
      allocations: normalized.map((entry) => ({ ...entry, cents: 0 }))
    };
  }

  const rawShares = weights.map((w) => (w / totalWeight) * totalCents);
  const baseShares = rawShares.map((value) => Math.floor(value));
  let remainder = totalCents - baseShares.reduce((sum, value) => sum + value, 0);

  const remainderOrder = rawShares
    .map((value, idx) => ({ idx, frac: value - baseShares[idx] }))
    .sort((a, b) => b.frac - a.frac);

  for (let i = 0; i < remainderOrder.length && remainder > 0; i += 1) {
    baseShares[remainderOrder[i].idx] += 1;
    remainder -= 1;
  }

  return {
    totalCents,
    allocations: normalized.map((entry, idx) => ({
      ...entry,
      cents: baseShares[idx]
    }))
  };
}

export async function handleCreateExpense(form) {
  if (!appState.currentUser || !appState.currentGroup?.id) {
    showAlert('Error', 'You must be in a group to add an expense.');
    return;
  }

  const fd = new FormData(form);
  const title = (fd.get('title') || '').trim();
  const explanation = (fd.get('explanation') || '').trim();
  const totalAmount = parseFloat(fd.get('total_amount'));
  const payer_id = (fd.get('payer_id') || '').trim() || null;
  const dueDateRaw = fd.get('due_date');
  const due_date = dueDateRaw ? new Date(dueDateRaw).toISOString() : null;
  const receiptInputFile = form.querySelector('input[name="receipt_image"]')?.files?.[0] || null;
  const pendingReceiptFile =
    appState.pendingReceiptGroupId && appState.currentGroup?.id === appState.pendingReceiptGroupId
      ? appState.pendingReceiptFile
      : null;
  const receiptFile = receiptInputFile || pendingReceiptFile || null;

  if (!title) {
    showAlert('Error', 'Title is required for an expense.');
    return;
  }
  if (!(totalAmount > 0)) {
    showAlert('Error', 'Enter a total amount greater than $0.');
    return;
  }

  const splits = Array.from(form.querySelectorAll('.expense-member-row'))
    .filter((row) => !row.classList.contains('is-removed'))
    .map((row) => {
      const slider = row.querySelector('.expense-split-slider');
      const percent = row.querySelector('.expense-percent-input');
      const weight = Number(percent?.value || slider?.value || 0) || 0;
      return {
        userId: row.dataset.memberId,
        weight
      };
    });
  const { allocations, totalCents } = calculateExpenseShares(totalAmount, splits);
  const hasContribution = allocations.some((entry) => entry.cents > 0);
  if (!hasContribution) {
    showAlert('Error', 'Assign at least one member to this expense.');
    return;
  }

  const receiptItems =
    appState.pendingReceiptGroupId && appState.currentGroup?.id === appState.pendingReceiptGroupId
      ? appState.pendingReceiptItems || []
      : [];
  const cleanedItems = receiptItems
    .filter((item) => Number.isFinite(item?.price))
    .map((item) => ({
      name: (item?.name || 'Item').replace(/,/g, '').trim() || 'Item',
      price: item.price
    }));

  let receiptPath = null;
  if (receiptFile) {
    if (receiptFile.size > MAX_RECEIPT_UPLOAD_BYTES) {
      showAlert('Error', 'Receipt image must be 10MB or smaller.');
      return;
    }
    const fileExt = (receiptFile.name.split('.').pop() || 'jpg').toLowerCase();
    const filePath = `${appState.currentGroup.id}/${Date.now()}.${fileExt}`;
    const { error: uploadErr } = await db.storage
      .from(RECEIPT_BUCKET)
      .upload(filePath, receiptFile, {
        cacheControl: '3600',
        upsert: true,
        contentType: receiptFile.type || 'image/jpeg'
      });
    if (uploadErr) {
      showAlert('Error', uploadErr.message || 'Unable to upload receipt.');
      return;
    }
    receiptPath = filePath;
  }

  const clientGeneratedId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `exp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  const expenseInfoPayload = {
    expense_id: clientGeneratedId,
    group_id: appState.currentGroup.id,
    title,
    explanation,
    total_amount: totalCents,
    payer_id: payer_id || null,
    date: new Date().toISOString(),
    proposal: true,
    due_date,
    receipt_image: receiptPath
  };

  setLoading(true);
  try {
    const { data: infoRows, error: infoErr } = await db
      .from('expense_info')
      .insert(expenseInfoPayload)
      .select('expense_id')
      .limit(1);
    if (infoErr) throw new Error(infoErr.message || 'Could not save expense details.');

    const persistedId = infoRows?.[0]?.expense_id || clientGeneratedId;
    const expenseRows = allocations.map((entry) => ({
      expense_id: persistedId,
      user_id: entry.userId,
      individual_amount: entry.cents,
      approval: false
    }));

    const { error: expenseErr } = await db.from('expense').insert(expenseRows);
    if (expenseErr) {
      // Clean up the expense_info row if splits fail to save.
      try {
        await db.from('expense_info').delete().eq('expense_id', persistedId);
      } catch (cleanupErr) {
        console.error('Failed to roll back expense_info row', cleanupErr);
      }
      throw new Error(expenseErr.message || 'Could not save expense shares.');
    }

    if (cleanedItems.length) {
      const itemsPayload = cleanedItems.map((item) => ({
        expense_id: persistedId,
        name: item.name,
        price: Math.round(item.price * 100) / 100
      }));
      const { error: itemsErr } = await db.from('expense_items').insert(itemsPayload);
      if (itemsErr) {
        console.warn('expense_items insert failed', itemsErr);
        showAlert('Warning', 'Expense saved, but receipt items could not be stored.');
      }
    }

    const fromModal = modalContainer.contains(form);
    if (fromModal) {
      modalContainer.innerHTML = '';
    } else if (appState.currentUser?.id && appState.currentGroup?.id) {
      navigate(`/${appState.currentUser.id}/groups/${appState.currentGroup.id}`);
    }
    resetPendingReceiptState();
    showAlert('Success', 'Expense proposal created.');
    fetchPendingProposals();
    fetchGroupPendingExpenses(appState.currentGroup.id);
    fetchGroupExpenseActivity(appState.currentGroup.id);
  } catch (err) {
    showAlert('Error', err?.message || 'Unable to create expense.');
  } finally {
    setLoading(false);
  }
}

async function applyReceiptFile(form, file, { autoScan = false } = {}) {
  if (!form) return;
  const label = form.querySelector('[data-receipt-label]');
  const previewImg = form.querySelector('[data-receipt-preview]');
  const placeholder = form.querySelector('[data-receipt-placeholder]');
  const statusEl = form.querySelector('[data-receipt-status]');
  const listEl = form.querySelector('[data-receipt-items]');
  const totalEl = form.querySelector('[data-receipt-total]');

  if (!file) {
    resetPendingReceiptState();
    form.dataset.receiptTotal = '';
    if (label) {
      label.textContent = 'No file chosen';
    }
    if (previewImg) {
      previewImg.removeAttribute('src');
      previewImg.classList.add('hidden');
    }
    if (placeholder) placeholder.classList.remove('hidden');
    if (statusEl) statusEl.textContent = 'Upload a receipt to scan.';
    if (listEl) listEl.innerHTML = '';
    if (totalEl) {
      totalEl.textContent = '';
      totalEl.hidden = true;
    }
    return;
  }

  if (file.size > MAX_RECEIPT_UPLOAD_BYTES) {
    showAlert('Error', 'Receipt image must be 10MB or smaller.');
    return;
  }

  const fileType = (file.type || '').toLowerCase();
  const fileName = (file.name || '').toLowerCase();
  const isJpeg = fileType === 'image/jpeg' || fileType === 'image/jpg' || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg');
  const isPng = fileType === 'image/png' || fileName.endsWith('.png');
  if (!isJpeg && !isPng) {
    showAlert('Error', 'Only JPEG and PNG files are supported for receipt scanning.');
    return;
  }

  if (appState.pendingReceiptPreviewUrl) {
    try {
      URL.revokeObjectURL(appState.pendingReceiptPreviewUrl);
    } catch (err) {
      console.warn('Failed to revoke receipt preview URL', err);
    }
  }

  const previewUrl = URL.createObjectURL(file);
  appState.pendingReceiptFile = file;
  appState.pendingReceiptPreviewUrl = previewUrl;
  appState.pendingReceiptItems = [];
  appState.pendingReceiptTotal = null;
  appState.pendingReceiptGroupId = appState.currentGroup?.id || null;
  form.dataset.receiptTotal = '';

  if (label) {
    label.textContent = file.name || 'Receipt image';
  }
  if (previewImg) {
    previewImg.src = previewUrl;
    previewImg.classList.remove('hidden');
  }
  if (placeholder) placeholder.classList.add('hidden');
  if (statusEl) statusEl.textContent = 'Scanning receipt...';
  if (listEl) listEl.innerHTML = '';
  if (totalEl) {
    totalEl.textContent = '';
    totalEl.hidden = true;
  }

  if (autoScan) {
    await handleReceiptScan(form);
  }
}

export async function handleReceiptFileChange(inputEl, { autoScan = false } = {}) {
  const form = inputEl?.closest('form');
  if (!form) return;
  const file = inputEl?.files?.[0] || null;
  await applyReceiptFile(form, file, { autoScan });
}

export async function handleReceiptDrop(form, file) {
  if (!form) return;
  await applyReceiptFile(form, file, { autoScan: true });
}

export async function handleReceiptScan(form) {
  if (!form) return;
  const fileInput = form.querySelector('input[name="receipt_image"]');
  const receiptFile = fileInput?.files?.[0] || appState.pendingReceiptFile || null;
  if (!receiptFile) {
    showAlert('Error', 'Upload a receipt image before scanning.');
    return;
  }
  const fileName = (receiptFile.name || '').toLowerCase();
  const fileType = (receiptFile.type || '').toLowerCase();
  const isJpeg = fileType === 'image/jpeg' || fileType === 'image/jpg' || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg');
  const isPng = fileType === 'image/png' || fileName.endsWith('.png');
  if (!isJpeg && !isPng) {
    showAlert('Error', 'Only JPEG and PNG files are supported for receipt scanning.');
    return;
  }

  appState.pendingReceiptFile = receiptFile;
  if (!appState.pendingReceiptGroupId && appState.currentGroup?.id) {
    appState.pendingReceiptGroupId = appState.currentGroup.id;
  }

  const scanButton = form.querySelector('[data-action="scan-receipt"]');
  const useTotalButton = form.querySelector('[data-action="use-receipt-total"]');
  const statusEl = form.querySelector('[data-receipt-status]');
  const listEl = form.querySelector('[data-receipt-items]');
  const totalEl = form.querySelector('[data-receipt-total]');

  const scanId = `${Date.now()}`;
  form.dataset.receiptScanId = scanId;
  form.dataset.receiptTotal = '';

  if (scanButton) scanButton.disabled = true;
  if (useTotalButton) useTotalButton.disabled = true;
  if (statusEl) statusEl.textContent = 'Preparing on-device OCR...';
  if (listEl) listEl.innerHTML = '';
  if (totalEl) {
    totalEl.textContent = '';
    totalEl.hidden = true;
  }

  appState.pendingReceiptItems = [];
  appState.pendingReceiptTotal = null;

  try {
    const result = await scanReceiptImage(receiptFile, (progress) => {
      if (statusEl) {
        const percent = Math.round((progress || 0) * 100);
        statusEl.textContent = `Scanning receipt... ${percent}%`;
      }
    });

    if (form.dataset.receiptScanId !== scanId) return;

    const items = result?.items || [];
    appState.pendingReceiptItems = items;
    if (listEl) {
      listEl.innerHTML = '';
      if (!items.length) {
        const empty = document.createElement('li');
        empty.className = 'receipt-scan__empty';
        empty.textContent = 'No items detected. Try a sharper photo.';
        listEl.appendChild(empty);
      } else {
        items.forEach((item) => {
          const row = document.createElement('li');
          const typeClass = item.type ? ` receipt-scan__item--${item.type}` : '';
          row.className = `receipt-scan__item${typeClass}`;
          const nameEl = document.createElement('span');
          nameEl.textContent = item.name;
          const priceEl = document.createElement('span');
          priceEl.textContent = formatCurrency(item.price);
          row.append(nameEl, priceEl);
          listEl.appendChild(row);
        });
      }
    }

    if (statusEl) {
      statusEl.textContent = items.length
        ? `Found ${items.length} line item${items.length === 1 ? '' : 's'}. Review below.`
        : 'No line items found. Try a clearer, brighter photo.';
    }

    const totalValue =
      typeof result?.detectedTotal === 'number'
        ? result.detectedTotal
        : result?.itemsTotal > 0
          ? result.itemsTotal
          : null;

    if (totalValue && Number.isFinite(totalValue)) {
      appState.pendingReceiptTotal = totalValue;
      form.dataset.receiptTotal = totalValue.toFixed(2);
      if (totalEl) {
        totalEl.textContent = `Detected total: ${formatCurrency(totalValue)}`;
        totalEl.hidden = false;
      }
      if (useTotalButton) useTotalButton.disabled = false;
    }
  } catch (err) {
    console.error('receipt scan failed', err);
    const message = err?.message || 'Receipt scan failed. Try a clearer photo.';
    showAlert('Error', message);
    if (statusEl) statusEl.textContent = message;
    appState.pendingReceiptItems = [];
    appState.pendingReceiptTotal = null;
  } finally {
    if (scanButton) scanButton.disabled = false;
  }
}

export function handleUseReceiptTotal(form) {
  if (!form) return;
  const totalInput = form.querySelector('[data-expense-total]');
  const totalValue = Number.isFinite(appState.pendingReceiptTotal)
    ? appState.pendingReceiptTotal
    : parseFloat(form.dataset.receiptTotal || '');
  if (!totalInput || !Number.isFinite(totalValue)) {
    showAlert('Error', 'No scanned total is available yet.');
    return;
  }
  totalInput.value = totalValue.toFixed(2);
  totalInput.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Handles user approval/decline of an expense share. When all shares for an
 * expense are approved, the parent expense_info.proposal is marked false.
 */
export async function handleExpenseApprovalResponse(expenseId, response) {
  if (!appState.currentUser?.id || !expenseId) {
    showAlert('Error', 'Missing expense or user context.');
    return;
  }
  const approve = response === 'approve';
  setLoading(true);
  try {
    const { error: updateErr } = await db
      .from('expense')
      .update({ approval: approve })
      .eq('expense_id', expenseId)
      .eq('user_id', appState.currentUser.id);
    if (updateErr) throw updateErr;

    if (approve) {
      const { data: rows, error: checkErr } = await db.from('expense').select('approval').eq('expense_id', expenseId);
      if (checkErr) throw checkErr;
      const allApproved = (rows || []).length > 0 && rows.every((row) => row.approval === true);
      if (allApproved) {
        await db.from('expense_info').update({ proposal: false }).eq('expense_id', expenseId);
      }
    }

    fetchGroupPendingExpenses(appState.currentGroup?.id);
    fetchGroupExpenseActivity(appState.currentGroup?.id);
    fetchPendingProposals();
    showAlert('Success', approve ? 'Marked approved.' : 'Marked declined.');
  } catch (err) {
    showAlert('Error', err?.message || 'Unable to update approval.');
  } finally {
    setLoading(false);
  }
}
