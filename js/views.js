import { appState, app, modalContainer } from './state.js';
import { t } from './strings.js';
import { setLoading } from './ui.js';
import { getUserInfo, getFriendsForUser } from './users.js';
import {
  fetchMonthlyTotal,
  fetchUserGroups,
  fetchPendingProposals,
  fetchFriends,
  fetchPendingFriendRequests,
  fetchGroupInvites,
  fetchGroupMembers,
  fetchGroupPendingExpenses,
  fetchGroupPendingExpenses,
  fetchGroupExpenseActivity,
  fetchActivities
} from './fetchers.js';

const escapeHtml = (value = '') =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
async function renderTopNav(activeTab, info) {
  const { fetchBadgeCounts } = await import('./fetchers.js');
  const counts = await fetchBadgeCounts();

  const navItems = [
    { id: 'home', label: t('dashboard_title'), action: 'nav', count: counts.home },
    { id: 'friends', label: t('friends_title'), action: 'nav', count: counts.friends },
    { id: 'groups', label: t('groups_title'), action: 'nav', count: counts.groups },
    { id: 'activity', label: t('activity_title'), action: 'nav', count: 0 }
  ];
  const initials =
    `${info?.first_name?.[0] ?? ''}${info?.last_name?.[0] ?? ''}`.trim() ||
    (appState.currentUser?.email?.[0] ?? '').toUpperCase() ||
    'U';
  const avatarUrl = info?.profile_picture ? escapeHtml(info.profile_picture) : '';
  const avatarAlt = escapeHtml(`${info?.first_name || ''} ${info?.last_name || ''}`.trim() || 'Profile photo');
  const avatarContent = avatarUrl
    ? `<img src="${avatarUrl}" alt="${avatarAlt}" class="app-avatar__image">`
    : initials;
  const navMarkup = navItems
    .map(
      ({ id, label, action, count }) => {
        const activeClass = activeTab === id ? ' is-active' : '';
        const badge = count > 0 ? `<span class="nav-badge">${count}</span>` : '';
        return `<button class="app-nav__item${activeClass}" data-action="${action}" data-target="${id}">
            ${label}
            ${badge}
        </button>`;
      }
    )
    .join('');

  return `
<header class="app-header">
  <div class="app-header__left">
    <div class="app-logo">${t('app_name')}</div>
  </div>
  <nav class="app-nav">
    ${navMarkup}
  </nav>
  <button class="app-avatar" data-action="nav" data-target="profile" aria-label="Open profile">${avatarContent}</button>
</header>`;
}

function renderAuth() {
  app.innerHTML = `
<div class="flex min-h-full items-center justify-center p-8 bg-gray-900">
  <div class="w-full max-w-md space-y-6">
    <h2 class="text-3xl font-bold text-center text-white">${t('login_title')}</h2>
    <div class="bg-gray-800 rounded-lg p-6 shadow-xl border border-indigo-900">
      <div class="mb-6 flex space-x-2 border-b border-gray-700">
        <button data-action="show-tab" data-target="login-form" class="tab-button border-b-2 border-indigo-400 text-indigo-400 font-semibold px-4 py-3">${t('login_link')}</button>
        <button data-action="show-tab" data-target="signup-form" class="tab-button px-4 py-3 text-gray-400 hover:text-indigo-400 transition">${t('signup_link')}</button>
      </div>
      <div id="login-form" class="tab-content">
        <form data-form-action="login" class="space-y-4">
          <input name="email" type="text" required placeholder="${t('email_placeholder')}" class="w-full rounded-md border border-gray-600 bg-gray-900 text-white px-4 py-2.5 focus:ring-indigo-500 focus:border-indigo-500">
          <input name="password" type="password" required placeholder="${t('password_placeholder')}" class="w-full rounded-md border border-gray-600 bg-gray-900 text-white px-4 py-2.5 focus:ring-indigo-500 focus:border-indigo-500">
          <button class="w-full py-2.5 mt-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500 transition">${t('login_button')}</button>
        </form>
      </div>
      <div id="signup-form" class="tab-content hidden">
        <form data-form-action="signup" class="space-y-3">
          <input name="first_name" required placeholder="${t('first_name_placeholder')}" class="w-full rounded-md border border-gray-600 bg-gray-900 text-white px-4 py-2.5">
          <input name="last_name" required placeholder="${t('last_name_placeholder')}" class="w-full rounded-md border border-gray-600 bg-gray-900 text-white px-4 py-2.5">
          <input name="username" required placeholder="${t('username_placeholder')}" class="w-full rounded-md border border-gray-600 bg-gray-900 text-white px-4 py-2.5">
          <input name="email" type="email" required placeholder="${t('email_placeholder')}" class="w-full rounded-md border border-gray-600 bg-gray-900 text-white px-4 py-2.5">
          <input name="phone_number" type="tel" placeholder="${t('phone_placeholder')}" class="w-full rounded-md border border-gray-600 bg-gray-900 text-white px-4 py-2.5">
          <input name="password" type="password" required placeholder="${t('password_placeholder')}" class="w-full rounded-md border border-gray-600 bg-gray-900 text-white px-4 py-2.5">
          <input name="confirm_password" type="password" required placeholder="${t('confirm_password_placeholder')}" class="w-full rounded-md border border-gray-600 bg-gray-900 text-white px-4 py-2.5">
          <button class="w-full py-2.5 mt-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500 transition">${t('signup_button')}</button>
        </form>
      </div>
    </div>
    <div class="mt-8 text-center space-x-4 text-sm text-gray-500">
      <button data-action="nav" data-target="about" class="hover:text-indigo-400 transition">${t('about_us')}</button>
      <span>•</span>
      <button data-action="nav" data-target="contact" class="hover:text-indigo-400 transition">${t('contact_us')}</button>
    </div>
  </div>
</div>`;
}

