import { db } from './supabaseClient.js';
import { appState } from './state.js';
import { render } from './views.js';
import { registerEventListeners } from './events.js';

/**
 * Bootstraps UI listeners and keeps the app in sync with Supabase auth state.
 */
registerEventListeners();

db.auth.onAuthStateChange((event, session) => {
  if (session && session.user) {
    appState.currentUser = session.user;
    if (appState.currentView === 'auth') appState.currentView = 'home';
  } else {
    appState.currentUser = null;
    appState.currentView = 'auth';
    appState.userCache.clear();
    appState.pendingProfilePicturePath = '';
    appState.pendingProfilePictureUrl = '';
  }
  render();
});

db.auth.getSession().then(({ data }) => {
  if (data?.session?.user) {
    appState.currentUser = data.session.user;
    if (appState.currentView === 'auth') appState.currentView = 'home';
  }
  render();
});
     
