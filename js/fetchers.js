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
  const el = document.getElementById('groups-list');
  if (!el || !appState.currentUser) return;

  const { data, error } = await db
    .from('groups')
    .select('group_id, invite, group_info(group_title, description, owner_id)')
    .eq('user_id', appState.currentUser.id);

  if (error) {
    el.classList.remove('groups-grid');
    el.innerHTML = '<div class="text-red-500">No Groups Found</div>';
    return;
  }
  const confirmed = (data || []).filter((row) => row.invite !== true);
  if (!confirmed.length) {
    el.classList.remove('groups-grid');
    el.innerHTML = '<div class="text-gray-500">You have not created any groups yet.</div>';
    return;
  }

  if (appState.currentGroup) {
    const match = confirmed.find((row) => row.group_id === appState.currentGroup.id);
    if (match?.group_info?.owner_id) {
      appState.currentGroup.owner_id = match.group_info.owner_id;
    }
  }

  const cards = confirmed
    .map((g) => {
      const title = g.group_info?.group_title || 'Untitled group';
      const description = g.group_info?.description || 'No description yet.';
      const ownerId = g.group_info?.owner_id || '';
      const safeTitle = encodeURIComponent(title);
      const safeDesc = encodeURIComponent(description);
      return `
        <button
          type="button"
          class="group-card"
          data-action="view-group"
          data-group-id="${g.group_id}"
          data-group-title="${safeTitle}"
          data-group-desc="${safeDesc}"
          data-owner-id="${ownerId}">
          <div class="group-card__header">
            <span class="group-card__meta">Group</span>
            <span
              class="group-card__settings"
              aria-label="Edit group settings"
              data-action="edit-group"
              data-group-id="${g.group_id}"
              data-group-title="${safeTitle}"
              data-group-desc="${safeDesc}"
              data-owner-id="${ownerId}">
              <img src="${GEAR_ICON_URL}" alt="" class="group-card__settings-icon" />
            </span>
          </div>
          <div class="group-card__title">${title}</div>
          <p class="group-card__desc">${description}</p>
          <span class="text-indigo-500 text-sm font-semibold">Open group →</span>
        </button>`;
    })
    .join('');

  el.classList.add('groups-grid');
  el.innerHTML = cards;
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
          ? `<img src="${info.profile_picture}" alt="${escapeHtml(info.first_name || '')} ${escapeHtml(info.last_name || '')}" class="friend-avatar__img" />`
          : `<span>${initials}</span>`;
        return `
        <div class="p-4 border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition friend-card" data-friend-id="${friendId}">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 cursor-pointer" data-action="view-friend-profile" data-friend-id="${friendId}">
              <div class="friend-avatar">${avatar}</div>
              <div>
                <div class="text-gray-900 font-semibold text-lg">${escapeHtml(info.first_name || '')} ${escapeHtml(info.last_name || '')}</div>
                <div class="text-sm text-indigo-500">@${escapeHtml(info.username || '')}</div>
                <div class="text-sm text-gray-600">${escapeHtml(info.email || '')}</div>
              </div>
            </div>
            <div class="friend-menu">
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
    .from('groups')
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
  if (!listEl || !groupId) return;

  listEl.innerHTML = '<p class="text-sm text-gray-500">Loading members...</p>';

  const { data, error } = await db
    .from('groups')
    .select('user_id, invite')
    .eq('group_id', groupId);

  if (error) {
    listEl.innerHTML = '<p class="text-sm text-red-500">Unable to load members.</p>';
    appState.currentGroupMembers = [];
    appState.currentGroupMemberIds = [];
    return;
  }

  appState.currentGroupMemberIds = (data || []).map((row) => row.user_id);

  const confirmed = (data || []).filter((row) => row.invite !== true);
  if (!confirmed.length) {
    listEl.innerHTML = '<p class="text-sm text-gray-500">No members yet.</p>';
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

  listEl.innerHTML = members
    .map((user) => {
      const isOwner = ownerId && user.user_id === ownerId;
      const canRemove = ownerId && appState.currentUser?.id === ownerId && !isOwner;
      const fullName = `${escapeHtml(user.first_name || '')} ${escapeHtml(user.last_name || '')}`.trim() || escapeHtml(user.email || 'Member');
      const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.trim().toUpperCase() || 'U';
      const usernameLabel = user.username ? `<span class="text-xs text-indigo-500 ml-1">@${escapeHtml(user.username)}</span>` : '';
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
      return `<div class="expense-pill">
        <div>
          <div class="expense-pill__title">${title}</div>
          <div class="expense-pill__meta">Due ${due}</div>
        </div>
        <div class="text-right">
            <div class="expense-pill__amount">${formatCurrency(amount)}</div>
            <button class="text-xs bg-green-600 text-white px-2 py-1 rounded mt-1 hover:bg-green-500" 
                data-action="approve-expense" 
                data-expense-id="${row.expense_id}">Approve</button>
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
  const el = document.getElementById('pending-requests-list');
  const user = appState.currentUser;
  if (!el || !user) return;

  const { data, error } = await db
    .from('friend_request')
    .select('id_1, id_2')
    .eq('id_2', user.id);

  if (error) {
    el.innerHTML = '<div class="text-red-500">Unable to load requests.</div>';
    return;
  }
  if (!data || data.length === 0) {
    el.innerHTML = '<div class="text-gray-500">No pending requests.</div>';
    return;
  }

  const requests = await Promise.all(
    data.map(async (row) => {
      const sender = await getUserInfo(row.id_1);
      return {
        sender,
        created_at: row.created_at,
        requesterId: row.id_1,
        requesteeId: row.id_2
      };
    })
  );

  el.innerHTML = requests
    .map(({ sender, created_at, requesterId, requesteeId }) => {
      const avatar = sender.profile_picture
        ? `<img src="${sender.profile_picture}" alt="${escapeHtml(sender.first_name || '')} ${escapeHtml(sender.last_name || '')}" />`
        : `<span>${(sender.first_name?.[0] || '')}${(sender.last_name?.[0] || '')}</span>`;
      const date = created_at ? new Date(created_at).toLocaleDateString() : '';
      const usernameLabel = sender.username ? `@${sender.username}` : '';
      return `<div class="pending-item invite-card friend-request-card">
            <div class="invite-card__copy">
                <div class="friend-avatar friend-avatar--small">${avatar}</div>
                <p class="invite-card__title">
                    ${sender.first_name} ${sender.last_name}
                    ${usernameLabel ? `<span class="invite-card__username">${usernameLabel}</span>` : ''}
                </p>
                <p class="invite-card__desc">${sender.email}</p>
                <p class="invite-card__date">${date}</p>
            </div>
            <div class="invite-card__actions">
                <button class="invite-card__action invite-card__action--accept"
                    data-action="respond-friend-request"
                    data-response="accept"
                    data-requester="${requesterId}"
                    data-requestee="${requesteeId}"
                    aria-label="Accept friend request">
                    &#10003;
                </button>
                <button class="invite-card__action invite-card__action--decline"
                    data-action="respond-friend-request"
                    data-response="reject"
                    data-requester="${requesterId}"
                    data-requestee="${requesteeId}"
                    aria-label="Reject friend request">
                    &#10005;
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
    .from('groups')
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
    target.textContent = '$0';
    console.error('monthly total', error);
    return;
  }
  const cents = data.reduce((sum, row) => sum + (row.total_amount || 0), 0);
  target.textContent = formatCurrency(cents / 100);
}

/**
 * ===============================================================
 * DUES
 * ===============================================================
 */
export async function fetchDues(user1, user2) {
  if (!user1 || !user2) return [];

  // fetch where (id_1 = u1 AND id_2 = u2) OR (id_1 = u2 AND id_2 = u1)
  const { data, error } = await db
    .from('dues')
    .select('id_1, id_2, amount, expense_id, expense_info(title, date)')
    .or(`and(id_1.eq.${user1},id_2.eq.${user2}),and(id_1.eq.${user2},id_2.eq.${user1})`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchDues error', error);
    return [];
  }
  return data || [];
}
