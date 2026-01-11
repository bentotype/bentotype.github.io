import { db } from './supabaseClient.js';
import { appState } from './state.js';
import { getUserInfo, getFriendsForUser } from './users.js';
import { formatCurrency } from './format.js';

const GEAR_ICON_URL = 'https://em-content.zobj.net/source/microsoft-teams/337/gear_2699-fe0f.png';
const escapeHtml = (value = '') =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * ===============================================================
 * GROUP DATA
 * ===============================================================
 */

export async function fetchUserGroups() {
  const container = document.getElementById('groups-list');
  if (!container) return;

  const { data: groups, error } = await db
    .from('split_groups')
    .select('group_id, invite, group_info(group_title, description, owner_id)')
    .eq('user_id', appState.currentUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching groups:', error);
    container.innerHTML = '<p class="text-red-500 p-4">Failed to load groups.</p>';
    return;
  }

  // Filter out invites (handled separately)
  const confirmed = (groups || []).filter(g => g.invite !== true);

  if (!confirmed || confirmed.length === 0) {
    container.innerHTML = `
      <div class="backdrop-blur-xl bg-white/40 dark:bg-gray-800/40 border border-gray-200/50 dark:border-gray-700/50 shadow-lg rounded-2xl p-12 text-center">
        <div class="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
           <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-600 dark:text-emerald-400"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">No groups yet</h3>
        <p class="text-gray-500 dark:text-gray-400 mt-1">Create your first group to get started.</p>
      </div>`;
    return;
  }

  // Pre-fetch member counts or details if needed?
  // Ideally, we'd join 'group_members', but the current query is on 'split_groups'.
  // For now, we will just render the card with the info we have.

  container.innerHTML = confirmed.map(g => {
    const info = g.group_info;
    const title = info?.group_title || 'Untitled Group';
    const desc = info?.description || 'No description';

    // We can't easily get member count/avatars without a join or separate fetch here,
    // so we'll stick to a clean card layout without the avatars for now, or just show "View Details"

    return `
    <div onclick="window.history.pushState({}, '', '/${appState.currentUser.id}/groups/${g.group_id}'); window.dispatchEvent(new Event('popstate'));" 
         class="group cursor-pointer backdrop-blur-xl bg-white/60 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-700/50 shadow-md hover:shadow-xl hover:scale-[1.01] transition-all duration-300 rounded-2xl overflow-hidden">
        <div class="p-6">
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-4">
                    <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center border border-emerald-500/10 shadow-sm group-hover:shadow-md transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-600 dark:text-emerald-400"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">${escapeHtml(title)}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">${escapeHtml(desc)}</p>
                    </div>
                </div>
                <div class="text-right">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300">
                      Active
                    </span>
                </div>
            </div>
            
            <div class="pt-4 border-t border-gray-100 dark:border-gray-700/50 flex justify-between items-center">
                <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <span>View Group Details</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="group-hover:translate-x-1 transition-transform"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </div>
            </div>
        </div>
    </div>`;
  }).join('');
}

export async function fetchPendingProposals() {
  const el = document.getElementById('proposals-list');
  if (!el || !appState.currentUser) return;

  el.innerHTML = '<div class="text-gray-500">Loading proposals...</div>';

  const { data, error } = await db
    .from('expense')
    .select('expense_id, individual_amount, approval, expense_info(title, total_amount, proposal, group_info(group_title))')
    .eq('user_id', appState.currentUser.id)
    .eq('approval', false)
    .eq('expense_info.proposal', true);

  if (error) {
    el.innerHTML = '<div class="text-red-500 text-sm">No current proposals.</div>';
    return;
  }
  if (!data || data.length === 0) {
    el.innerHTML = '<div class="text-gray-500">No pending proposals.</div>';
    return;
  }

  el.innerHTML = data
    .map((p) => {
      const amount = (p.individual_amount ?? p.expense_info?.total_amount ?? 0) / 100;
      const total = (p.expense_info?.total_amount ?? 0) / 100;
      const groupName = p.expense_info?.group_info?.group_title || 'Group';
      return `<div class="pending-item">
            <div>
            <div class="pending-title">${p.expense_info?.title || 'Expense'}</div>
            <div class="pending-meta">${groupName}</div>
            </div>
            <div class="pending-meta text-right">
              <div class="pending-amount">${formatCurrency(amount)}</div>
              <div class="text-xs text-gray-500">of ${formatCurrency(total)}</div>
            </div>
        </div>`;
    })
    .join('');
}

