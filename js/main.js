import { db } from './supabaseClient.js';
import { appState } from './state.js';
import { render } from './views.js';
import { registerEventListeners } from './events.js';
import { initRouter, navigate } from './router.js';

/**
 * Bootstraps UI listeners and keeps the app in sync with Supabase auth state.
 */
registerEventListeners();
initRouter();

db.auth.onAuthStateChange((event, session) => {
  if (session && session.user) {
    appState.currentUser = session.user;
    // If we are on the auth page or root, go to user dashboard
    // If we are on the auth page or root, go to user dashboard
    const hash = window.location.hash;
    const isAuthPage = !hash || hash === '#/' || hash === '#/signin' || hash === '#/auth';

    if (isAuthPage) {
      navigate(`/${session.user.id}/home`, { replace: true });
    } else {
      // Just re-render to ensure state is correct
      render();
    }
  } else {
    // If not logged in:
    const hash = window.location.hash;
    const isPublicPage = hash === '#/about' || hash === '#/contact';

    appState.currentUser = null;
    appState.userCache.clear();
    appState.pendingProfilePicturePath = '';
    appState.pendingProfilePictureUrl = '';

    if (!isPublicPage) {
      navigate('/signin', { replace: true });
    } else {
      render(); // render public page if we're on one
    }
  }
});

