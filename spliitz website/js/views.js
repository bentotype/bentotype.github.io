import { appState, app, modalContainer, resetPendingReceiptState } from './state.js';
import { setLoading } from './ui.js';
import { getUserInfo, getFriendsForUser, UserTier, canJoinGroups, canUseCamera } from './users.js';
import { formatCurrency } from './format.js';
import {
  fetchMonthlyTotal,
  fetchUserGroups,
  fetchPendingProposals,
  fetchFriends,
  fetchPendingFriendRequests,
  fetchGroupInvites,
  fetchGroupMembers,
  fetchGroupPendingExpenses,
  fetchGroupExpenseActivity
} from './fetchers.js';

const escapeHtml = (value = '') =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
function renderTopNav(activeTab, info) {
  const navItems = [
    { id: 'home', label: 'Home', action: 'nav' },
    { id: 'friends', label: 'Friends', action: 'nav' },
    { id: 'groups', label: 'Groups', action: 'nav' }
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
      ({ id, label, action }) =>
        `<button class="app-nav__item${activeTab === id ? ' is-active' : ''}" data-action="${action}" data-target="${id}">${label}</button>`
    )
    .join('');

  return `
<header class="app-header">
  <div class="app-header__left">
    <div class="app-logo">Spliitz</div>
  </div>
  <nav class="app-nav">
    ${navMarkup}
  </nav>
  <button class="app-avatar" data-action="nav" data-target="profile" aria-label="Open profile">${avatarContent}</button>
</header>`;
}

function renderAuth() {
  app.innerHTML = `
<div class="home-shell auth-page">
  <header class="app-header auth-header">
    <div class="app-header__left">
      <div class="app-logo">Spliitz</div>
    </div>
  </header>
  <main class="home-main">
    <section class="auth-layout">
      <div class="auth-intro">
        <div class="summary-card auth-summary">
          <p class="summary-title">Welcome back</p>
          <h2 class="summary-amount">Keep every bill in sync.</h2>
          <p class="summary-desc">Track shared expenses, approve splits, and store receipts for every group.</p>
          <div class="auth-highlights">
            <div class="auth-highlight">
              <span class="auth-highlight__dot"></span>
              <div>
                <div class="auth-highlight__title">One dashboard</div>
                <div class="auth-highlight__desc">See pending proposals, totals, and activity at a glance.</div>
              </div>
            </div>
            <div class="auth-highlight">
              <span class="auth-highlight__dot"></span>
              <div>
                <div class="auth-highlight__title">Smart splits</div>
                <div class="auth-highlight__desc">Auto-calculate shares and keep approvals tidy.</div>
              </div>
            </div>
            <div class="auth-highlight">
              <span class="auth-highlight__dot"></span>
              <div>
                <div class="auth-highlight__title">Trusted profiles</div>
                <div class="auth-highlight__desc">Find friends by email or username and stay connected.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="card auth-card">
        <div class="auth-card__header">
          <p class="auth-card__eyebrow">Account</p>
          <h2 class="auth-card__title">Sign in to Spliitz</h2>
        </div>
        <div class="auth-tabs">
          <button data-action="show-tab" data-target="login-form" class="tab-button auth-tab border-b-2 border-indigo-400 text-indigo-400 font-semibold">Sign In</button>
          <button data-action="show-tab" data-target="signup-form" class="tab-button auth-tab text-gray-400">Sign Up</button>
        </div>
        <div class="auth-oauth">
          <button type="button" class="auth-oauth__button auth-oauth__button--apple" data-action="apple-login">Continue with Apple</button>
          <button type="button" class="auth-oauth__button auth-oauth__button--google" data-action="google-login">Continue with Google</button>
        </div>
        <div id="login-form" class="tab-content">
          <form data-form-action="login" class="auth-form">
            <label class="auth-field">
              <span>Email address</span>
              <input name="email" type="email" autocomplete="email" required placeholder="you@email.com" class="auth-input">
            </label>
            <label class="auth-field">
              <span>Password</span>
              <input name="password" type="password" autocomplete="current-password" required placeholder="Enter your password" class="auth-input">
            </label>
            <button class="auth-submit">Sign In</button>
          </form>
          <p class="auth-helper">New here? Use Sign Up to create your account.</p>
        </div>
        <div id="signup-form" class="tab-content hidden">
          <form data-form-action="signup" class="auth-form">
            <div class="auth-form__row">
              <label class="auth-field">
                <span>First name</span>
                <input name="first_name" required placeholder="First name" class="auth-input">
              </label>
              <label class="auth-field">
                <span>Last name</span>
                <input name="last_name" required placeholder="Last name" class="auth-input">
              </label>
            </div>
            <label class="auth-field">
              <span>Username (optional)</span>
              <input name="username" placeholder="Username" class="auth-input">
            </label>
            <label class="auth-field">
              <span>Email address</span>
              <input name="email" type="email" autocomplete="email" required placeholder="you@email.com" class="auth-input">
            </label>
            <label class="auth-field">
              <span>Phone number (optional)</span>
              <input name="phone_number" type="tel" autocomplete="tel" placeholder="(555) 123-4567" class="auth-input">
            </label>
            <div class="auth-form__row">
              <label class="auth-field">
                <span>Password</span>
                <input name="password" type="password" autocomplete="new-password" required placeholder="Create a password" class="auth-input">
              </label>
              <label class="auth-field">
                <span>Confirm password</span>
                <input name="confirm_password" type="password" autocomplete="new-password" required placeholder="Confirm password" class="auth-input">
              </label>
            </div>
            <button class="auth-submit">Create Account</button>
          </form>
          <p class="auth-helper">Already have an account? Switch back to Sign In.</p>
        </div>
      </div>
    </section>
  </main>
</div>
    <div class="mt-12 py-8 text-center space-x-8 text-base font-medium text-gray-600">
      <button data-action="nav" data-target="about" class="hover:text-indigo-600 transition">About Us</button>
      <span class="text-gray-400">•</span>
      <button data-action="nav" data-target="contact" class="hover:text-indigo-600 transition">Contact Us</button>
    </div>`;
}


