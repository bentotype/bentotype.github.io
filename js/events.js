import { app, appState, modalContainer } from './state.js';
import {
  render,
  showCreateGroupModal,
  showEditGroupModal,
  showInviteFriendsModal,
  renderUserProfileModal,
  showCreateExpenseModal,
  showChangePasswordModal,
  showDeleteGroupConfirmModal,
  showRemoveMemberConfirmModal
} from './views.js';
import { navigate } from './router.js';

import {
  handleAddFriend,
  handleAddMember,
  handleCreateGroup,
  handleFriendRequestResponse,
  handleLogin,
  handleLogout,
  handleSearchUser,
  handleSignUp,
  handleUpdateProfile,
  handleUpdateGroup,
  handleInviteFriendToGroup,
  handleGroupInviteResponse,
  handleProfilePictureFileChange,
  handleCreateExpense,
  calculateExpenseShares,
  handleChangePassword,
  handleDeleteGroup,
  handleRemoveGroupMember,
  handleRemoveFriend,
  handleBlockFriend,
  handleExpenseApprovalResponse
} from './handlers.js';
import { formatCurrency } from './format.js';
import { showAlert, showConfirm } from './ui.js';

const clamp = (val, min = 0, max = 100) => Math.max(min, Math.min(max, val));
const sanitizeDecimalInput = (input) => {
  if (!input) return '';
  const raw = (input.value || '').replace(',', '.').replace(/[^\d.]/g, '');
  const parts = raw.split('.');
  const intPart = parts[0] || '';
  const decPart = parts.slice(1).join('').slice(0, 2);
  const safeInt = intPart === '' ? '0' : intPart;
  const result = decPart ? `${safeInt}.${decPart}` : safeInt;
  input.value = result;
  return result;
};

