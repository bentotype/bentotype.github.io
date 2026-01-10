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
  pendingProfilePictureUrl: '',
  pendingReceiptFile: null,
  pendingReceiptPreviewUrl: '',
  pendingReceiptItems: [],
  pendingReceiptTotal: null,
  pendingReceiptGroupId: null,
  expenseItems: [],
  isItemizedMode: false
};

export const app = document.getElementById('app');
export const modalContainer = document.getElementById('modal-container');
export const loadingOverlay = document.getElementById('loading-overlay');

export function resetPendingReceiptState() {
  if (appState.pendingReceiptPreviewUrl) {
    try {
      URL.revokeObjectURL(appState.pendingReceiptPreviewUrl);
    } catch (err) {
      console.warn('Failed to revoke receipt preview URL', err);
    }
  }
  appState.pendingReceiptFile = null;
  appState.pendingReceiptPreviewUrl = '';
  appState.pendingReceiptItems = [];
  appState.pendingReceiptTotal = null;
  appState.pendingReceiptGroupId = null;
}