export async function fetchFriends() {
  const el = document.getElementById('friends-list');
  const user = appState.currentUser;
  if (!el || !user) return;

  const friendEntries = await getFriendsForUser(user.id);
  if (!friendEntries.length) {
    el.innerHTML = '<div class="text-gray-500">No friends yet.</div>';
    return;
  }

  el.innerHTML = friendEntries
    .map(
      ({ friendId, info }) => {
        const initials = `${info.first_name?.[0] ?? ''}${info.last_name?.[0] ?? ''}`.trim().toUpperCase() || 'U';
        const avatar = info.profile_picture
          ? `<img src="${info.profile_picture}" alt="${escapeHtml(info.first_name || '')} ${escapeHtml(info.last_name || '')}" class="friend-avatar__img" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
          : `<span>${initials}</span>`;

        return `
        <div class="friend-item-modern group" data-friend-id="${friendId}">
          <div class="friend-item__info">
            <div class="friend-item__avatar">${avatar}</div>
            <div class="friend-item__details">
              <h3>${escapeHtml(info.first_name || '')} ${escapeHtml(info.last_name || '')} <span class="text-xs text-emerald-500 font-normal ml-2">@${escapeHtml(info.username || '')}</span></h3>
              <p>${escapeHtml(info.email || '')}</p>
            </div>
          </div>
          <div class="friend-item__actions">
             <div class="friend-menu relative">
               <button type="button" class="friend-menu__trigger" data-action="toggle-friend-menu" data-friendid="${friendId}" aria-haspopup="true" aria-expanded="false">&#8942;</button>
               <div class="friend-menu__list hidden" data-menu-for="${friendId}">
                 <button type="button" class="friend-menu__item" data-action="remove-friend" data-friendid="${friendId}">Remove friend</button>
                 <button type="button" class="friend-menu__item friend-menu__item--danger" data-action="block-friend" data-friendid="${friendId}">Block friend</button>
               </div>
             </div>
          </div>
        </div>`;
      }
    )
    .join('');
}

export async function fetchGroupInvites() {
  const el = document.getElementById('group-invite-requests');
  const user = appState.currentUser;
  if (!el || !user) return;

  el.innerHTML = '<div class="text-gray-500">Loading invites...</div>';

  const { data, error } = await db
    .from('split_groups')
    .select('group_id, group_info(group_title, description)')
    .eq('user_id', user.id)
    .eq('invite', true);

  if (error) {
    el.innerHTML = '<div class="text-red-500 text-sm">Unable to load invites.</div>';
    return;
  }
  if (!data?.length) {
    el.innerHTML = '<div class="text-gray-500 text-sm">No group invites at the moment.</div>';
    return;
  }

  const inviteCards = data
    .map((row) => {
      const info = row.group_info;
      const title = info?.group_title || 'Untitled group';
      const desc = info?.description || 'No description yet.';
      return `
        <div class="invite-card">
          <div class="invite-card__copy">
            <p class="invite-card__title">${title}</p>
            <p class="invite-card__desc">${desc}</p>
          </div>
          <div class="invite-card__actions">
            <button
              type="button"
              class="invite-card__action invite-card__action--accept"
              data-action="respond-group-invite"
              data-response="accept"
              data-group-id="${row.group_id}"
              aria-label="Accept invite to ${title}">
              &#10003;
            </button>
            <button
              type="button"
              class="invite-card__action invite-card__action--decline"
              data-action="respond-group-invite"
              data-response="decline"
              data-group-id="${row.group_id}"
              aria-label="Decline invite to ${title}">
              &#10005;
            </button>
          </div>
        </div>`;
    })
    .join('');

  el.innerHTML = inviteCards;
}

export async function fetchGroupMembers(groupId) {
  const listEl = document.getElementById('group-members-list');
  if (!groupId) return;

  if (listEl) {
    listEl.innerHTML = '<p class="text-sm text-gray-500">Loading members...</p>';
  }

  const { data, error } = await db
    .from('split_groups')
    .select('user_id, invite')
    .eq('group_id', groupId);

  if (error) {
    if (listEl) {
      listEl.innerHTML = '<p class="text-sm text-red-500">Unable to load members.</p>';
    }
    appState.currentGroupMembers = [];
    appState.currentGroupMemberIds = [];
    return;
  }

  appState.currentGroupMemberIds = (data || []).map((row) => row.user_id);

  const confirmed = (data || []).filter((row) => row.invite !== true);
  if (!confirmed.length) {
    if (listEl) {
      listEl.innerHTML = '<p class="text-sm text-gray-500">No members yet.</p>';
    }
    appState.currentGroupMembers = [];
    return;
  }

  const memberIds = confirmed.map((row) => row.user_id).filter(Boolean);
  const members = (
    await Promise.all(
      memberIds.map(async (id) => {
        const info = await getUserInfo(id);
        return { user_id: id, ...info };
      })
    )
  ).filter(Boolean);

  appState.currentGroupMembers = members;

  const ownerId = appState.currentGroup?.owner_id;

  if (listEl) {
    listEl.innerHTML = members
      .map((user) => {
        const isOwner = ownerId && user.user_id === ownerId;
        const canRemove = ownerId && appState.currentUser?.id === ownerId && !isOwner;
        const fullName = `${escapeHtml(user.first_name || '')} ${escapeHtml(user.last_name || '')}`.trim() || escapeHtml(user.email || 'Member');
        const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.trim().toUpperCase() || 'U';
        const usernameLabel = user.username ? `<span class="text-xs text-emerald-500 ml-1">@${escapeHtml(user.username)}</span>` : '';
        const avatarContent = user.profile_picture
          ? `<div class="group-member__avatar"><img src="${user.profile_picture}" alt="${escapeHtml(
            user.first_name || ''
          )} ${escapeHtml(user.last_name || '')}" /></div>`
          : `<div class="group-member__avatar">${initials}</div>`;
        const ownerBadge = isOwner ? '<span class="group-member__owner-badge">Owner</span>' : '';
        const removeButton = canRemove
          ? `<button type="button" class="group-member__remove" data-action="remove-group-member" data-group-id="${appState.currentGroup?.id || ''}" data-userid="${user.user_id}" data-member-name="${fullName}" aria-label="Remove ${fullName} from group">-</button>`
          : '';
        return `
        <div class="group-member${isOwner ? ' group-member--owner' : ''}">
          ${avatarContent}
          <div class="group-member__meta">
            <p class="group-member__name">${escapeHtml(user.first_name || '')} ${escapeHtml(user.last_name || '')}${usernameLabel} ${ownerBadge}</p>
            <p class="group-member__email">${escapeHtml(user.email || '')}</p>
          </div>
          ${removeButton}
        </div>`;
      })
      .join('');
  }
}

