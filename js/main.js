import { db } from './supabaseClient.js';
import { appState } from './state.js';
import { render } from './views.js';
import { registerEventListeners } from './events.js';
import { initRouter, navigate } from './router.js';
import { ensureUserInfoForSession } from './users.js';

/**
 * Bootstraps UI listeners and keeps the app in sync with Supabase auth state.
 */
console.log('%cApp Version: 1.1.1', 'background: #222; color: #bada55; padding: 4px; border-radius: 4px;');

registerEventListeners();
initRouter();

db.auth.onAuthStateChange((event, session) => {
  if (session && session.user) {
    appState.currentUser = session.user;

    // Force clear cache and fetch fresh profile (Tier check)
    appState.userCache.delete(session.user.id);
    import('./users.js').then(m => {
      m.ensureUserInfoForSession(session.user);
      m.getUserInfo(session.user.id).then(info => {
        // Auto-redirect Tier 4 (Admin) to Admin Panel
        if (info && info.tier == 4) {
          const path = window.location.pathname;
          if (!path.startsWith('/admin')) {
            console.log('Tier 4 Detected: Redirecting to Admin...');
            navigate('/admin', { replace: true });
            return;
          }
        }
      });
    });

    // If we are on the auth page or root, go to user dashboard
    const path = window.location.pathname;
    const isAuthPage = !path || path === '/' || path === '/signin' || path === '/auth';

    // We want to redirect to home if on auth pages.
    // If we are on a public page (about/contact) we can stay there (or redirect? Usually stay).

    if (isAuthPage) {
      navigate(`/${session.user.id}/home`, { replace: true });
    } else {
      // Just re-render to ensure state is correct
      render();
    }
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

