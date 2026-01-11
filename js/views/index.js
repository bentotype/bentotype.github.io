import { appState, app } from '../state.js';
import { setLoading } from '../ui.js';

// Import Renderers
import { renderAuth, renderAbout, renderContact, renderPrivacyPolicy, renderTerms } from './auth.js?v=1.1.27';
import { renderHome } from './home.js';
import { renderFriends } from './friends.js?v=1.1.27';
import { renderGroups, renderGroupDetail, renderReceiptUploadPage, renderExpenseInfoPage } from './groups.js?v=1.1.27';
import { renderProfile } from './profile.js';

// Export everything from sub-modules
export * from './components.js';
export * from './auth.js?v=1.1.27';
export * from './home.js';
export * from './friends.js?v=1.1.27';
export * from './groups.js?v=1.1.27';
export * from './profile.js';

// Main Render Function
export function render() {
    setLoading(true);
    // app.innerHTML = ''; // Removed to prevent flash of unstyled content
    switch (appState.currentView) {
        case 'auth':
            renderAuth();
            break;
        case 'home':
            renderHome();
            break;
        case 'friends':
            renderFriends();
            break;
        case 'groups':
            renderGroups();
            break;
        case 'profile':
            renderProfile();
            break;
        case 'group':
            renderGroupDetail();
            break;
        case 'receipt':
            renderReceiptUploadPage();
            break;
        case 'expense':
            renderExpenseInfoPage();
            break;
        case 'about':
            renderAbout();
            break;
        case 'contact':
            renderContact();
            break;
        case 'privacypolicy':
            renderPrivacyPolicy();
            break;
        case 'terms':
            renderTerms();
            break;
        default:
            renderAuth();
    }
    setLoading(false);
}