export async function fetchGroupPendingExpenses(groupId) {
  const el = document.getElementById('group-pending-approvals');
  if (!el || !groupId || !appState.currentUser) return;

  el.innerHTML = '<p class="text-sm text-gray-500">Checking for pending approvals...</p>';
  const { data, error } = await db
    .from('expense')
    .select('expense_id, individual_amount, approval, expense_info(title, due_date, group_id)')
    .eq('user_id', appState.currentUser.id)
    .eq('approval', false)
    .eq('expense_info.group_id', groupId)
    .order('expense_info.due_date', { ascending: true });

  if (error) {
    el.innerHTML = '<p class="text-sm text-red-500">No current expenses.</p>';
    return;
  }
  if (!data?.length) {
    el.innerHTML = '<p class="text-sm text-gray-500">No pending approvals right now.</p>';
    return;
  }

  el.innerHTML = data
    .map((row) => {
      const due = row.expense_info?.due_date ? new Date(row.expense_info.due_date).toLocaleDateString() : 'No due date';
      const title = escapeHtml(row.expense_info?.title || 'Expense');
      const amount = (row.individual_amount || 0) / 100;
      return `<div class="expense-pill" data-expense-id="${row.expense_id}">
        <div>
          <div class="expense-pill__title">${title}</div>
          <div class="expense-pill__meta">Due ${due}</div>
        </div>
        <div class="expense-pill__actions">
          <div class="expense-pill__amount">${formatCurrency(amount)}</div>
          <div class="expense-pill__buttons">
            <button type="button" class="expense-pill__btn approve" data-action="respond-expense" data-response="approve" data-expense-id="${row.expense_id}" aria-label="Approve expense">✔</button>
            <button type="button" class="expense-pill__btn decline" data-action="respond-expense" data-response="decline" data-expense-id="${row.expense_id}" aria-label="Decline expense">✕</button>
          </div>
        </div>
      </div>`;
    })
    .join('');
}