function renderAbout() {
  app.innerHTML = `
<div class="flex min-h-full flex-col bg-gray-900 text-white">
  <div class="w-full max-w-4xl mx-auto p-8 flex-1">
    <div class="mb-8">
      <button data-action="nav" data-target="auth" class="text-indigo-400 hover:text-indigo-300 font-medium">${t('back_to_signin')}</button>
    </div>
    <h1 class="text-4xl font-bold mb-6">${t('about_us')}</h1>
    <div class="prose prose-invert max-w-none space-y-6 text-gray-300">
      <p class="text-lg text-gray-200">
        ${t('tagline')}
      </p>
      <p>
        Whether you’re sharing a ski trip, splitting rent with roommates, or just paying someone back for lunch, 
        Spliitz makes life easier. We store your data securely in the cloud so that you can access it anywhere: 
        on your phone, your tablet, or your desktop.
      </p>
      <h3 class="text-xl font-semibold text-white mt-4">Our Mission</h3>
      <p>
        To reduce the stress and awkwardness that money places on our most important relationships.
      </p>
      <h3 class="text-xl font-semibold text-white mt-4">Key Features</h3>
      <ul class="list-disc pl-5 space-y-2">
        <li><strong>Group Expenses:</strong> Create groups for trips or houses.</li>
        <li><strong>Receipt Scanning:</strong> Use our Gemini-powered AI scanner to itemize receipts instantly.</li>
        <li><strong>Activity Feed:</strong> Keep track of who paid what and when.</li>
        <li><strong>Smart Splitting:</strong> Split equally, by percentages, or by specific amounts.</li>
      </ul>
    </div>
  </div>
</div>`;
}

