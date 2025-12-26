import { db } from './supabaseClient.js';
import { appState, modalContainer } from './state.js';
import { setLoading, showAlert } from './ui.js';
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
import { getUserInfo } from './users.js';

const PROFILE_PICTURE_BUCKET = 'profile_pictures';
const MAX_PROFILE_UPLOAD_BYTES = 5 * 1024 * 1024;
const RECEIPT_BUCKET = 'expense_receipts';
const MAX_RECEIPT_UPLOAD_BYTES = 10 * 1024 * 1024;

async function getBlockSetsForCurrentUser() {
  if (!appState.currentUser?.id) {
    return { blocked: new Set(), blockedBy: new Set() };
  }
  const userId = appState.currentUser.id;
  const { data, error } = await db
    .from('block_list')
    .select('user_id_1, user_id_2')
    .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);

  if (error) {
    throw error;
  }

  const blocked = new Set();
  const blockedBy = new Set();
  (data || []).forEach((row) => {
    if (row.user_id_1 === userId) blocked.add(row.user_id_2);
    if (row.user_id_2 === userId) blockedBy.add(row.user_id_1);
  });
  return { blocked, blockedBy };
}

/**
 * ===============================================================
 * AUTH HANDLERS
 * ===============================================================
 */

export async function handleLogout() {
  await db.auth.signOut();
}

