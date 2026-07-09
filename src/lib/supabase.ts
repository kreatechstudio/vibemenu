import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.local.",
  );
}

/**
 * Cliente publico. Usa la llave publishable y SIEMPRE pasa por RLS.
 * El service_role_key jamas vive aqui: solo en la Edge Function de webhooks de Stripe.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