function renderAbout() {
  app.innerHTML = `
<div class="home-shell">
  <header class="app-header auth-header">
    <div class="app-header__left">
      <div class="app-logo cursor-pointer" onclick="window.location.href='/'">Spliitz</div>
    </div>
  </header>
  <main class="home-main">
    <section class="max-w-4xl mx-auto w-full p-4 md:p-8">
      <div class="mb-8">
        <button data-action="nav" data-target="auth" class="text-indigo-600 hover:text-indigo-500 font-medium text-lg flex items-center gap-2">
          <span>←</span> Back
        </button>
      </div>
      
      <div class="space-y-12">
        <!-- Hero -->
        <section>
          <p class="text-indigo-600 font-bold tracking-wide uppercase mb-2">About Spliitz</p>
          <h1 class="text-4xl md:text-5xl font-bold mb-6 leading-tight text-gray-900">Splitting expenses shouldn't be a splitting headache.</h1>
          <p class="text-xl text-gray-600 max-w-2xl leading-relaxed">
            We built Spliitz because we were tired of the "who paid for what?" dance. 
            Whether it's a ski trip, a shared apartment, or Saturday night dinner, we keep the math invisible so the fun stays visible.
          </p>
        </section>

        <!-- Mission -->
        <section class="grid md:grid-cols-2 gap-8 items-center bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
          <div>
            <h3 class="text-2xl font-bold mb-4 text-gray-900">Our Mission</h3>
            <p class="text-gray-600 leading-relaxed">
              To reduce the stress and awkwardness that money places on our most important relationships. 
              We believe you shouldn't have to choose between being generous and being fair.
            </p>
          </div>
          <div class="bg-indigo-50 h-48 rounded-xl flex items-center justify-center text-6xl">
              🤝
          </div>
        </section>

        <!-- Why Us -->
        <section>
          <h3 class="text-3xl font-bold mb-8 text-gray-900">Why Choose Spliitz?</h3>
          <div class="grid md:grid-cols-3 gap-6">
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-2xl mb-4 text-indigo-600">⚡️</div>
              <h4 class="text-lg font-bold mb-2 text-gray-900">Real-time Sync</h4>
              <p class="text-gray-600">Changes update instantly across everyone's devices. No more "did you add that yet?"</p>
            </div>
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-2xl mb-4 text-indigo-600">🧠</div>
              <h4 class="text-lg font-bold mb-2 text-gray-900">Smart Math</h4>
              <p class="text-gray-600">We optimize debts so you pay back the right people with the fewest transfers.</p>
            </div>
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
               <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-2xl mb-4 text-indigo-600">🔒</div>
              <h4 class="text-lg font-bold mb-2 text-gray-900">Secure Cloud</h4>
              <p class="text-gray-600">Your data is encrypted and stored safely. Access it from anywhere, anytime.</p>
            </div>
          </div>
        </section>
      </div>
    </section>
  </main>
</div>`;
}