export async function handleSignUp(form) {
  setLoading(true);
  const fd = new FormData(form);
  const email = fd.get('email');
  const password = fd.get('password');
  const confirmPassword = fd.get('confirm_password');
  const first_name = fd.get('first_name');
  const last_name = fd.get('last_name');
  const username = fd.get('username');
  const phone_number = (fd.get('phone_number') || '').trim() || null;

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

  const { data: authData, error: authErr } = await db.auth.signUp({ email, password });
  if (authErr) {
    setLoading(false);
    showAlert('Error', authErr.message);
    return;
  }
  const { error: infoErr } = await db
    .from('user_info')
    .insert({ user_id: authData.user.id, email, first_name, last_name, username, phone_number, password });
  setLoading(false);
  if (infoErr) {
    showAlert('Error', 'Could not save user_info ' + infoErr.message);
    return;
  }
  window.location.href = 'confirmation.html';
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
    appState.currentUser = data.user;
    appState.currentView = 'home';
    render();
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
    showAlert('Error', err?.message || 'Unable to change password.');
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
    const { blocked, blockedBy } = await getBlockSetsForCurrentUser();
    if (blocked.has(targetUserId) || blockedBy.has(targetUserId)) {
      showAlert('Error', 'Friend request not allowed because one of you has blocked the other.');
      return;
    }

    const payload = { id_1: appState.currentUser.id, id_2: targetUserId };
    const { error } = await db.from('friend_request').insert(payload);
    if (error) throw error;
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
    const { data: blocks, error: blockErr } = await db
      .from('block_list')
      .select('user_id_1, user_id_2')
      .or(`and(user_id_1.eq.${requesterId},user_id_2.eq.${requesteeId}),and(user_id_1.eq.${requesteeId},user_id_2.eq.${requesterId})`);
    if (blockErr) throw blockErr;
    if (blocks?.length) {
      await db.from('friend_request').delete().eq('id_1', requesterId).eq('id_2', requesteeId);
      showAlert('Error', 'Friend request cannot be processed because a block is in place.');
      fetchPendingFriendRequests();
      return;
    }

    if (response === 'accept') {
      const payload = [
        { id_1: requesterId, id_2: requesteeId },
        { id_1: requesteeId, id_2: requesterId }
      ];
      const { error: friendErr } = await db
        .from('friend_list')
        .insert(payload, { upsert: true, onConflict: 'id_1,id_2' });
      if (friendErr) throw friendErr;
    }
    const { error: deleteErr } = await db
      .from('friend_request')
      .delete()
      .eq('id_1', requesterId)
      .eq('id_2', requesteeId);
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
    const { error } = await db
      .from('friend_list')
      .delete()
      .or(`and(id_1.eq.${userId},id_2.eq.${friendId}),and(id_1.eq.${friendId},id_2.eq.${userId})`);
    if (error) throw error;
    showAlert('Success', 'Friend removed.');
    fetchFriends();
  } catch (err) {
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
    const { error: friendErr } = await db
      .from('friend_list')
      .delete()
      .or(`and(id_1.eq.${userId},id_2.eq.${friendId}),and(id_1.eq.${friendId},id_2.eq.${userId})`);
    if (friendErr) throw friendErr;
    const { error: requestErr } = await db
      .from('friend_request')
      .delete()
      .or(`and(id_1.eq.${userId},id_2.eq.${friendId}),and(id_1.eq.${friendId},id_2.eq.${userId})`);
    if (requestErr) throw requestErr;

    const { error: blockErr } = await db
      .from('block_list')
      .insert({ user_id_1: userId, user_id_2: friendId }, { upsert: true, onConflict: 'user_id_1,user_id_2' });
    if (blockErr) throw blockErr;

    showAlert('Success', 'User blocked and removed from friends.');
    fetchFriends();
    fetchPendingFriendRequests();
  } catch (err) {
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

  const { error } = await db.from('groups').insert({
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

    const { error: groupsDeleteErr } = await db.from('groups').delete().eq('group_id', groupId);
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
      .from('groups')
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
    const { error } = await db.from('groups').insert(payload);
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

    const { data: removed, error: deleteErr } = await db
      .from('groups')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', memberId)
      .select('user_id, group_id');
    if (deleteErr) throw deleteErr;
    if (!removed || removed.length === 0) {
      throw new Error('Member not found in this group.');
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
      .from('groups')
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
          .from('groups')
          .update({ invite: false })
          .eq('group_id', groupId)
          .eq('user_id', userId);
        if (updateErr) throw updateErr;
        showAlert('Success', 'Invite accepted. You have joined the group.');
      }
      refreshGroups = true;
    } else {
      const { error: deleteErr } = await db
        .from('groups')
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

  let blockSets = { blocked: new Set(), blockedBy: new Set() };
  try {
    blockSets = await getBlockSetsForCurrentUser();
  } catch (err) {
    res.innerHTML = '<div class="text-red-500">Unable to check block settings right now.</div>';
    return;
  }

  if (error) {
    res.innerHTML = '<div class="text-red-500">' + error.message + '</div>';
    return;
  }
  const visibleUsers = (data || []).filter((u) => !blockSets.blocked.has(u.user_id) && !blockSets.blockedBy.has(u.user_id));
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
    .from('groups')
    .insert({ user_id: user.user_id, group_id: appState.currentGroup.id });
  setLoading(false);
  if (aerr) {
    showAlert('Error', aerr.message);
    return;
  }
  showAlert('Success', 'User added');
}

export async function handleApproveExpense(expenseId) {
  if (!expenseId || !appState.currentUser?.id) return;

  setLoading(true);
  try {
    const userId = appState.currentUser.id;

    // 1. Mark expense as approved
    const { data: expenseItem, error: updateErr } = await db
      .from('expense')
      .update({ approval: true })
      .eq('expense_id', expenseId)
      .eq('user_id', userId)
      .select('individual_amount, expense_id')
      .single();

    if (updateErr) throw new Error(updateErr.message);

    // 2. Fetch expense info to get the payer
    const { data: expenseInfo, error: infoErr } = await db
      .from('expense_info')
      .select('payer_id, title')
      .eq('expense_id', expenseId)
      .single();

    if (infoErr) throw new Error(infoErr.message);

    // 3. Insert into Dues if approver != payer
    if (expenseInfo.payer_id && expenseInfo.payer_id !== userId) {
      const { error: dueErr } = await db
        .from('dues')
        .insert({
          id_1: expenseInfo.payer_id, // Payer (owed)
          id_2: userId,               // Approver (ower)
          expense_id: expenseId,
          amount: expenseItem.individual_amount
        });

      if (dueErr) {
        console.error('Failed to insert due', dueErr);
        // We warn but don't fail the whole operation since approval succeeded
        showAlert('Warning', 'Expense approved, but could not record debt.');
      } else {
        showAlert('Success', 'Expense approved and debt recorded.');
      }
    } else {
      showAlert('Success', 'Expense approved.');
    }

    // Refresh
    if (appState.currentGroup?.id) {
      fetchGroupPendingExpenses(appState.currentGroup.id);
      fetchGroupExpenseActivity(appState.currentGroup.id);
    }
  } catch (err) {
    showAlert('Error', err.message || 'Unable to approve expense.');
  } finally {
    setLoading(false);
  }
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
  const receiptFile = form.querySelector('input[name="receipt_image"]')?.files?.[0] || null;

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

  const expense_id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `exp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  const expenseInfoPayload = {
    expense_id,
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

  const expenseRows = allocations.map((entry) => ({
    expense_id,
    user_id: entry.userId,
    individual_amount: entry.cents,
    approval: false
  }));

  setLoading(true);
  const { error: infoErr } = await db.from('expense_info').insert(expenseInfoPayload);
  if (infoErr) {
    setLoading(false);
    showAlert('Error', infoErr.message || 'Could not save expense details.');
    return;
  }

  const { error: expenseErr } = await db.from('expense').insert(expenseRows);
  setLoading(false);
  if (expenseErr) {
    showAlert('Warning', 'Expense created, but shares could not be saved: ' + expenseErr.message);
    return;
  }

  modalContainer.innerHTML = '';
  showAlert('Success', 'Expense proposal created.');
  fetchPendingProposals();
  fetchGroupPendingExpenses(appState.currentGroup.id);
  fetchGroupExpenseActivity(appState.currentGroup.id);
}
