import { db } from './supabaseClient.js';
import { appState } from './state.js';
import { render } from './views.js';
import { registerEventListeners } from './events.js';
import { initRouter, navigate } from './router.js';
import { ensureUserInfoForSession } from './users.js';

/**
 * Bootstraps UI listeners and keeps the app in sync with Supabase auth state.
 */
console.log('%cApp Version: 1.1.2', 'background: #222; color: #bada55; padding: 4px; border-radius: 4px;');

registerEventListeners();
initRouter();

db.auth.onAuthStateChange((event, session) => {
  if (session && session.user) {
    appState.currentUser = session.user;

    // Force clear cache and fetch fresh profile (Tier check)
    appState.userCache.delete(session.user.id);

    // Defer rendering until we know the Tier
    import('./users.js').then(m => {
      m.ensureUserInfoForSession(session.user);
      m.getUserInfo(session.user.id).then(info => {
        // 1. Admin Redirect
        if (info && info.tier == 4) {
          if (!window.location.pathname.startsWith('/admin')) {
            console.log('Tier 4 Detected: Redirecting to Admin...');
            navigate('/admin', { replace: true });
            return;
          }
        }

        // 2. Normal Rendering (only if not redirected)
        if (!window.location.pathname.startsWith('/admin')) {
          const path = window.location.pathname;
          const isAuthPage = !path || path === '/' || path === '/signin' || path === '/auth';
          if (isAuthPage) {
            navigate(`/${session.user.id}/home`, { replace: true });
          } else {
            render();
          }
        } else {
          // We are on admin path, router handles it? 
          // actually router might need to be kicked if we don't call render.
          // But adminRouter is separate.
          // If we are on /admin, we probably should let the router/adminRouter take over.
          // The adminRouter is usually invoked by router.js checking path.
          // If we don't call render(), router might not run?
          // actually initRouter calls render() on route change.
          // But valid point: if we are at /admin refresh, we want to render Admin.
          render(); // This will eventually delegate to adminRouter if mapped, or we need to check router.js
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

    if (!isPublicPage) {
      // If we are on a protected route, go to signin. 
      // Note: initRouter handles the initial 404 redirect.
      // If we are already at /signin, do nothing.
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

