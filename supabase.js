const SUPABASE_URL = "https://hordrkpxsfcnvfjbzzdb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_v37mf5VzanKEEKB9RbxMMA_qvZQaUFZ";

window.supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
); 