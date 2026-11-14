// Configuración pública de Supabase. La clave publishable/anon puede estar en el navegador.
// Nunca coloques aquí la clave service_role.
const env = import.meta.env;
export const SUPABASE_URL = env.VITE_SUPABASE_URL || "https://cceumxdjqqjhjdblwdkw.supabase.co";
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || "sb_publishable_e2zsKQPX_nwhZyoXX25IOA__rrExR5x";
export const USE_LOCAL_DEMO = env.VITE_USE_LOCAL_DEMO === "true" || !SUPABASE_URL || !SUPABASE_ANON_KEY;