export async function fetchGroupExpenseActivity(groupId) {
  const el = document.getElementById('group-expense-list');
  if (!el || !groupId) return;

  el.innerHTML = '<p class="text-sm text-gray-500">Loading activity...</p>';

  const { data, error } = await db
    .from('expense_info')
    .select('expense_id, title, explanation, total_amount, payer_id, date, proposal, due_date')
    .eq('group_id', groupId)
    .eq('proposal', false)
    .order('date', { ascending: false })
    .limit(15);

  if (error) {
    el.innerHTML = '<p class="text-sm text-red-500">Unable to load activity.</p>';
    return;
  }
  if (!data?.length) {
    el.innerHTML = '<p class="text-sm text-gray-500">No expenses yet. Start by proposing one.</p>';
    return;
  }

  const memberLookup = new Map(
    (appState.currentGroupMembers || []).map((m) => [
      m.user_id,
      `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email || 'Member'
    ])
  );

  el.innerHTML = data
    .map((row) => {
      const payerLabel = row.payer_id ? memberLookup.get(row.payer_id) || 'Payer pending' : 'Payer not set';
      const due = row.due_date ? new Date(row.due_date).toLocaleDateString() : 'No due date';
      const created = row.date ? new Date(row.date).toLocaleDateString() : '';
      const desc = row.explanation ? escapeHtml(row.explanation.slice(0, 140)) : 'No description yet.';
      const badge = row.proposal
        ? '<span class="expense-chip expense-chip--pending">Proposal</span>'
        : '<span class="expense-chip expense-chip--approved">Approved</span>';
      return `<div class="expense-activity-item">
        <div>
          <div class="expense-activity-title">${escapeHtml(row.title || 'Expense')}</div>
          <div class="expense-activity-meta">${badge} <span class="expense-separator">•</span> ${escapeHtml(
        payerLabel
      )} <span class="expense-separator">•</span> Due ${due} ${created ? `<span class="expense-separator">•</span> ${created}` : ''
        }</div>
          <div class="expense-activity-desc">${desc}</div>
        </div>
        <div class="expense-activity-amount">${formatCurrency((row.total_amount || 0) / 100)}</div>
      </div>`;
    })
    .join('');
}

/**
 * ===============================================================
 * SOCIAL DATA
 * ===============================================================
 */
export async function fetchPendingFriendRequests() {
  const container = document.getElementById('pending-requests-list');
  const wrapper = document.getElementById('pending-container'); // Parent wrapper
  const user = appState.currentUser;

  if (!container || !user) return;

  const { data, error } = await db
    .from('friend_request')
    .select('id_1, id_2')
    .eq('id_1', user.id);

  if (error) {
    console.error('Error fetching requests', error);
    if (wrapper) wrapper.classList.add('hidden');
    return;
  }

  if (!data || data.length === 0) {
    if (wrapper) wrapper.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  // Show wrapper if we have requests
  if (wrapper) wrapper.classList.remove('hidden');

  const requests = await Promise.all(
    data.map(async (row) => {
      const sender = await getUserInfo(row.id_2);
      return {
        sender,
        created_at: row.created_at,
        requesterId: row.id_2,
        requesteeId: row.id_1
      };
    })
  );

  container.innerHTML = requests
    .map(({ sender, requesterId, requesteeId }) => {
      const name = `${sender.first_name || ''} ${sender.last_name || ''}`.trim() || sender.email;
      const email = sender.email || '';

      return `
    <div class="flex items-center justify-between p-3 bg-white/50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-600/50 mb-2">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold">
            ${(name[0] || '?').toUpperCase()}
        </div>
        <div>
           <p class="text-sm font-semibold text-gray-900 dark:text-white">${escapeHtml(name)}</p>
           <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(email)}</p>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="p-2 rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors" 
                data-action="respond-friend-request" 
                data-response="accept" 
                data-requester="${requesterId}" 
                data-requestee="${requesteeId}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
        <button class="p-2 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors" 
                data-action="respond-friend-request" 
                data-response="reject" 
                data-requester="${requesterId}" 
                data-requestee="${requesteeId}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>`;
    })
    .join('');
}

/**
 * ===============================================================
 * METRICS
 * ===============================================================
 */
export async function fetchMonthlyTotal() {
  const target = document.getElementById('monthly-total');
  if (!target || !appState.currentUser) return;

  const { data: groups, error: groupsError } = await db
    .from('split_groups')
    .select('group_id')
    .eq('user_id', appState.currentUser.id);
  if (groupsError || !groups?.length) {
    target.textContent = '$0.00';
    return;
  }

  const groupIds = groups.map((g) => g.group_id);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data, error } = await db
    .from('expense_info')
    .select('total_amount, group_id, proposal, created_at')
    .in('group_id', groupIds)
    .eq('proposal', false)
    .gte('created_at', startOfMonth.toISOString());

  if (error) {
    target.textContent = formatCurrency(0);
    console.error('monthly total', error);
    return;
  }
  const cents = data.reduce((sum, row) => sum + (row.total_amount || 0), 0);
  target.textContent = formatCurrency(cents / 100);
}
