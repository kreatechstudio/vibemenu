import { supabase } from "@/lib/supabase";
import type { TablesInsert } from "@/types/database";

/**
 * Alta del negocio.
 *
 * El tenant NO se puede insertar sin sesion: la policy `tenants_insert_autenticado`
 * exige auth.uid(), y el trigger `trg_crear_owner` inserta la fila de owner con ese
 * mismo uid. Ademas el trigger `trg_tenants_10_plan_default` lo pone en el plan free.
 *
 * Si Supabase Auth tiene la confirmacion de correo ACTIVADA (que es el default),
 * signUp no devuelve sesion. En ese caso no se puede crear el tenant todavia:
 * se guarda el borrador y se crea en el primer login confirmado.
 *
 * La configuracion de Auth se toca desde el Dashboard de Supabase, nunca desde aqui.
 */

export type TenantPendiente = Pick<TablesInsert<"tenants">, "nombre_negocio" | "slug" | "giro">;

const CLAVE = "vm:tenant-pendiente";

export function guardarTenantPendiente(t: TenantPendiente) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CLAVE, JSON.stringify(t));
}

export function leerTenantPendiente(): TenantPendiente | null {
  if (typeof window === "undefined") return null;
  const crudo = window.localStorage.getItem(CLAVE);
  if (!crudo) return null;
  try {
    return JSON.parse(crudo) as TenantPendiente;
  } catch {
    window.localStorage.removeItem(CLAVE);
    return null;
  }
}

export function limpiarTenantPendiente() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CLAVE);
}

export async function crearTenant(t: TenantPendiente) {
  const { error } = await supabase.from("tenants").insert(t);
  if (error) throw error;
  limpiarTenantPendiente();
}

/**
 * Se llama tras un login exitoso. Si el usuario todavia no tiene tenant
 * (porque se registro con confirmacion de correo pendiente), lo crea desde
 * el borrador. Devuelve true si acaba de crearlo.
 */
export async function asegurarTenantDelUsuario(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("tenant_usuarios")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    limpiarTenantPendiente();
    return false;
  }

  const pendiente = leerTenantPendiente();
  if (!pendiente) return false;

  await crearTenant(pendiente);
  return true;
}
