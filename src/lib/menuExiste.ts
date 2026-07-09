import { supabase } from "@/lib/supabase";

/**
 * ¿Existe este menú? Se resuelve en el `loader` de la ruta, no en el componente.
 *
 * Si se consulta desde el componente, el SSR devuelve el esqueleto de carga con
 * HTTP 200 y el mensaje de "no existe" solo aparece tras hidratar. Google indexaría
 * esas páginas como válidas. Desde el loader podemos lanzar notFound() y responder
 * un 404 de verdad.
 *
 * `tenants` y `sucursales` tienen select público en RLS, así que esto funciona
 * sin sesión, también desde el servidor.
 */
export async function menuExiste(slug: string, sucursalSlug?: string): Promise<boolean> {
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!tenant) return false;
  if (!sucursalSlug) return true;

  const { data: sucursal, error: errorSucursal } = await supabase
    .from("sucursales")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("slug", sucursalSlug)
    .eq("activa", true)
    .maybeSingle();

  if (errorSucursal) throw errorSucursal;
  return Boolean(sucursal);
}