function renderContact() {
  app.innerHTML = `
<div class="flex min-h-full flex-col bg-gray-900 text-white">
  <div class="w-full max-w-4xl mx-auto p-8 flex-1">
    <div class="mb-8">
      <button data-action="nav" data-target="auth" class="text-indigo-400 hover:text-indigo-300 font-medium">${t('back_to_signin')}</button>
    </div>
    <h1 class="text-4xl font-bold mb-6">${t('contact_us')}</h1>
    <div class="bg-gray-800 rounded-lg p-8 shadow-xl border border-gray-700">
      <p class="text-lg text-gray-300 mb-6">
        Have questions, feedback, or need support? We'd love to hear from you.
      </p>
      
      <div class="space-y-6">
        <div class="flex items-start space-x-4">
          <div class="bg-indigo-900/50 p-3 rounded-lg">
            <span class="text-2xl">📧</span>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-white">Email Support</h3>
            <p class="text-gray-400">support@spliitz.com</p>
            <p class="text-sm text-gray-500 mt-1">We usually reply within 24 hours.</p>
          </div>
        </div>
        
        <div class="flex items-start space-x-4">
          <div class="bg-indigo-900/50 p-3 rounded-lg">
            <span class="text-2xl">🏢</span>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-white">Headquarters</h3>
            <p class="text-gray-400">123 Tech Plaza<br>San Francisco, CA 94105</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;
}

async function renderHome() {
  const user = appState.currentUser;
  if (!user) {
    appState.currentView = 'auth';
    render();
    return;
  }
  const info = await getUserInfo(user.id);
  const monthName = new Date().toLocaleString('default', { month: 'long' });
  const topNav = await renderTopNav('home', info); // Correctly await the async renderTopNav

  app.innerHTML = `
<div class="home-shell">
  ${topNav}
  <main class="home-main">
    <section class="summary-section">
      <div class="summary-card">
        <p class="summary-title">Total spent in ${monthName}</p>
        <h2 id="monthly-total" class="summary-amount">$0.00</h2>
        <p class="summary-sub">Across all your groups</p>
      </div>
    </section>
    
    <!-- Calendar Section -->
    <section class="content-section">
        <div class="card full-span">
            <div class="card-header">
                <h3 class="card-title">Calendar</h3>
            </div>
            <div id="calendar-container" class="card-body p-0">
                Loading calendar...
            </div>
        </div>
    </section>

    <section class="content-section">
      <div class="card pending-card full-span">
        <div class="card-header">
          <h3 class="card-title">Pending Proposals</h3>
        </div>
        <div id="proposals-list" class="card-body">Loading...</div>
      </div>
    </section>
  </main>
</div>`;
  fetchMonthlyTotal();
  fetchPendingProposals();
  renderCalendar();
}

async function renderCalendar() {
  const { fetchExpensesForCalendar } = await import('./fetchers.js');
  const container = document.getElementById('calendar-container');
  if (!container) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // First day of month
  const firstDay = new Date(year, month, 1);
  // Last day of month
  const lastDay = new Date(year, month + 1, 0);

  // Fetch events
  const events = await fetchExpensesForCalendar(firstDay, lastDay);

  // Build days
  const dowOffset = firstDay.getDay(); // 0 (Sun) - 6 (Sat)
  const daysInMonth = lastDay.getDate();

  let html = '<div class="calendar-grid">';

  // Headers
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => {
    html += `<div class="calendar-header-cell">${d}</div>`;
  });

  // Empty cells
  for (let i = 0; i < dowOffset; i++) {
    html += '<div class="calendar-cell empty"></div>';
  }

  // Days
  for (let d = 1; d <= daysInMonth; d++) {
    const currentDate = new Date(year, month, d);
    // Find events for this day
    const dayEvents = events.filter(e => {
      const ed = new Date(e.date); // or use due_date? App uses expense_info.date usually for created?
      // Wait, calendar usually shows Due Dates for expenses, not creation. 
      // In HomeViewModel.swift: `return calendarEvents.filter { ... return date >= today ... }`
      // and `selectedDate` filtering.
      // Let's check `fetchExpensesForCalendar` in fetchers.js that I just wrote. 
      // It selects `due_date, date`.
      // Let's use `due_date` if available, else `date`.
      const relevantDate = e.due_date ? new Date(e.due_date) : new Date(e.date);
      return relevantDate.getDate() === d && relevantDate.getMonth() === month;
    });

    const hasEvent = dayEvents.length > 0;
    const dots = hasEvent ? `<div class="calendar-dots">${dayEvents.map(_ => '<span class="calendar-dot"></span>').join('')}</div>` : '';

    html += `<div class="calendar-cell">
            <span class="calendar-date">${d}</span>
            ${dots}
        </div>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

async function renderFriends() {
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
    <section class="content-section">
      <div class="friends-primary space-y-4">
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
        <div class="card pending-card">
          <div class="card-header">
            <h3 class="card-title">Pending Requests</h3>
          </div>
          <div id="pending-requests-list" class="card-body">No pending requests.</div>
        </div>
      </div>
      <aside class="card friends-card">
        <div class="card-header">
          <h3 class="card-title">My Friends</h3>
        </div>
        <div id="friends-list" class="card-body">Loading...</div>
      </aside>
    </section>
  </main>
</div>`;
  fetchFriends();
  fetchPendingFriendRequests();
}

async function renderProfile() {
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
            <button class="px-6 py-2.5 rounded-full bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition">${t('save')}</button>
            <button type="button" data-action="logout" class="px-6 py-2.5 rounded-full bg-gray-200 text-gray-900 font-semibold hover:bg-gray-300 transition">${t('logout')}</button>
          </div>
          <div class="pt-6 border-t border-gray-100 flex justify-center space-x-4 text-sm text-gray-500">
            <button type="button" data-action="nav" data-target="about" class="hover:text-indigo-600 transition">${t('about_us')}</button>
            <span>•</span>
            <button type="button" data-action="nav" data-target="contact" class="hover:text-indigo-600 transition">${t('contact_us')}</button>
          </div>
        </form>
      </div>
    </section>
  </main>
</div>`;
}

async function renderGroups() {
  const user = appState.currentUser;
  if (!user) {
    appState.currentView = 'auth';
    render();
    return;
  }
  const info = await getUserInfo(user.id);
  app.innerHTML = `
<div class="home-shell">
  ${renderTopNav('groups', info)}
  <main class="home-main groups-page">
    <section class="content-section">
      <div class="card centered-card full-span">
        <div class="card-header" style="flex-direction: column; gap: 0.75rem; text-align: center;">
          <p class="text-sm uppercase tracking-[0.2em] text-indigo-400 font-semibold">My Groups</p>
          <h2 class="text-3xl font-bold text-gray-900">Organize your crews</h2>
          <p class="text-gray-500 max-w-xl mx-auto">Create new groups for every trip, house share, or project. Everything stays in sync across members.</p>
          <button data-action="show-create-group-modal" class="primary-action mt-2">+ New Group</button>
        </div>
      </div>
      <div class="card full-span groups-list-card">
        <div class="card-header">
          <h3 class="card-title">All Groups</h3>
        </div>
        <div id="groups-list" class="card-body groups-grid">Loading...</div>
      </div>
      <div class="card full-span group-invites-card">
        <div class="card-header">
          <h3 class="card-title">Pending Group Invites</h3>
        </div>
        <div id="group-invite-requests" class="card-body invite-requests-body">Loading...</div>
      </div>
    </section>
  </main>
</div>`;
  fetchUserGroups();
  fetchGroupInvites();
}

async function renderGroupDetail() {
  const user = appState.currentUser;
  if (!user) {
    appState.currentView = 'auth';
    render();
    return;
  }
  if (!appState.currentGroup) {
    appState.currentView = 'groups';
    render();
    return;
  }
  const info = await getUserInfo(user.id);
  const { group_title, description } = appState.currentGroup;
  app.innerHTML = `
<div class="home-shell">
  ${renderTopNav('group', info)}
  <main class="home-main">
    <section class="summary-section group-detail-hero">
      <div class="summary-card group-hero-card">
        <h2 class="summary-group_title group-hero-title">${group_title || 'Untitled group'}</h2>
        <p class="summary-desc group-hero-desc">${description || 'No description provided yet.'}</p>
      </div>
      <div class="summary-card group-quick-card">
        <div class="group-members-header">
          <p class="summary-group_title">Members</p>
          <button type="button" class="group-members-add" aria-label="Invite friends to this group" data-action="show-invite-modal">+</button>
        </div>
        <div id="group-members-list" class="group-members-list">
          <p class="text-sm text-gray-500">Loading members...</p>
        </div>
      </div>
    </section>
    <section class="content-section">
      <div class="card full-span">
        <div class="card-header">
          <h3 class="card-title">Activity</h3>
          <div class="card-actions">
            <button type="button" class="primary-action" data-action="show-create-expense-modal">+ Expense</button>
          </div>
        </div>
        <div class="card-body">
          <div class="group-activity">
            <div class="group-activity__column">
              <div class="group-activity__header">Pending for you</div>
              <div id="group-pending-approvals" class="group-activity__list">Looking up pending approvals...</div>
            </div>
            <div class="group-activity__column">
              <div class="group-activity__header">Recent proposals</div>
              <div id="group-expense-list" class="group-activity__list">Loading...</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</div>`;
  await fetchGroupMembers(appState.currentGroup.id);
  fetchGroupPendingExpenses(appState.currentGroup.id);
  fetchGroupExpenseActivity(appState.currentGroup.id);
}

async function renderActivity() {
  const user = appState.currentUser;
  if (!user) {
    appState.currentView = 'auth';
    render();
    return;
  }
  const info = await getUserInfo(user.id);
  app.innerHTML = `
<div class="home-shell">
  ${await renderTopNav('activity', info)}
  <main class="home-main">
    <section class="content-section">
      <div class="card full-span">
        <div class="card-header">
          <h3 class="card-title">Recent Activity</h3>
        </div>
        <div id="activity-list" class="card-body">Loading...</div>
      </div>
    </section>
  </main>
</div>`;

  const activities = await fetchActivities();
  const el = document.getElementById('activity-list');
  if (!el) return;

  if (!activities.length) {
    el.innerHTML = '<p class="text-gray-500">No recent activity.</p>';
    return;
  }

  el.innerHTML = activities.map(a => {
    let icon = '🔔';
    let colorClass = 'bg-gray-100 text-gray-600';
    // Simple mapping based on type or title keywords
    // Types: friend_request, group_invite, expense_proposed, expense_finalized, payment_sent, payment_received
    const type = a.type || '';
    if (type.includes('friend')) { icon = '👥'; colorClass = 'bg-blue-100 text-blue-600'; }
    else if (type.includes('group')) { icon = '🏘️'; colorClass = 'bg-indigo-100 text-indigo-600'; }
    else if (type.includes('expense')) { icon = '💸'; colorClass = 'bg-green-100 text-green-600'; }
    else if (type.includes('payment')) { icon = '💰'; colorClass = 'bg-yellow-100 text-yellow-600'; }

    const date = new Date(a.created_at).toLocaleString();

    return `
      <div class="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition border-b border-gray-100 last:border-0">
        <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg ${colorClass} shrink-0">
            ${icon}
        </div>
        <div>
            <p class="text-gray-900 font-medium">${escapeHtml(a.title)}</p>
            <p class="text-gray-600 text-sm">${escapeHtml(a.message)}</p>
            <p class="text-xs text-gray-400 mt-1">${date}</p>
        </div>
      </div>`;
  }).join('');
}

export function render() {
  setLoading(true);
  app.innerHTML = '';
  switch (appState.currentView) {
    case 'auth':
      renderAuth();
      break;
    case 'home':
      renderHome();
      break;
    case 'friends':
      renderFriends();
      break;
    case 'groups':
      renderGroups();
      break;
    case 'profile':
      renderProfile();
      break;
    case 'group':
      renderGroupDetail();
      break;
    case 'activity':
      renderActivity();
      break;
    case 'activity':
      renderActivity();
      break;
    case 'about':
      renderAbout();
      break;
    case 'contact':
      renderContact();
      break;
    default:
      renderAuth();
  }
  setLoading(false);
}

export async function showCreateGroupModal() {
  const id = 'create-group-modal';
  modalContainer.innerHTML = `
<div id="${id}" class="modal fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
    <form id="create-group-form" data-form-action="create-group" class="bg-gray-800 p-4 rounded-md w-full max-w-md">
        <h3 class="font-medium mb-2 text-white">Create Group</h3>
        <input name="group_title" required placeholder="Title" class="w-full rounded-md border border-gray-600 bg-gray-900 text-white px-3 py-2 mb-2">
        <textarea name="description" placeholder="Description" class="w-full rounded-md border border-gray-600 bg-gray-900 text-white px-3 py-2 mb-2"></textarea>
        <div class="text-right">
            <button data-action="close-modal" data-target="${id}" class="px-3 py-1 bg-gray-700 text-white rounded-md mr-2">Cancel</button>
            <button class="px-3 py-1 bg-indigo-600 text-white rounded-md">Create</button>
        </div>
    </form>
</div>`;
  setTimeout(() => document.getElementById(id).classList.add('flex', 'show'), 10);
}

export function showEditGroupModal({ id, title, description, ownerId }) {
  const modalId = 'edit-group-modal';
  const safeTitle = escapeHtml(title || '');
  const safeDesc = escapeHtml(description || '');
  const isOwner = appState.currentUser?.id && ownerId && appState.currentUser.id === ownerId;
  modalContainer.innerHTML = `
<div id="${modalId}" class="modal fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
  <form data-form-action="update-group" data-group-id="${id}" class="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md space-y-4">
    <h3 class="text-lg font-semibold text-gray-900">Edit Group</h3>
    <label class="block text-sm font-medium text-gray-700">
      Title
      <input name="group_title" required value="${safeTitle}" class="w-full rounded-md border border-gray-300 px-3 py-2 mt-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
    </label>
    <label class="block text-sm font-medium text-gray-700">
      Description
      <textarea name="description" rows="4" class="w-full rounded-md border border-gray-300 px-3 py-2 mt-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">${safeDesc}</textarea>
    </label>
    <div class="flex justify-between items-center gap-3 pt-2">
      <div class="flex gap-3">
        <button type="button" class="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100" data-action="close-modal" data-target="${modalId}">Cancel</button>
        <button class="px-4 py-2 rounded-md bg-indigo-600 text-white font-semibold hover:bg-indigo-500">Save changes</button>
      </div>
      ${isOwner
      ? `<button type="button" class="px-3 py-2 rounded-md bg-red-100 text-red-700 font-semibold hover:bg-red-200" data-action="delete-group" data-group-id="${id}">Delete</button>`
      : ''
    }
    </div>
  </form>
</div>`;
  setTimeout(() => document.getElementById(modalId).classList.add('flex', 'show'), 10);
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

export function showCreateExpenseModal() {
  const modalId = 'create-expense-modal';
  const receiptId = `${modalId}-receipt`;
  const members =
    appState.currentGroupMembers && appState.currentGroupMembers.length
      ? appState.currentGroupMembers
      : [
        {
          user_id: appState.currentUser?.id || 'self',
          first_name: 'You',
          last_name: '',
          email: appState.currentUser?.email || ''
        }
      ];

  const payerOptions = members
    .map((m) => {
      const label =
        `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email || 'Member';
      const suffix = m.user_id === appState.currentUser?.id ? ' (you)' : '';
      return `<option value="${m.user_id}">${escapeHtml(label + suffix)}</option>`;
    })
    .join('');

  const memberRows = members
    .map((m) => {
      const name = escapeHtml(`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email || 'Member');
      return `
        <div class="expense-member-row" data-member-id="${m.user_id}">
          <div>
            <div class="expense-member-name">${name}</div>
          </div>
          <div class="expense-member-inputs" data-member-id="${m.user_id}">
            <div class="expense-percent-box" data-percent-box>
              <input type="number" min="0" max="100" step="1" value="50" class="expense-percent-input" aria-label="Percent for ${name}">
              <span>%</span>
            </div>
            <input type="range" min="0" max="100" step="1" value="50" class="expense-split-slider" data-member-id="${m.user_id}" aria-label="Split for ${name}">
            <div class="expense-share-box">
              <input type="number" step="0.01" min="0" class="expense-amount-input" data-share-for="${m.user_id}" value="0.00" aria-label="Amount for ${name}">
              <span>USD</span>
            </div>
          </div>
        </div>`;
    })
    .join('');

  modalContainer.innerHTML = `
<div id="${modalId}" class="modal fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
  <form id="create-expense-form" data-form-action="create-expense" class="expense-modal">
    <div class="expense-modal__header">
      <div>
        <p class="expense-modal__eyebrow">Group expense</p>
        <h3 class="expense-modal__title">Propose an expense</h3>
      </div>
      <div class="expense-modal__meta">
        <span class="expense-chip expense-chip--pending">Proposal</span>
        <span class="expense-modal__badge">Will notify all members in this split</span>
      </div>
    </div>
    <div class="expense-form-grid">
      <label class="expense-field">
        <span>Title</span>
        <input name="title" required placeholder="Groceries, utilities, tickets..." class="expense-input" />
      </label>
      <label class="expense-field">
        <span>Total amount (USD)</span>
        <input name="total_amount" type="number" step="0.01" min="0" required data-expense-total inputmode="decimal" class="expense-input" placeholder="0.00" />
      </label>
      <label class="expense-field">
        <span>Payer (optional)</span>
        <select name="payer_id" class="expense-input">
          <option value="">Not decided yet</option>
          ${payerOptions}
        </select>
      </label>
      <label class="expense-field">
        <span>Due date</span>
        <input name="due_date" type="date" class="expense-input" />
      </label>
      <label class="expense-field expense-field--full">
        <span>Explanation</span>
        <textarea name="explanation" rows="3" placeholder="Add context so everyone knows what this is." class="expense-input"></textarea>
      </label>
      <label class="expense-field expense-field--full">
        <span>Receipt image (optional)</span>
        <div class="flex gap-2">
            <div class="expense-file flex-1">
              <input id="${receiptId}" type="file" name="receipt_image" accept="image/*" class="expense-file__input">
              <label for="${receiptId}" class="expense-file__button">Upload receipt</label>
              <span class="expense-file__name" data-receipt-label>No file chosen</span>
            </div>
            <button type="button" class="px-3 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-500 transition" data-action="open-receipt-scanner">Scan with AI</button>
        </div>
      </label>
    </div>
        <div class="expense-split">
      <div class="expense-split__header">
        <div>
          <p class="expense-split__title">Split between members</p>
          <p class="expense-split__sub">Drag left for $0, middle for even split, right to have them cover everything.</p>
        </div>
        <div class="expense-split-actions">
          <button type="button" class="expense-split-even" data-action="expense-split-even">Split evenly</button>
        </div>
      </div>
      ${memberRows || '<p class="text-sm text-gray-500">No members available to split.</p>'}
      <div class="expense-split-total">
        <span>Total from splits</span>
        <span id="expense-split-total">$0.00</span>
      </div>
      <p class="expense-split-status" id="expense-split-status">Enter a total amount to split across members.</p>
    </div>
    <div class="expense-modal__footer">
      <button type="button" data-action="close-modal" data-target="${modalId}" class="expense-secondary">Cancel</button>
      <button class="expense-primary">Save expense</button>
    </div>
  </form>
</div>`;
  setTimeout(() => {
    document.getElementById(modalId)?.classList.add('flex', 'show');
  }, 10);
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
            <button data-action="add-friend" data-userid="${userId}" class="px-3 py-1 bg-indigo-600 text-white rounded-md">Add Friend</button>
        </div>
    </div>
</div>`;
  setTimeout(() => document.getElementById(id).classList.add('flex', 'show'), 10);
}


export async function showFriendProfileModal(friendId) {
  setLoading(true);
  const info = await getUserInfo(friendId);
  const { fetchDues } = await import('./fetchers.js');
  const dues = await fetchDues(appState.currentUser.id, friendId);
  setLoading(false);

  // Calculate Net Balance
  // + (Positive): Friend owes User (User is Payer/id_1)
  // - (Negative): User owes Friend (Friend is Payer/id_1)
  let netBalance = 0;
  const currentUserId = appState.currentUser.id;

  dues.forEach(d => {
    const amt = (d.amount || 0) / 100.0;
    if (d.id_1 === currentUserId) {
      netBalance += amt; // Friend owes me
    } else {
      netBalance -= amt; // I owe friend
    }
  });

  const isPositive = netBalance >= 0;
  const colorClass = isPositive ? 'text-green-500' : 'text-red-500';
  const balanceText = isPositive
    ? `${info.first_name || 'Friend'} owes you`
    : `You owe ${info.first_name || 'Friend'}`;

  const absTotal = Math.abs(netBalance);
  const formattedBalance = absTotal < 0.01 ? 'Settled Up' : '$' + absTotal.toFixed(2);
  const balanceDisplay = absTotal < 0.01 ? 'text-gray-500' : colorClass;

  const id = 'friend-profile-' + friendId;

  const historyHtml = dues.length === 0
    ? '<p class="text-gray-500 text-center py-4">No recent history.</p>'
    : dues.map(d => {
      const isOwedToMe = d.id_1 === currentUserId;
      const amt = (d.amount || 0) / 100.0;
      const date = d.expense_info?.date ? new Date(d.expense_info.date).toLocaleDateString() : '';
      return `
        <div class="flex justify-between items-center py-2 border-b border-gray-700">
            <div>
                <div class="font-medium text-white">${escapeHtml(d.expense_info?.title || 'Expense')}</div>
                <div class="text-xs text-gray-400">${isOwedToMe ? `${info.first_name} owes you` : `You owe ${info.first_name}`} • ${date}</div>
                ${!d.received && d.paid
          ? `<div class="text-xs font-bold ${isOwedToMe ? 'text-orange-400' : 'text-blue-400'} mt-1">
                        ${isOwedToMe ? 'Payment Received - Confirm?' : 'Payment Sent'}
                       </div>`
          : ''}
            </div>
            <div class="text-right">
                <div class="${isOwedToMe ? 'text-green-400' : 'text-red-400'} font-bold">
                    ${isOwedToMe ? '+' : '-'}${formatCurrency(amt)}
                </div>
                ${isOwedToMe && d.paid && !d.received
          ? `<button data-action="confirm-receipt" data-expense-id="${d.expense_id}" data-ower-id="${d.id_1}" class="mt-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-500">Confirm</button>`
          : ''}
            </div>
        </div>`;
    }).join('');

  modalContainer.innerHTML = `
<div id="${id}" class="modal fixed inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center">
    <div class="bg-gray-800 p-6 rounded-xl w-full max-w-md shadow-2xl border border-gray-700 max-h-[90vh] flex flex-col">
        <div class="flex flex-col items-center mb-6">
            <div class="w-20 h-20 rounded-full border-2 border-indigo-500 overflow-hidden mb-3">
             ${info.profile_picture
      ? `<img src="${info.profile_picture}" class="w-full h-full object-cover">`
      : `<div class="w-full h-full bg-gray-700 flex items-center justify-center text-xl text-white font-bold">${(info.first_name?.[0] || 'U')}</div>`}
            </div>
            <h3 class="text-xl font-bold text-white">${info.first_name} ${info.last_name}</h3>
            <p class="text-sm text-gray-400">@${info.username || ''}</p>
        </div>
        
        <div class="bg-gray-700/50 rounded-lg p-4 mb-6 text-center">
            <p class="text-3xl font-bold ${balanceDisplay}">${absTotal < 0.01 ? 'Settled Up' : (isPositive ? '+' : '-') + formattedBalance}</p>
            ${absTotal >= 0.01 ? `<p class="text-sm ${balanceDisplay} mt-1">${balanceText}</p>` : ''}
            ${absTotal >= 0.01 && !isPositive
      ? `<button data-action="settle-up" data-friend-id="${friendId}" class="mt-3 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-full hover:bg-green-500 shadow-lg">Settle Up</button>`
      : ''}
        </div>
        
        <div class="flex-1 overflow-y-auto min-h-0 mb-4">
            <h4 class="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Transaction History</h4>
            ${historyHtml}
        </div>

        <div class="mt-auto text-right border-t border-gray-700 pt-4">
            <button data-action="close-modal" data-target="${id}" class="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition">Close</button>
        </div>
    </div>
</div>`;
  setTimeout(() => document.getElementById(id).classList.add('flex', 'show'), 10);
}

export function showDeleteGroupConfirmModal(groupId) {
  const modalId = 'delete-group-confirm';
  modalContainer.innerHTML = `
<div id="${modalId}" class="modal fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center">
  <form data-form-action="confirm-delete-group" data-group-id="${groupId}" class="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md space-y-4">
    <h3 class="text-lg font-semibold text-red-600">Delete group</h3>
    <p class="text-sm text-gray-700">This will permanently delete the group and its related data. This action cannot be undone.</p>
    <div class="flex justify-end gap-3 pt-2">
      <button type="button" class="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100" data-action="close-modal" data-target="${modalId}">Cancel</button>
      <button class="px-4 py-2 rounded-md bg-red-600 text-white font-semibold hover:bg-red-500">Delete</button>
    </div>
  </form>
</div>`;
  setTimeout(() => document.getElementById(modalId)?.classList.add('flex', 'show'), 10);
}

export function showRemoveMemberConfirmModal(memberId, memberName = 'this member', groupId = '') {
  const modalId = `remove-member-${memberId}-confirm`;
  const safeName = escapeHtml(memberName || 'this member');
  modalContainer.innerHTML = `
<div id="${modalId}" class="modal fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center">
  <form data-form-action="confirm-remove-member" data-userid="${memberId}" data-group-id="${groupId}" class="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md space-y-4">
    <h3 class="text-lg font-semibold text-gray-900">Remove member</h3>
    <p class="text-sm text-gray-700">Remove <span class="font-semibold">${safeName}</span> from this group? They will lose access to its activity.</p>
    <div class="flex justify-end gap-3 pt-2">
      <button type="button" class="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100" data-action="close-modal" data-target="${modalId}">Cancel</button>
      <button class="px-4 py-2 rounded-md bg-red-600 text-white font-semibold hover:bg-red-500">Confirm</button>
    </div>
  </form>
</div>`;
  setTimeout(() => document.getElementById(modalId)?.classList.add('flex', 'show'), 10);
}

export async function showExpenseDetailModal(expenseId) {
  const { fetchExpenseById, fetchExpenseSplits } = await import('./fetchers.js');
  const { modalContainer } = await import('./state.js');

  setLoading(true);
  const expense = await fetchExpenseById(expenseId);
  const splits = await fetchExpenseSplits(expenseId);
  setLoading(false);

  if (!expense) {
    alert('Could not load expense details');
    return;
  }

  const modalId = 'expense-detail-modal';
  const dateStr = expense.date ? new Date(expense.date).toLocaleDateString() : '';
  const dueStr = expense.due_date ? new Date(expense.due_date).toLocaleDateString() : 'No due date';
  const isPending = expense.proposal === true;

  const splitsHtml = splits.map(split => {
    const user = split.user_info || {};
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Unknown';
    const amount = (split.individual_amount || 0) / 100;
    const isPayer = user.user_id === expense.payer_id;

    const payerTag = isPayer
      ? `<span class="payer-tag">Payer</span>`
      : '';

    return `<div class="split-row">
            <div class="split-user">
                <div class="split-avatar">${user.first_name?.[0] || 'U'}</div>
                <div class="split-name">
                    ${escapeHtml(name)}
                    ${payerTag}
                </div>
            </div>
            <div class="split-amount">${formatCurrency(amount)}</div>
         </div>`;
  }).join('');

  const receiptHtml = expense.receipt_url
    ? `<div class="expense-receipt">
            <img src="${expense.receipt_url}" alt="Receipt" />
           </div>`
    : '';

  modalContainer.innerHTML = `
<div id="${modalId}" class="modal fixed inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center z-50">
  <div class="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
    <div class="flex justify-between items-start mb-4">
        <div>
            <h3 class="text-xl font-bold text-gray-900">${escapeHtml(expense.title)}</h3>
            <div class="text-sm text-gray-500">${dateStr}</div>
        </div>
        <button data-action="close-modal" data-target="${modalId}" class="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
    </div>
    
    <div class="text-center py-4">
        <div class="text-4xl font-black text-indigo-600">${formatCurrency((expense.total_amount || 0) / 100)}</div>
        <div class="text-sm text-gray-500 mt-1">Total Amount</div>
    </div>
    
    <div class="flex-1 overflow-y-auto">
        ${expense.explanation ? `<div class="bg-gray-50 p-3 rounded-lg text-gray-700 text-sm mb-4">${escapeHtml(expense.explanation)}</div>` : ''}
        
        ${receiptHtml}
        
        <div class="mt-4">
            <h4 class="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Split Breakdown</h4>
            <div class="space-y-2">
                ${splitsHtml}
            </div>
        </div>
    </div>
    
    <div class="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
        <div class="text-xs text-gray-400">Due: ${dueStr}</div>
        ${isPending
      ? `<button class="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-500" data-action="edit-expense" data-expense-id="${expense.expense_id}">Edit Expense</button>`
      : '<span class="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">Finalized</span>'
    }
    </div>
  </div>
</div>`;
  setTimeout(() => document.getElementById(modalId).classList.add('flex', 'show'), 10);
}

export function showReceiptScannerModal() {
  const modalId = 'receipt-scanner-modal';
  modalContainer.innerHTML = `
<div id="${modalId}" class="modal fixed inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center z-50">
  <div class="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
    <div class="flex justify-between items-center mb-4 border-b pb-2">
        <h3 class="text-xl font-semibold text-gray-900">Scan Receipt</h3>
        <button data-action="close-modal" data-target="${modalId}" class="text-gray-500 hover:text-gray-700">&times;</button>
    </div>
    
    <div id="scanner-step-upload" class="flex flex-col items-center justify-center flex-1 py-8 space-y-4">
        <div class="w-full max-w-sm p-6 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-indigo-500 transition cursor-pointer" onclick="document.getElementById('scanner-file').click()">
            <div class="text-4xl mb-2">📸</div>
            <p class="text-gray-600 font-medium">Click to upload or take a photo</p>
            <p class="text-xs text-gray-400 mt-1">Supports JPG, PNG</p>
            <input type="file" id="scanner-file" accept="image/*" class="hidden">
        </div>
        <p class="text-sm text-indigo-500 font-semibold cursor-pointer" onclick="document.getElementById('scanner-file').click()">Select from Library</p>
    </div>

    <div id="scanner-step-loading" class="hidden flex flex-col items-center justify-center flex-1 py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <p class="text-gray-900 font-medium">Analyzing receipt...</p>
        <p class="text-sm text-gray-500">Gemini AI is reading the items</p>
    </div>

    <div id="scanner-step-results" class="hidden flex-col flex-1 min-h-0">
        <p class="text-sm text-gray-600 mb-2">Select items to include in the expense:</p>
        <div id="scanned-items-list" class="flex-1 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-2 mb-4">
            <!-- Items injected here -->
        </div>
        <div class="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
            <span class="font-semibold text-gray-700">Total Selected</span>
            <span id="scanner-total" class="font-bold text-indigo-600 text-lg">$0.00</span>
        </div>
        <div class="mt-4 flex justify-end gap-3">
            <button class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md" onclick="document.getElementById('scanner-step-upload').classList.remove('hidden'); document.getElementById('scanner-step-results').classList.add('hidden');">Rescan</button>
            <button id="scanner-confirm-btn" class="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-500">Use this Total</button>
        </div>
    </div>
  </div>
</div>`;
  setTimeout(() => document.getElementById(modalId)?.classList.add('flex', 'show'), 10);

  // Bind local events for this modal
  const fileInput = document.getElementById('scanner-file');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      document.getElementById('scanner-step-upload').classList.add('hidden');
      document.getElementById('scanner-step-loading').classList.remove('hidden');

      try {
        const { scanReceipt } = await import('./geminiService.js');
        const items = await scanReceipt(file);
        renderScannedItems(items);
      } catch (err) {
        alert("Scanning failed: " + err.message);
        document.getElementById('scanner-step-loading').classList.add('hidden');
        document.getElementById('scanner-step-upload').classList.remove('hidden');
      }
    });
  }

  const confirmBtn = document.getElementById('scanner-confirm-btn');
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      const totalText = document.getElementById('scanner-total').textContent.replace('$', '');
      const totalVal = parseFloat(totalText);
      if (totalVal > 0) {
        // Populate the Create Expense form
        const totalInput = document.querySelector('input[name="total_amount"]');
        if (totalInput) {
          totalInput.value = totalVal.toFixed(2);
          // Trigger change event to update splits
          totalInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        // If explanation empty, maybe add note?
        const expl = document.querySelector('textarea[name="explanation"]');
        if (expl && !expl.value) {
          expl.value = "Scanned receipt items";
        }

        // Close modal
        document.querySelector(`button[data-target="${modalId}"]`).click();
      }
    };
  }
}

function renderScannedItems(items) {
  const list = document.getElementById('scanned-items-list');
  document.getElementById('scanner-step-loading').classList.add('hidden');
  document.getElementById('scanner-step-results').classList.remove('hidden');
  document.getElementById('scanner-step-results').classList.add('flex');

  list.innerHTML = items.map((item, idx) => `
        <label class="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer border-b border-gray-100 last:border-0">
            <div class="flex items-center gap-3">
                <input type="checkbox" class="scanner-item-check w-4 h-4 text-indigo-600 rounded border-gray-300" checked value="${item.p}" data-idx="${idx}">
                <span class="text-sm font-medium text-gray-800">${escapeHtml(item.n)}</span>
            </div>
            <span class="text-sm font-bold text-gray-600">$${item.p.toFixed(2)}</span>
        </label>
    `).join('');

  const updateTotal = () => {
    const checks = document.querySelectorAll('.scanner-item-check:checked');
    let sum = 0;
    checks.forEach(c => sum += parseFloat(c.value));
    document.getElementById('scanner-total').textContent = '$' + sum.toFixed(2);
  };

  updateTotal();
  list.querySelectorAll('input[type="checkbox"]').forEach(c => c.addEventListener('change', updateTotal));
}
