import type { User } from "@supabase/supabase-js";

/**
 * Google guarda nombre y foto en distintas llaves segun el momento: Supabase
 * normaliza algunos proveedores a `full_name`/`avatar_url`, pero el dato crudo
 * de Google trae `name`/`picture`. Se cae al correo si no hay ninguno (usuarios
 * de email/password, que no traen nada de esto).
 */
export function nombreDeUsuario(
  user: Pick<User, "user_metadata" | "email"> | null | undefined,
): string {
  const meta = user?.user_metadata ?? {};
  return (meta.full_name as string) || (meta.name as string) || user?.email || "";
}

export function avatarDeUsuario(
  user: Pick<User, "user_metadata"> | null | undefined,
): string | null {
  const meta = user?.user_metadata ?? {};
  return (meta.avatar_url as string) || (meta.picture as string) || null;
}