function renderContact() {
  app.innerHTML = `
<div class="home-shell">
  <header class="app-header auth-header">
    <div class="app-header__left">
      <div class="app-logo cursor-pointer" onclick="window.location.href='/'">Spliitz</div>
    </div>
  </header>
  <main class="home-main">
    <section class="max-w-4xl mx-auto w-full p-4 md:p-8">
      <div class="mb-8">
        <button data-action="nav" data-target="auth" class="text-indigo-600 hover:text-indigo-500 font-medium text-lg flex items-center gap-2">
          <span>←</span> Back
        </button>
      </div>
      
      <div class="grid md:grid-cols-2 gap-12 items-start">
        <!-- Contact Info -->
        <div class="space-y-8">
          <div>
            <p class="text-indigo-600 font-bold tracking-wide uppercase mb-2">Get in touch</p>
            <h1 class="text-4xl font-bold mb-6 text-gray-900">Contact Us</h1>
            <p class="text-lg text-gray-600 leading-relaxed">
              Have questions, feedback, or need support? We'd love to hear from you. 
              Fill out the form or send us an email directly.
            </p>
          </div>

          <div class="space-y-6">
            <div class="flex items-start space-x-4 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <div class="bg-indigo-50 p-3 rounded-lg text-2xl">📧</div>
              <div>
                <h3 class="text-lg font-bold text-gray-900">Email Support</h3>
                <p class="text-gray-500 mb-1 text-sm">For general inquiries and technical help:</p>
                <a href="mailto:support@spliitz.com" class="text-indigo-600 hover:text-indigo-500 font-medium">support@spliitz.com</a>
              </div>
            </div>
            
             <div class="flex items-start space-x-4 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <div class="bg-indigo-50 p-3 rounded-lg text-2xl">💼</div>
              <div>
                <h3 class="text-lg font-bold text-gray-900">Partnerships</h3>
                <p class="text-gray-500 mb-1 text-sm">Interested in working with us?</p>
                <a href="mailto:partners@spliitz.com" class="text-indigo-600 hover:text-indigo-500 font-medium">partners@spliitz.com</a>
              </div>
            </div>
          </div>
        </div>

        <!-- Contact Form -->
        <div class="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
          <h3 class="text-xl font-bold mb-6 text-gray-900">Send a message</h3>
          <form class="space-y-5" onsubmit="event.preventDefault(); alert('Thanks! We will get back to you soon.');">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1">Your Name</label>
              <input type="text" class="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition" placeholder="John Doe">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
              <input type="email" class="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition" placeholder="john@example.com">
            </div>
             <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1">Subject</label>
               <select class="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition">
                  <option>General Inquiry</option>
                  <option>Technical Support</option>
                  <option>Feature Request</option>
                  <option>Other</option>
               </select>
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1">Message</label>
              <textarea rows="4" class="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition" placeholder="How can we help?"></textarea>
            </div>
            <button class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-indigo-500/20">
              Send Message
            </button>
          </form>
        </div>
      </div>
    </section>
  </main>
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
  app.innerHTML = `
<div class="home-shell">
  ${renderTopNav('home', info)}
  <main class="home-main">
    <section class="summary-section">
      <div class="summary-card">
        <p class="summary-title">Total spent in ${monthName}</p>
        <h2 id="monthly-total" class="summary-amount">$0.00</h2>
        <p class="summary-sub">Across all your groups</p>
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
          <button data-action="${canJoinGroups(info.tier || 1) ? 'show-create-group-modal' : 'show-tier-alert-groups'}" class="primary-action mt-2">+ New Group</button>
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
            <button type="button" class="primary-action" data-action="start-expense" data-group-id="${appState.currentGroup?.id || ''}">+ Expense</button>
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

function buildExpenseMemberMarkup() {
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
      const label = `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email || 'Member';
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

  return { payerOptions, memberRows };
}

async function renderReceiptUploadPage() {
  const user = appState.currentUser;
  if (!user) {
    appState.currentView = 'auth';
    render();
    return;
  }

  const info = await getUserInfo(user.id);
  const groupId = appState.currentGroup?.id || '';
  if (appState.pendingReceiptGroupId && appState.pendingReceiptGroupId !== groupId) {
    resetPendingReceiptState();
  }
  if (groupId && !appState.pendingReceiptGroupId) {
    appState.pendingReceiptGroupId = groupId;
  }

  const items = appState.pendingReceiptItems || [];
  const hasPreview = Boolean(appState.pendingReceiptPreviewUrl);
  const statusText = hasPreview
    ? items.length
      ? `Found ${items.length} item${items.length === 1 ? '' : 's'}. Review before continuing.`
      : 'Scanning receipt...'
    : 'Upload a receipt to scan.';
  const itemsMarkup = items.length
    ? items
      .map((item) => {
        const typeClass = item.type ? ` receipt-scan__item--${item.type}` : '';
        return `
          <li class="receipt-scan__item${typeClass}">
            <span>${escapeHtml(item.name || 'Item')}</span>
            <span>${formatCurrency(item.price || 0)}</span>
          </li>`;
      })
      .join('')
    : '<li class="receipt-scan__empty">No items yet. Upload and scan a receipt.</li>';

  const totalValue = Number.isFinite(appState.pendingReceiptTotal) ? appState.pendingReceiptTotal : null;
  const totalLabel = totalValue ? `Detected total: ${formatCurrency(totalValue)}` : '';
  const fileLabel = appState.pendingReceiptFile?.name || 'No file chosen';

  app.innerHTML = `
<div class="home-shell">
  ${renderTopNav('groups', info)}
  <main class="home-main receipt-upload-page">
    <section class="receipt-upload-header">
      <div>
        <p class="receipt-upload__eyebrow">New expense</p>
        <h2 class="receipt-upload__title">Upload a receipt</h2>
        <p class="receipt-upload__subtitle">Scan locally to extract line items before entering expense details.</p>
      </div>
    </section>
    <form id="receipt-upload-form" class="receipt-upload-grid">
      <section class="card receipt-upload-card" data-receipt-dropzone>
        <label class="expense-field">
          <span>Receipt image</span>
          <div class="expense-file receipt-upload-file">
            <input id="receipt-upload-input" type="file" name="receipt_image" accept="image/png,image/jpeg" class="expense-file__input">
            <label for="receipt-upload-input" class="expense-file__button">Upload receipt</label>
          <p class="expense-file__name" data-receipt-label>${escapeHtml(fileLabel)}</p>
          </div>
        </label>
        
        ${!canUseCamera(info.tier || 1) ? `
        <div style="position:absolute; inset:0; background:rgba(255,255,255,0.85); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:1.5rem; text-align:center; border-radius:0.75rem; z-index:20;">
            <div>
                 <div style="font-size:2.5rem; margin-bottom:0.5rem;">🔒</div>
                <h3 class="text-lg font-bold text-gray-900">Upgrade Required</h3>
                <p class="text-gray-600 mt-1 mb-4">Receipt scanning is available on paid plans.</p>
                <button type="button" class="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition" onclick="alert('Please upgrade your plan to use this feature.')">Upgrade Plan</button>
            </div>
        </div>
        ` : ''}

        <div class="receipt-preview">
          <img class="receipt-preview__image${hasPreview ? '' : ' hidden'}" data-receipt-preview src="${hasPreview ? appState.pendingReceiptPreviewUrl : ''}" alt="Receipt preview">
          <div class="receipt-preview__placeholder${hasPreview ? ' hidden' : ''}" data-receipt-placeholder>Drag & drop or paste a receipt here, or use Upload receipt.</div>
        </div>
        <p class="receipt-scan__status" data-receipt-status>${statusText}</p>
        <div class="receipt-scan__total" data-receipt-total${totalValue ? '' : ' hidden'}>${totalLabel}</div>
      </section>
      <aside class="card receipt-items-card">
        <div class="receipt-items-card__header">
          <h3 class="card-title">Scanned items</h3>
          <p class="receipt-items-card__subtitle">Review the list before you continue.</p>
        </div>
        <ul class="receipt-scan__list" data-receipt-items>
          ${itemsMarkup}
        </ul>
      </aside>
    </form>
    <div class="receipt-upload-footer">
      <button type="button" class="expense-primary" data-action="manual-expense-input" data-group-id="${groupId}">Manual Input</button>
    </div>
  </main>
</div>`;

  if (groupId) {
    fetchGroupMembers(groupId);
  }
}

async function renderExpenseInfoPage() {
  const user = appState.currentUser;
  if (!user) {
    appState.currentView = 'auth';
    render();
    return;
  }
  const info = await getUserInfo(user.id);
  const groupId = appState.currentGroup?.id || '';
  const totalPrefill = Number.isFinite(appState.pendingReceiptTotal) ? appState.pendingReceiptTotal.toFixed(2) : '';
  if (groupId) {
    await fetchGroupMembers(groupId);
  }
  const { payerOptions, memberRows } = buildExpenseMemberMarkup();

  app.innerHTML = `
<div class="home-shell">
  ${renderTopNav('groups', info)}
  <main class="home-main expense-info-page">
    <section class="receipt-upload-header">
      <div>
        <p class="receipt-upload__eyebrow">Expense details</p>
        <h2 class="receipt-upload__title">Enter expense info</h2>
        <p class="receipt-upload__subtitle">Fill in the details for this expense.</p>
      </div>
      <button type="button" class="back-groups-btn" data-action="back-to-group" data-group-id="${groupId}">Back to group</button>
    </section>
    <form id="create-expense-form" data-form-action="create-expense" class="expense-modal expense-info-form">
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
          <input name="total_amount" type="number" step="0.01" min="0" required data-expense-total inputmode="decimal" class="expense-input" placeholder="0.00" value="${totalPrefill}" />
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
        <button type="button" class="expense-secondary" data-action="back-to-group" data-group-id="${groupId}">Cancel</button>
        <button class="expense-primary">Save expense</button>
      </div>
    </form>
  </main>
</div>`;

  setTimeout(() => {
    const totalInput = document.querySelector('[data-expense-total]');
    totalInput?.dispatchEvent(new Event('input', { bubbles: true }));
  }, 20);
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
    case 'receipt':
      renderReceiptUploadPage();
      break;
    case 'expense':
      renderExpenseInfoPage();
      break;
    case 'expense':
      renderExpenseInfoPage();
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
  const { payerOptions, memberRows } = buildExpenseMemberMarkup();

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
        <div class="expense-file">
          <input id="${receiptId}" type="file" name="receipt_image" accept="image/png,image/jpeg" class="expense-file__input">
          <label for="${receiptId}" class="expense-file__button">Upload receipt</label>
          <span class="expense-file__name" data-receipt-label>No file chosen</span>
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