function closeFriendMenus(exceptId = null) {
  document.querySelectorAll('.friend-menu__list').forEach((menu) => {
    if (!exceptId || menu.dataset.menuFor !== exceptId) {
      menu.classList.add('hidden');
    }
  });
  document.querySelectorAll('.friend-menu__trigger').forEach((btn) => {
    if (!exceptId || btn.dataset.friendid !== exceptId) {
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

function getActiveMemberRows(form) {
  return Array.from(form.querySelectorAll('.expense-member-row')).filter((row) => !row.classList.contains('is-removed'));
}

function redistributeWeights(members, changedId) {
  if (!members.length) return;
  const pivot = members.find((m) => m.memberId === changedId) || members[0];
  pivot.weight = clamp(pivot.weight);
  const others = members.filter((m) => m !== pivot);
  if (!others.length) {
    pivot.weight = 100;
    return;
  }
  let remaining = clamp(100 - pivot.weight, 0, 100);
  const othersSum = others.reduce((sum, m) => sum + clamp(m.weight), 0);
  if (othersSum === 0) {
    const even = remaining / others.length;
    others.forEach((m) => {
      m.weight = even;
    });
    return;
  }
  others.forEach((m) => {
    const share = clamp(m.weight) / othersSum;
    m.weight = remaining * share;
  });
}

function updateExpenseSplitPreview(form, changedTarget = null) {
  if (!form || form.dataset.formAction !== 'create-expense') return;
  const totalInput = form.querySelector('[data-expense-total]');
  const totalAmount = parseFloat(totalInput?.value || '0') || 0;
  const totalCents = Math.max(0, Math.round(totalAmount * 100));
  const rows = getActiveMemberRows(form);
  if (!rows.length) return;

  const members = rows.map((row) => {
    const slider = row.querySelector('.expense-split-slider');
    const percent = row.querySelector('.expense-percent-input');
    const amountInput = row.querySelector('.expense-amount-input');
    const memberId = row.dataset.memberId;
    const weight = Number(slider?.value) || 0;
    return { memberId, slider, percent, amountInput, weight };
  });

  const changedMemberId = changedTarget ? changedTarget.closest('.expense-member-row')?.dataset.memberId : null;
  if (changedTarget && changedMemberId) {
    const member = members.find((m) => m.memberId === changedMemberId);
    if (member) {
      if (changedTarget.classList.contains('expense-percent-input')) {
        member.weight = Number(changedTarget.value) || 0;
      } else if (changedTarget.classList.contains('expense-amount-input')) {
        if (totalAmount > 0) {
          const amt = parseFloat(changedTarget.value || '0') || 0;
          member.weight = clamp((amt / totalAmount) * 100);
        } else {
          member.weight = 0;
        }
      } else if (changedTarget.classList.contains('expense-split-slider')) {
        member.weight = Number(changedTarget.value) || 0;
      }
    }
  }

  redistributeWeights(members, changedMemberId);

  members.forEach((m) => {
    const rounded = Math.round(m.weight);
    if (m.slider) m.slider.value = rounded;
    if (m.percent) m.percent.value = rounded;
  });

  const splits = members.map((m) => ({
    userId: m.memberId,
    weight: m.weight
  }));

  const { allocations } = calculateExpenseShares(totalAmount, splits);
  const totalAllocated = allocations.reduce((sum, entry) => sum + entry.cents, 0);

  allocations.forEach((entry) => {
    const amountVal = entry.cents / 100;
    const label = form.querySelector(`[data-share-for="${entry.userId}"]`);
    if (label) label.value = amountVal.toFixed(2);
  });

  const totalEl = form.querySelector('#expense-split-total');
  if (totalEl) totalEl.textContent = formatCurrency(totalAllocated / 100);

  const statusEl = form.querySelector('#expense-split-status');
  if (statusEl) {
    if (!totalCents) {
      statusEl.textContent = 'Enter a total amount to split across members.';
      statusEl.classList.remove('text-green-600', 'text-red-600');
    } else if (totalAllocated === 0) {
      statusEl.textContent = 'Assign at least one share to a member.';
      statusEl.classList.add('text-red-600');
      statusEl.classList.remove('text-green-600');
    } else if (totalAllocated !== totalCents) {
      statusEl.textContent = 'Totals adjusted to match your splits.';
      statusEl.classList.add('text-green-600');
      statusEl.classList.remove('text-red-600');
    } else {
      statusEl.textContent = 'Split equals total amount.';
      statusEl.classList.add('text-green-600');
      statusEl.classList.remove('text-red-600');
    }
  }
}

/**
 * Wires up global click/submit listeners for the SPA shell and modal layer.
 */
export function registerEventListeners() {
  app.addEventListener('click', (e) => {
    if (!e.target.closest('.friend-menu')) {
      closeFriendMenus();
    }
    let target = e.target;
    if (!(target instanceof Element) && target?.parentElement) {
      target = target.parentElement;
    }
    const actionEl = target?.closest?.('[data-action]');
    if (!actionEl) return;
    if (!app.contains(actionEl)) return;
    const act = actionEl.dataset.action;
    const t = actionEl;

    switch (act) {
      case 'show-tab': {
        document.querySelectorAll('.tab-content').forEach((el) => el.classList.add('hidden'));
        document.getElementById(e.target.dataset.target).classList.remove('hidden');
        const activeButton = e.target.closest('.tab-button');
        if (activeButton) {
          document.querySelectorAll('.tab-button').forEach((btn) => {
            btn.classList.remove('border-b-2', 'border-indigo-400', 'text-indigo-400', 'font-semibold');
            btn.classList.add('text-gray-400');
          });
          activeButton.classList.add('border-b-2', 'border-indigo-400', 'text-indigo-400', 'font-semibold');
          activeButton.classList.remove('text-gray-400');
        }
        break;
      }
      case 'logout':
        handleLogout();
        break;
      case 'show-create-group-modal':
        showCreateGroupModal();
        break;
      case 'view-group':
        appState.currentGroup = {
          id: t.dataset.groupId,
          group_title: t.dataset.groupTitle ? decodeURIComponent(t.dataset.groupTitle) : '',
          description: t.dataset.groupDesc ? decodeURIComponent(t.dataset.groupDesc) : '',
          owner_id: t.dataset.ownerId || ''
        };
        navigate(`/${appState.currentUser?.id}/groups/${t.dataset.groupId}`);
        break;
      case 'edit-group':
        showEditGroupModal({
          id: t.dataset.groupId,
          title: t.dataset.groupTitle ? decodeURIComponent(t.dataset.groupTitle) : '',
          description: t.dataset.groupDesc ? decodeURIComponent(t.dataset.groupDesc) : '',
          ownerId: t.dataset.ownerId || ''
        });
        break;
      case 'show-invite-modal':
        showInviteFriendsModal();
        break;
      case 'show-create-expense-modal':
        showCreateExpenseModal();
        setTimeout(() => {
          const form = document.getElementById('create-expense-form');
          updateExpenseSplitPreview(form);
        }, 20);
        break;
      case 'nav': {
        const targetView = t.dataset.target || e.target.dataset.target;
        if (targetView) {
          navigate(`/${appState.currentUser?.id || ''}/${targetView}`);
        }
        break;
      }
      case 'view-profile':
        renderUserProfileModal(e.target.dataset.userid);
        break;
      case 'add-friend':
        handleAddFriend(e.target.dataset.userid);
        break;
      case 'toggle-friend-menu': {
        const friendId = t.dataset.friendid;
        if (!friendId) return;
        const menu = document.querySelector(`.friend-menu__list[data-menu-for="${friendId}"]`);
        const trigger = document.querySelector(`.friend-menu__trigger[data-friendid="${friendId}"]`);
        const isOpen = menu && !menu.classList.contains('hidden');
        closeFriendMenus(friendId);
        if (menu && trigger) {
          if (isOpen) {
            menu.classList.add('hidden');
            trigger.setAttribute('aria-expanded', 'false');
          } else {
            menu.classList.remove('hidden');
            trigger.setAttribute('aria-expanded', 'true');
          }
        }
        break;
      }
      case 'remove-friend': {
        const friendId = t.dataset.friendid;
        if (!friendId) return;
        closeFriendMenus();
        showConfirm('Remove friend', 'Are you sure you want to remove this friend?', {
          confirmText: 'Remove',
          cancelText: 'Cancel'
        }).then((ok) => {
          if (ok) handleRemoveFriend(friendId);
        });
        break;
      }
      case 'block-friend': {
        const friendId = t.dataset.friendid;
        if (!friendId) return;
        closeFriendMenus();
        showConfirm('Block friend', 'Block this user? They will also be removed from friends.', {
          confirmText: 'Block',
          cancelText: 'Cancel'
        }).then((ok) => {
          if (ok) handleBlockFriend(friendId);
        });
        break;
      }
      case 'change-password':
        showChangePasswordModal();
        break;
      case 'respond-friend-request':
        handleFriendRequestResponse(t.dataset.requester, t.dataset.requestee, t.dataset.response);
        break;
      case 'respond-expense':
        handleExpenseApprovalResponse(t.dataset.expenseId, t.dataset.response);
        break;
      case 'respond-group-invite':
        handleGroupInviteResponse(t.dataset.groupId, t.dataset.response);
        break;
      case 'remove-group-member': {
        const userId = t.dataset.userid;
        if (!userId) return;
        const memberName = t.dataset.memberName || 'this member';
        const groupId = t.dataset.groupId || appState.currentGroup?.id || '';
        try {
          showRemoveMemberConfirmModal(userId, memberName, groupId);
        } catch (err) {
          console.error('remove-member modal failed', err);
          if (confirm(`Remove ${memberName} from this group?`)) {
            handleRemoveGroupMember(userId, groupId);
          }
        }
        break;
      }
      case 'trigger-profile-upload': {
        const form = t.closest('.profile-photo-form') || document;
        const input = form.querySelector('input[name="profile_picture"]');
        input?.click();
        break;
      }
    }
  });

  app.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const action = form.dataset.formAction;
    if (!action) return;

    switch (action) {
      case 'signup':
        handleSignUp(form);
        break;
      case 'login':
        handleLogin(form);
        break;
      case 'create-group':
        handleCreateGroup(form);
        break;
      case 'search-user':
        handleSearchUser(form);
        break;
      case 'add-member':
        handleAddMember(form);
        break;
      case 'update-profile':
        handleUpdateProfile(form);
        break;
    }
  });

  app.addEventListener('change', (e) => {
    const target = e.target;
    if (target?.name === 'profile_picture') {
      handleProfilePictureFileChange(target);
    }
  });

  modalContainer.addEventListener('click', (e) => {
    let t = e.target;
    let act = null;
    while (t && t !== modalContainer) {
      if (t.dataset && t.dataset.action) {
        act = t.dataset.action;
        break;
      }
      t = t.parentElement;
    }

    if (!act) return;
    switch (act) {
      case 'close-modal': {
        const modal = document.getElementById(t.dataset.target);
        if (modal) {
          modal.classList.remove('show');
          setTimeout(() => modal.remove(), 300);
        } else {
          modalContainer.innerHTML = '';
        }
        break;
      }
      case 'invite-to-group': {
        const userId = t.dataset.userid;
        if (!userId) return;
        const btn = t;
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Inviting...';
        handleInviteFriendToGroup(userId)
          .then((ok) => {
            if (ok) {
              btn.textContent = 'Invited';
            } else {
              btn.disabled = false;
              btn.textContent = original;
            }
          })
          .catch(() => {
            btn.disabled = false;
            btn.textContent = original;
          });
        break;
      }
      case 'expense-split-even': {
        const form = t.closest('form');
        if (!form) return;
        form.querySelectorAll('.expense-split-slider').forEach((slider) => {
          slider.value = 50;
        });
        form.querySelectorAll('.expense-percent-input').forEach((input) => {
          input.value = 50;
        });
        updateExpenseSplitPreview(form);
        break;
      }
      case 'expense-remove-member': {
        const form = t.closest('form');
        if (!form) return;
        const row = form.querySelector(`.expense-member-row[data-member-id="${t.dataset.memberId}"]`);
        const activeRows = form.querySelectorAll('.expense-member-row:not(.is-removed)');
        if (activeRows.length <= 1) {
          showAlert('Error', 'You need at least one member in the split.');
          return;
        }
        if (row) {
          row.classList.add('is-removed', 'hidden');
          row.querySelectorAll('input').forEach((input) => (input.value = 0));
          const addSelect = form.querySelector('#expense-add-select');
          if (addSelect && !addSelect.querySelector(`option[value="${t.dataset.memberId}"]`)) {
            const opt = document.createElement('option');
            opt.value = t.dataset.memberId;
            opt.textContent = row.dataset.memberLabel || 'Member';
            addSelect.appendChild(opt);
          }
          updateExpenseSplitPreview(form);
        }
        break;
      }
      case 'expense-add-member': {
        const form = t.closest('form');
        if (!form) return;
        const select = form.querySelector('#expense-add-select');
        const memberId = select?.value;
        if (!memberId) return;
        const row = form.querySelector(`.expense-member-row[data-member-id="${memberId}"]`);
        if (row) {
          row.classList.remove('is-removed', 'hidden');
          const slider = row.querySelector('.expense-split-slider');
          const percent = row.querySelector('.expense-percent-input');
          slider && (slider.value = 50);
          percent && (percent.value = 50);
          select.value = '';
          const optToRemove = select.querySelector(`option[value="${memberId}"]`);
          if (optToRemove) optToRemove.remove();
          updateExpenseSplitPreview(form);
        }
        break;
      }
      case 'delete-group': {
        const groupId = t.dataset.groupId;
        if (!groupId) return;
        showDeleteGroupConfirmModal(groupId);
        break;
      }
    }
  });

  modalContainer.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const action = form.dataset.formAction;
    if (!action) return;

    switch (action) {
      case 'create-group':
        handleCreateGroup(form);
        break;
      case 'update-group':
        handleUpdateGroup(form);
        break;
      case 'create-expense':
        handleCreateExpense(form);
        break;
      case 'change-password':
        handleChangePassword(form);
        break;
      case 'confirm-delete-group':
        handleDeleteGroup(form.dataset.groupId);
        break;
      case 'confirm-remove-member':
        handleRemoveGroupMember(form.dataset.userid, form.dataset.groupId);
        break;
    }
  });

  modalContainer.addEventListener('input', (e) => {
    const target = e.target;
    if (target.classList.contains('expense-amount-input')) {
      sanitizeDecimalInput(target);
    }
    if (
      target.classList.contains('expense-split-slider') ||
      target.classList.contains('expense-percent-input') ||
      target.classList.contains('expense-amount-input') ||
      typeof target.dataset.expenseTotal !== 'undefined'
    ) {
      const form = target.closest('form');
      updateExpenseSplitPreview(form, target);
    }
  });

  modalContainer.addEventListener('change', (e) => {
    const target = e.target;
    if (target?.name === 'receipt_image') {
      const form = target.closest('form');
      const label = form?.querySelector('[data-receipt-label]');
      if (label) {
        label.textContent = target.files?.[0]?.name || 'No file chosen';
      }
    } else if (
      target.classList.contains('expense-percent-input') ||
      target.classList.contains('expense-amount-input') ||
      typeof target.dataset.expenseTotal !== 'undefined'
    ) {
      if (typeof target.dataset.expenseTotal !== 'undefined') {
        sanitizeDecimalInput(target);
      } else if (target.classList.contains('expense-amount-input')) {
        sanitizeDecimalInput(target);
      }
      const form = target.closest('form');
      updateExpenseSplitPreview(form, target);
    }
  });
}
