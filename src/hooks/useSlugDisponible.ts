import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { validarFormatoSlug, type ErrorSlug } from "@/lib/slug";

export type EstadoSlug =
  | { estado: "vacio" }
  | { estado: "invalido"; motivo: ErrorSlug }
  | { estado: "verificando" }
  | { estado: "disponible" }
  | { estado: "ocupado" }
  | { estado: "reservado" };

function useDebounce<T>(valor: T, ms: number): T {
  const [diferido, setDiferido] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setDiferido(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return diferido;
}

/**
 * Disponibilidad del slug, en vivo.
 *
 * Dos consultas: `slugs_reservados` (palabras bloqueadas como admin, api, login)
 * y `tenants` (slug ya tomado). Ambas tienen select publico en RLS, asi que
 * funcionan sin sesion, que es justo lo que necesita el formulario de registro.
 *
 * Esto es cortesia de UI. La garantia real es el unique de tenants.slug: si dos
 * personas registran el mismo slug a la vez, la insercion falla con 23505 y
 * traducirError() lo convierte en "Ese nombre ya está en uso".
 */
export function useSlugDisponible(slugCrudo: string): EstadoSlug {
  const slug = useDebounce(slugCrudo.trim(), 350);
  const formato = slug.length > 0 ? validarFormatoSlug(slug) : null;
  const habilitado = slug.length > 0 && formato === null;

  const { data, isFetching } = useQuery({
    queryKey: ["slug-disponible", slug],
    enabled: habilitado,
    staleTime: 30_000,
    queryFn: async () => {
      const [reservado, existente] = await Promise.all([
        supabase.from("slugs_reservados").select("slug").eq("slug", slug).maybeSingle(),
        supabase.from("tenants").select("slug").eq("slug", slug).maybeSingle(),
      ]);
      if (reservado.error) throw reservado.error;
      if (existente.error) throw existente.error;
      return { reservado: Boolean(reservado.data), ocupado: Boolean(existente.data) };
    },
  });

  if (slugCrudo.trim().length === 0) return { estado: "vacio" };
  if (formato) return { estado: "invalido", motivo: formato };
  // slugCrudo ya cambio pero el debounce no alcanzo, o la consulta sigue en vuelo
  if (isFetching || slug !== slugCrudo.trim() || !data) return { estado: "verificando" };
  if (data.reservado) return { estado: "reservado" };
  if (data.ocupado) return { estado: "ocupado" };
  return { estado: "disponible" };
}
