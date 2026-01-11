import { appState } from './state.js';
import { render } from './views.js';

/**
 * Valid history-based router for Clean URLs.
 * Works with 404.html hack on GitHub Pages.
 */

const AUTH_PATH = '/signin';

export function initRouter() {
    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('load', () => {
        // CF-like 404 hack: Check if we were redirected from 404.html
        // e.g. /?redirect=/about
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get('redirect');
        if (redirect) {
            // Restore the clean URL
            window.history.replaceState({}, '', redirect);
        }
        handleRouteChange();
    });
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
    // Ensure index.html doesn't mess up routing
    if (next === '/index.html') return '/';
    return next;
}

function handleRouteChange() {
    const path = normalizePath(window.location.pathname);

    // Check for Admin Route
    if (path.startsWith('/admin')) {
        import('./adminRouter.js').then(module => {
            module.handleAdminRoute(path, appState.currentUser);
        });
        return;
    } else {
        // If we are navigating AWAY from admin, remove the admin body class
        document.body.classList.remove('admin-body');
    }

    if (path === '/' || path === '') {
        if (appState.currentUser) {
            navigate(`/${appState.currentUser.id}/home`, { replace: true });
        } else {
            navigate(AUTH_PATH, { replace: true });
        }
        return;
    }

    // Explicit Home -> Auth/Dashboard
    if (path === '/home') {
        if (appState.currentUser) {
            navigate(`/${appState.currentUser.id}/home`, { replace: true });
        } else {
            // If user wants /home but isn't logged in, usually we show landing/signin
            appState.currentView = 'auth';
            render();
        }
        return;
    }

    if (path === '/auth' || path === '/signin') {
        if (appState.currentUser) {
            navigate(`/${appState.currentUser.id}/home`, { replace: true });
            return;
        }
        appState.currentView = 'auth';
        render();
        window.scrollTo(0, 0);
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

    if (path === '/privacypolicy') {
        appState.currentView = 'privacypolicy';
        render();
        window.scrollTo(0, 0);
        return;
    }

    if (path === '/terms') {
        appState.currentView = 'terms';
        render();
        window.scrollTo(0, 0);
        return;
    }

    if (!appState.currentUser) {
        // Public routes handled above. Everything else requires auth.
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
