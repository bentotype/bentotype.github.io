import { db } from './supabaseClient.js';
import { appState } from './state.js';
import { render } from './views.js?v=1.1.22';
import { registerEventListeners } from './events.js';
import { initRouter, navigate } from './router.js';
import { ensureUserInfoForSession } from './users.js';
import { setLoading } from './ui.js';

/**
 * Bootstraps UI listeners and keeps the app in sync with Supabase auth state.
 */
console.log('%cApp Version: 1.1.23 - Theme: Dark Emerald', 'background: rgba(0, 0, 0, 0.8); color: #10b981; padding: 4px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.2); backdrop-filter: blur(4px);');

registerEventListeners();

// Initial Load State
let isRouterInitialized = false;
setLoading(true);

db.auth.onAuthStateChange((event, session) => {
  if (session && session.user) {
    appState.currentUser = session.user;

    // Force clear cache and fetch fresh profile (Tier check)
    appState.userCache.delete(session.user.id);

    // Defer rendering until we know the Tier
    import('./users.js').then(m => {
      m.ensureUserInfoForSession(session.user);
      m.getUserInfo(session.user.id).then(info => {

        // Router Init (Optimized to prevent FOUC)
        if (!isRouterInitialized) {
          initRouter();
          isRouterInitialized = true;
          // The router will trigger a render/navigate, so we can unset loading here or let router handle it
          setLoading(false);
        }

        // 1. Admin Redirect
        if (info && info.tier == 4) {
          if (!window.location.pathname.startsWith('/admin')) {
            console.log('Tier 4 Detected: Redirecting to Admin...');
            navigate('/admin', { replace: true });
            return;
          }
        }

        // 2. Normal Rendering (only if not redirected and not on admin)
        if (!window.location.pathname.startsWith('/admin')) {
          const path = window.location.pathname;
          // If we are already on a valid path managed by router, do nothing, router handles it.
          // But if we need to force a render refresh on auth change:
          const isAuthPage = !path || path === '/' || path === '/signin' || path === '/auth';
          if (isAuthPage) {
            navigate(`/${session.user.id}/home`, { replace: true });
          } else {
            render();
          }
        }
      });
    });
  } else {
    // If not logged in:
    const path = window.location.pathname;
    const isPublicPage = path === '/about' || path === '/contact';

    appState.currentUser = null;
    appState.userCache.clear();
    appState.pendingProfilePicturePath = '';
    appState.pendingProfilePictureUrl = '';

    if (!isRouterInitialized) {
      initRouter();
      isRouterInitialized = true;
      setLoading(false);
    }

    if (!isPublicPage) {
      // If we are on a protected route, go to signin. 
      // initRouter handles the initial 404 redirect logic first, so we just ensure we are safe here.
      if (path !== '/signin' && path !== '/' && path !== '/auth') {
        navigate('/signin', { replace: true });
      } else {
        render();
      }
    } else {
      render(); // render public page if we're on one
    }
  }
});

