import { appState } from './state.js';
import { render } from './views.js';

/**
 * Simple History Router
 */

const AUTH_PATH = '/signin';

export function initRouter() {
    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('load', handleRouteChange);
    handleRouteChange();
}

export function navigate(path, { replace = false } = {}) {
    const target = normalizePath(path);
    const current = normalizePath(window.location.pathname);
    if (target === current) {
        handleRouteChange();
        return;
    }
    if (replace) {
        window.history.replaceState({}, '', target);
    } else {
        window.history.pushState({}, '', target);
    }
    handleRouteChange();
}

function normalizePath(path) {
    if (!path) return '/';
    let next = String(path).trim();
    const hashIndex = next.indexOf('#');
    if (hashIndex !== -1) next = next.slice(0, hashIndex);
    const queryIndex = next.indexOf('?');
    if (queryIndex !== -1) next = next.slice(0, queryIndex);
    if (!next.startsWith('/')) next = `/${next}`;
    if (next.length > 1) next = next.replace(/\/+$/, '');
    if (next === '/index.html') return '/';
    return next;
}

function getRoutePath() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#/')) {
        const legacyPath = normalizePath(hash.slice(1));
        window.history.replaceState({}, '', legacyPath);
        return legacyPath;
    }
    return normalizePath(window.location.pathname);
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
        return;
    }

    if (path === '/contact') {
        appState.currentView = 'contact';
        render();
        return;
    }

    if (path === AUTH_PATH) {
        if (appState.currentUser) {
            navigate(`/${appState.currentUser.id}/home`, { replace: true });
            return;
        }
        appState.currentView = 'auth';
        render();
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
