import { appState, app, modalContainer } from '../state.js';
import { getUserInfo, getFriendsForUser } from '../users.js';
import { fetchFriends, fetchPendingFriendRequests } from '../fetchers.js';
import { renderTopNav, escapeHtml } from './components.js';
import { render } from './index.js';
import { setLoading } from '../ui.js';

export async function renderFriends() {
  const user = appState.currentUser;
  if (!user) {
    appState.currentView = 'auth';
    render();
    return;
  }
  const info = await getUserInfo(user.id);
  app.innerHTML = `
<div class="home-shell">
  ${renderTopNav('friends', info)}
  <main class="home-main">
    <section class="max-w-3xl mx-auto space-y-6">
      
      <!-- Search -->
      <div class="card search-card">
        <div class="card-header">
          <h3 class="card-title">Search profiles</h3>
        </div>
        <div class="card-body">
          <form id="search-users-form" data-form-action="search-user" class="search-form">
            <input id="search-input" name="query" placeholder="Email or username" class="search-input">
            <button class="search-button">Search</button>
          </form>
          <div id="search-results" class="search-results mt-4"></div>
        </div>
      </div>

      <!-- Invite Friend (Golden Hue) -->
      <div class="invite-card">
        <div class="invite-card__title">
            <div class="invite-card__icon-box">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            </div>
            Invite a Friend
        </div>
        <div class="invite-card__body">
            <form class="invite-card__form" onsubmit="event.preventDefault(); alert('Invite sent! (Demo)');">
              <div class="invite-card__input-wrapper">
                  <div class="invite-card__input-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  </div>
                  <input type="email" placeholder="Enter email or username" class="invite-card__input" required>
              </div>
              <button class="invite-card__button">Send Invite</button>
            </form>
        </div>
      </div>

      <!-- Friends List -->
      <div class="card friends-card">
        <div class="card-header">
          <h3 class="card-title">Your Friends</h3>
        </div>
        <div id="friends-list" class="card-body p-4">Loading...</div>
      </div>

      <!-- Pending Requests -->
      <div class="card pending-card">
        <div class="card-header">
          <h3 class="card-title">Pending Requests</h3>
        </div>
        <div id="pending-requests-list" class="card-body">No pending requests.</div>
      </div>

    </section>
  </main>
</div>`;
  fetchFriends();
  fetchPendingFriendRequests();
}

export async function renderUserProfileModal(userId) {
  setLoading(true);
  const info = await getUserInfo(userId);
  setLoading(false);
  const initials =
    `${info?.first_name?.[0] ?? ''}${info?.last_name?.[0] ?? ''}`.trim() ||
    (info?.email?.[0] ?? '').toUpperCase() ||
    'U';
  const avatarUrl = info?.profile_picture ? escapeHtml(info.profile_picture) : '';
  const id = 'user-profile-' + userId;
  modalContainer.innerHTML = `
<div id="${id}" class="modal fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
    <div class="bg-gray-800 p-4 rounded-md w-full max-w-md">
        <div class="modal-profile-avatar">
            ${avatarUrl
      ? `<img src="${avatarUrl}" alt="${escapeHtml(info.first_name || '')} ${escapeHtml(info.last_name || '')}" />`
      : `<span>${initials}</span>`
    }
        </div>
        <h3 class="font-medium text-white">${info.first_name} ${info.last_name}</h3>
        <p class="text-sm text-gray-400">@${info.username || ''}</p>
        <p class="text-sm text-gray-400">${info.email}</p>
        <div class="mt-4 text-right">
            <button data-action="close-modal" data-target="${id}" class="px-3 py-1 bg-gray-700 text-white rounded-md mr-2">Close</button>
            <button data-action="add-friend" data-userid="${userId}" class="px-3 py-1 bg-emerald-600 text-white rounded-md">Add Friend</button>
        </div>
    </div>
</div>`;
  setTimeout(() => document.getElementById(id).classList.add('flex', 'show'), 10);
}

export async function showInviteFriendsModal() {
  const modalId = 'invite-group-modal';
  modalContainer.innerHTML = `
<div id="${modalId}" class="modal fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
  <div class="invite-modal bg-white rounded-2xl shadow-2xl w-full max-w-xl">
    <div class="invite-modal__header">
      <h3 class="invite-modal__title">Invite friends</h3>
      <p class="invite-modal__subtitle">Select friends below to add them to this group.</p>
    </div>
    <div id="invite-friends-list" class="invite-list">Loading friends...</div>
    <div class="invite-modal__footer">
      <button type="button" data-action="close-modal" data-target="${modalId}" class="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100">Done</button>
    </div>
  </div>
</div>`;
  setTimeout(() => document.getElementById(modalId).classList.add('flex', 'show'), 10);

  const listEl = document.getElementById('invite-friends-list');
  if (!appState.currentUser) {
    listEl.innerHTML = '<p class="invite-list__empty">You must be signed in to invite friends.</p>';
    return;
  }

  const friends = await getFriendsForUser(appState.currentUser.id);
  if (!friends.length) {
    listEl.innerHTML = '<p class="invite-list__empty">No friends to invite yet.</p>';
    return;
  }

  const excludedIds = new Set([appState.currentUser.id, ...(appState.currentGroupMemberIds || [])]);
  const availableFriends = friends.filter(({ friendId }) => !excludedIds.has(friendId));
  if (!availableFriends.length) {
    listEl.innerHTML = '<p class="invite-list__empty">No friends left to add to this group</p>';
    return;
  }

  listEl.innerHTML = availableFriends
    .map(({ friendId, info }) => {
      const fullName = escapeHtml(`${info.first_name || ''} ${info.last_name || ''}`.trim() || info.email || 'Friend');
      const email = escapeHtml(info.email || '');
      const username = info.username ? `@${escapeHtml(info.username)}` : '';
      const initials = `${info.first_name?.[0] ?? ''}${info.last_name?.[0] ?? ''}`.trim().toUpperCase() || 'U';
      const avatar = info.profile_picture
        ? `<img src="${info.profile_picture}" alt="${fullName}" class="invite-list-avatar__img">`
        : `<span class="invite-list-avatar__fallback">${initials}</span>`;
      return `
      <div class="invite-list-item">
        <div class="invite-list-avatar">${avatar}</div>
        <div class="invite-list-info">
          <div class="invite-list-name">${fullName} ${username ? `<span class="invite-list-username">${username}</span>` : ''}</div>
          <div class="invite-list-email">${email}</div>
        </div>
        <button type="button" class="invite-button" data-action="invite-to-group" data-userid="${friendId}">Invite</button>
      </div>`;
    })
    .join('');
}
