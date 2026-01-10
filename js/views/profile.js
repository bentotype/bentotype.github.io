import { appState, app, modalContainer } from '../state.js';
import { getUserInfo, UserTier } from '../users.js';
import { renderTopNav, escapeHtml } from './components.js';
import { render } from './index.js';

export async function renderProfile() {
    const user = appState.currentUser;
    if (!user) {
        appState.currentView = 'auth';
        render();
        return;
    }
    const info = await getUserInfo(user.id);
    const initials =
        `${info?.first_name?.[0] ?? ''}${info?.last_name?.[0] ?? ''}`.trim() ||
        (appState.currentUser?.email?.[0] ?? '').toUpperCase() ||
        'U';
    const avatarUrl =
        appState.pendingProfilePictureUrl ||
        (info?.profile_picture ? escapeHtml(info.profile_picture) : '');
    const hasPendingAvatar = Boolean(appState.pendingProfilePictureUrl);
    const tierLabel = info.tier === UserTier.FREE ? 'Free Tier' :
        info.tier === UserTier.PAID ? 'Paid Tier' :
            info.tier === UserTier.TESTING ? 'Testing Tier' :
                info.tier === UserTier.ADMIN ? 'Admin' : 'Free Tier';

    app.innerHTML = `
<div class="home-shell">
  ${renderTopNav('profile', info)}
  <main class="home-main">
    <section class="space-y-6">
      <div class="card p-8">
        <div class="flex items-start justify-between mb-6">
          <div>
            <p class="text-sm uppercase tracking-wide text-indigo-500 font-semibold">Account</p>
            <h2 class="text-3xl font-bold text-gray-900 mt-2">Your Profile</h2>
            <p class="text-gray-500 mt-1">Keep your details up to date so your friends can find you.</p>
            <span class="inline-block mt-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium border border-indigo-100">${tierLabel}</span>
          </div>
          <button type="button" data-action="change-password" class="px-4 py-2 rounded-full bg-gray-900 text-white hover:bg-gray-800 transition text-sm font-semibold">Change Password</button>
        </div>
        <div class="profile-photo-card">
          <div class="profile-photo-preview">
            ${avatarUrl
            ? `<img src="${avatarUrl}" alt="Current profile picture">`
            : `<span>${initials}</span>`
        }
          </div>
          <div class="profile-photo-content">
            <h3 class="profile-photo-title">Profile picture</h3>
            <p class="profile-photo-subtitle">Choose a photo to upload instantly. It will apply after you click Save Changes.</p>
            <form class="profile-photo-form">
              <input type="file" name="profile_picture" accept="image/*" class="profile-photo-input hidden">
              <button type="button" class="profile-photo-button" data-action="trigger-profile-upload">Choose Photo</button>
              <span class="text-sm text-gray-600">
                ${hasPendingAvatar ? 'New photo uploaded. Save Changes to confirm.' : 'JPG or PNG, max 5MB.'}
              </span>
            </form>
          </div>
        </div>
        <form id="profile-form" data-form-action="update-profile" class="space-y-5">
          <div class="grid md:grid-cols-2 gap-4">
            <div>
              <label class="text-sm font-medium text-gray-500">First name</label>
              <input name="first_name" value="${info.first_name || ''}" placeholder="First Name" class="w-full rounded-lg border border-gray-200 bg-white text-gray-900 px-4 py-2.5 mt-1">
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">Last name</label>
              <input name="last_name" value="${info.last_name || ''}" placeholder="Last Name" class="w-full rounded-lg border border-gray-200 bg-white text-gray-900 px-4 py-2.5 mt-1">
            </div>
          </div>
          <div class="grid md:grid-cols-2 gap-4">
            <div>
              <label class="text-sm font-medium text-gray-500">Username</label>
              <input name="username" value="${info.username || ''}" placeholder="Username" class="w-full rounded-lg border border-gray-200 bg-white text-gray-900 px-4 py-2.5 mt-1">
            </div>
            <div>
              <label class="text-sm font-medium text-gray-500">Email</label>
              <input name="email" value="${info.email || ''}" placeholder="Email" class="w-full rounded-lg border border-gray-200 bg-white text-gray-900 px-4 py-2.5 mt-1">
            </div>
          </div>
          <div class="flex flex-wrap gap-3 pt-2">
            <button class="px-6 py-2.5 rounded-full bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition">Save Changes</button>
            <button type="button" data-action="logout" class="px-6 py-2.5 rounded-full bg-gray-200 text-gray-900 font-semibold hover:bg-gray-300 transition">Sign Out</button>
          </div>
        </form>
      </div>
    </section>
  </main>
</div>`;
}

export function showChangePasswordModal() {
    const modalId = 'change-password-modal';
    modalContainer.innerHTML = `
<div id="${modalId}" class="modal fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
  <form data-form-action="change-password" class="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md space-y-4">
    <h3 class="text-lg font-semibold text-gray-900">Change password</h3>
    <label class="block text-sm font-medium text-gray-700">
      Old password
      <input name="old_password" type="password" required class="w-full rounded-md border border-gray-300 px-3 py-2 mt-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
    </label>
    <label class="block text-sm font-medium text-gray-700">
      New password
      <input name="new_password" type="password" minlength="6" required class="w-full rounded-md border border-gray-300 px-3 py-2 mt-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
    </label>
    <label class="block text-sm font-medium text-gray-700">
      Confirm new password
      <input name="confirm_password" type="password" minlength="6" required class="w-full rounded-md border border-gray-300 px-3 py-2 mt-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
    </label>
    <div class="flex justify-end gap-3 pt-2">
      <button type="button" class="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100" data-action="close-modal" data-target="${modalId}">Cancel</button>
      <button class="px-4 py-2 rounded-md bg-indigo-600 text-white font-semibold hover:bg-indigo-500">Update password</button>
    </div>
  </form>
</div>`;
    setTimeout(() => document.getElementById(modalId)?.classList.add('flex', 'show'), 10);
}
