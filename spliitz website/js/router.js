import { appState } from './state.js';
import { render } from './views.js';

/**
 * Hash Router for GitHub Pages compatibility.
 * Uses /#/path instead of /path.
 */

const AUTH_PATH = '/signin';

export function initRouter() {
    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('load', handleRouteChange);
    handleRouteChange();
}

export function navigate(path, { replace = false } = {}) {
    // Ensure path starts with /
    let target = path.startsWith('/') ? path : `/${path}`;

    // In hash routing, we just set the hash. 
    // replacement isn't strictly 'replaceState' in the same way, but 
    // we can use location.replace for that effect if needed.
    const fullHash = `#${target}`;

    if (window.location.hash === fullHash) {
        handleRouteChange();
        return;
    }

    if (replace) {
        const url = new URL(window.location.href);
        url.hash = fullHash;
        window.location.replace(url.toString());
    } else {
        window.location.hash = fullHash;
    }
}

function getRoutePath() {
    let hash = window.location.hash.slice(1); // remove '#'
    if (!hash) return '/';
    // If we have a query string in the hash (e.g. #/path?foo=bar), strip or handle it.
    // For now, simple path normalization:
    const qIndex = hash.indexOf('?');
    if (qIndex !== -1) hash = hash.slice(0, qIndex);

    if (!hash.startsWith('/')) hash = `/${hash}`;
    if (hash.length > 1) hash = hash.replace(/\/+$/, '');
    return hash;
}

function handleRouteChange() {
    const path = getRoutePath();

    if (path === '/' || path === '') {
        if (appState.currentUser) {
            navigate(`/${appState.currentUser.id}/home`, { replace: true });
        } else {
            navigate(AUTH_PATH, { replace: true });
        }
        return;
    }

    if (path === '/auth') {
        navigate(AUTH_PATH, { replace: true });
        return;
    }

    if (path === '/about') {
        appState.currentView = 'about';
        render();
        window.scrollTo(0, 0);
        return;
    }

    if (path === '/contact') {
        appState.currentView = 'contact';
        render();
        window.scrollTo(0, 0);
        return;
    }

    if (path === AUTH_PATH) {
        if (appState.currentUser) {
            navigate(`/${appState.currentUser.id}/home`, { replace: true });
            return;
        }
        appState.currentView = 'auth';
        render();
        window.scrollTo(0, 0);
        return;
    }

    if (!appState.currentUser) {
        navigate(AUTH_PATH, { replace: true });
        return;
    }

    // Route format: /:userId/:page/:optionalId
    const parts = path.split('/').filter(Boolean);

    if (parts.length >= 2) {
        const userId = parts[0];
        const page = parts[1];

        if (userId !== appState.currentUser.id) {
            const rest = parts.slice(1).join('/');
            navigate(`/${appState.currentUser.id}/${rest}`, { replace: true });
            return;
        }

        if (page === 'home') {
            appState.currentView = 'home';
            render();
            return;
        }
        if (page === 'friends') {
            appState.currentView = 'friends';
            render();
            return;
        }
        if (page === 'profile') {
            appState.currentView = 'profile';
            render();
            return;
        }
        if (page === 'groups') {
            if (parts[2]) {
                // /:userId/groups/:groupId
                const groupId = parts[2];
                if (!appState.currentGroup || appState.currentGroup.id !== groupId) {
                    appState.currentGroup = { id: groupId };
                }
                appState.currentView = 'group';
                render();
                return;
            }
            appState.currentView = 'groups';
            render();
            return;
        }
        if (page === 'receipt') {
            const groupId = parts[2];
            if (groupId) {
                if (!appState.currentGroup || appState.currentGroup.id !== groupId) {
                    appState.currentGroup = { id: groupId };
                }
                appState.currentView = 'receipt';
                render();
                return;
            }
            appState.currentView = 'groups';
            render();
            return;
        }
        if (page === 'expense') {
            const groupId = parts[2];
            if (groupId) {
                if (!appState.currentGroup || appState.currentGroup.id !== groupId) {
                    appState.currentGroup = { id: groupId };
                }
                appState.currentView = 'expense';
                render();
                return;
            }
            appState.currentView = 'groups';
            render();
            return;
        }
    }

    // Default fallback
    console.log('Unknown route:', path);
    if (appState.currentUser) {
        navigate(`/${appState.currentUser.id}/home`, { replace: true });
    } else {
        navigate(AUTH_PATH, { replace: true });
    }
}
