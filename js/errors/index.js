
/**
 * Maps raw error messages to user-friendly notifications.
 */

export function handleAuthError(error) {
    if (!error) return 'An unknown error occurred.';

    // Normalize the error message
    const msg = (error.message || error.error_description || String(error)).trim();

    // Known Supabase/Auth errors
    if (/Error confirming user/i.test(msg)) {
        return "We couldn't verify your account. The link may have expired or is invalid. Please try signing up again or request a new code.";
    }
    if (/User already registered/i.test(msg)) {
        return "This email is already currently in use. Please sign in instead.";
    }
    if (/Invalid login credentials/i.test(msg)) {
        return "Incorrect email or password. Please try again.";
    }
    if (/Password should contain/i.test(msg)) {
        return "Password must contain at least one uppercase letter, one lowercase letter, and one symbol.";
    }
    if (/Rate limit exceeded/i.test(msg)) {
        return "Too many attempts. Please try again later.";
    }

    // Fallback for generic messages
    return msg;
}

export function handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    const userMessage = handleAuthError(error);
    // We can add toast notifications here later if needed
    // showToast(userMessage, 'error');
    return userMessage;
}
