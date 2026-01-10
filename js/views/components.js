import { appState } from '../state.js';
import { UserTier } from '../users.js';

export const escapeHtml = (value = '') =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

export function renderTopNav(activeTab, info) {
    const navItems = [
        { id: 'home', label: 'Home', action: 'nav' },
        { id: 'friends', label: 'Friends', action: 'nav' },
        { id: 'groups', label: 'Groups', action: 'nav' }
    ];

    // Show Admin Tab if Tier 4
    if (info?.tier == UserTier.ADMIN) {
        // Admin-only mode: Clear standard tabs
        navItems.length = 0;
    }

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
                `<button id="nav-item-${id}" class="app-nav__item${activeTab === id ? ' is-active' : ''}" data-action="${action}" data-target="${id}">${label}</button>`
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
