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
    <section class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

      <!-- LEFT COLUMN: Actions (Invite, Search, Pending) -->
      <div class="col-span-12 lg:col-span-5 xl:col-span-4 space-y-6">
          
          <!-- 1. Invite a Friend (Global Search) -->
          <div class="backdrop-blur-xl bg-gradient-to-br from-emerald-900/10 to-emerald-950/20 dark:from-emerald-900/20 dark:to-emerald-950/40 border border-emerald-500/20 shadow-lg rounded-xl overflow-hidden relative">
            <div class="absolute top-0 right-0 w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500/10 to-transparent blur-2xl"></div>
            <div class="p-6">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 flex items-center justify-center shadow-inner">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-600 dark:text-emerald-400"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Invite a Friend</h3>
                </div>
                
                <form id="search-users-form" data-form-action="search-user" class="flex gap-2 relative z-10">
                    <div class="relative flex-1">
                        <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                        </div>
                        <input id="search-input" name="query" placeholder="Email/Username..." 
                            class="w-full pl-10 pr-2 py-2.5 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-gray-900 dark:text-gray-100">
                    </div>
                    <button class="px-3 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-lg font-medium shadow-lg shadow-emerald-500/20 transition-all text-sm whitespace-nowrap">
                        Search
                    </button>
                </form>
                <div id="search-results" class="search-results mt-3"></div>
            </div>
          </div>

          <!-- 2. Search Your Friends (Local Filter) -->
          <div class="backdrop-blur-xl bg-white/60 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-700/50 shadow-sm rounded-xl p-2">
              <div class="relative">
                 <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                 </div>
                 <input id="local-friend-search" placeholder="Search your friends..." 
                        class="w-full pl-10 pr-4 py-2.5 bg-transparent border-none text-base text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-0">
              </div>
          </div>

          <!-- 3. Pending Requests (Conditional) -->
          <div id="pending-container" class="hidden backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 border border-emerald-500/30 shadow-md rounded-xl overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700/50 bg-emerald-50/50 dark:bg-emerald-900/20">
              <h3 class="font-semibold text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                Pending Requests
              </h3>
            </div>
            <div id="pending-requests-list" class="p-2"></div>
          </div>

      </div>

      <!-- RIGHT COLUMN: Friends List -->
      <div class="col-span-12 lg:col-span-7 xl:col-span-8">
          <!-- 4. Friends List -->
          <div class="backdrop-blur-xl bg-white/40 dark:bg-gray-800/40 border border-gray-200/50 dark:border-gray-700/50 shadow-lg rounded-xl overflow-hidden min-h-[500px]">
            <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700/50 flex justify-between items-center sticky top-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md z-10">
              <h3 class="font-semibold text-gray-900 dark:text-white">Your Friends</h3>
              <span class="text-xs text-gray-400" id="friends-count">Loading...</span>
            </div>
            <div id="friends-list" class="p-4 space-y-2">Loading...</div>
          </div>
      </div>

    </section>
  </main>
</div>`;

  // Filter Logic
  const localSearch = document.getElementById('local-friend-search');
  localSearch?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const items = document.querySelectorAll('.friend-item-modern');
    items.forEach(item => {
      const name = item.dataset.name || '';
      const email = item.dataset.email || '';
      if (name.toLowerCase().includes(term) || email.toLowerCase().includes(term)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  });

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
