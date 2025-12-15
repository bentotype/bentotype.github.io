const SUPABASE_URL = 'https://kircuqgxdrqfnnjpvoji.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_AODwY5l6R3O0CKYRVff92w_tJKpevIW';

const { createClient } = supabase;
export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { SUPABASE_URL, SUPABASE_ANON_KEY };
