const SUPABASE_URL = 'https://kircuqgxdrqfnnjpvoji.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_AODwY5l6R3O0CKYRVff92w_tJKpevIW';

if (typeof supabase === 'undefined') {
    console.error("Supabase library not loaded. Ensure the CDN script is included.");
    if (typeof window !== 'undefined') {
        window.onerror?.('Supabase library not loaded', window.location.href, 0, 0, new Error('Supabase not defined'));
    }
}
const { createClient } = supabase;
export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { SUPABASE_URL, SUPABASE_ANON_KEY };
