import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { NombrePlan, Plan } from "@/types/database";

const ORDEN: NombrePlan[] = ["free", "basic", "pro", "enterprise"];

/**
 * Catalogo de planes. `planes` tiene RLS con select publico, asi que se lee sin
 * sesion — tambien desde el servidor, que es como lo usa el loader de /precios.
 *
 * Nunca hardcodear precios ni limites: si cambian en la base, la UI los sigue.
 * El precio de lista solo aplica a nuevas altas y upgrades — los tenants ya
 * suscritos conservan su precio congelado en `suscripciones`.
 */
export async function obtenerPlanes(): Promise<Plan[]> {
  const { data, error } = await supabase.from("planes").select("*");
  if (error) throw error;
  return [...data].sort(
    (a, b) => ORDEN.indexOf(a.nombre as NombrePlan) - ORDEN.indexOf(b.nombre as NombrePlan),
  );
}

/**
 * `iniciales` viene del loader de la ruta. Sin eso, el SSR renderiza el esqueleto
 * y la tabla comparativa no existe en el HTML: invisible para un buscador.
 */
export function usePlanes(iniciales?: Plan[]) {
  return useQuery({
    queryKey: ["planes"],
    staleTime: 5 * 60_000,
    initialData: iniciales,
    queryFn: obtenerPlanes,
  });
}
