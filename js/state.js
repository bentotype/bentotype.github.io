/**
 * Shared app state + key DOM references used across modules.
 */
export const appState = {
  currentUser: null,
  currentView: 'auth',
  currentGroup: null,
  currentGroupMembers: [],
  currentGroupMemberIds: [],
  userCache: new Map(),
  pendingProfilePicturePath: '',
  pendingProfilePictureUrl: ''
};

export const app = document.getElementById('app');
export const modalContainer = document.getElementById('modal-container');
export const loadingOverlay = document.getElementById('loading-overlay');
