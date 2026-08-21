import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { validarFormatoDominio, type ErrorDominio } from "@/lib/dominio";

export type EstadoDominio =
  | { estado: "vacio" }
  | { estado: "invalido"; motivo: ErrorDominio }
  | { estado: "verificando" }
  | { estado: "disponible" }
  | { estado: "ocupado" };

function useDebounce<T>(valor: T, ms: number): T {
  const [diferido, setDiferido] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setDiferido(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return diferido;
}

/**
 * Disponibilidad del dominio personalizado, en vivo. Espejo de useSlugDisponible:
 * es cortesia de UI, la garantia real es el unique de tenants.dominio_personalizado.
 */
export function useDominioDisponible(dominioCrudo: string): EstadoDominio {
  const dominio = useDebounce(dominioCrudo.trim(), 350);
  const formato = dominio.length > 0 ? validarFormatoDominio(dominio) : null;
  const habilitado = dominio.length > 0 && formato === null;

  const { data, isFetching } = useQuery({
    queryKey: ["dominio-disponible", dominio],
    enabled: habilitado,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id")
        .eq("dominio_personalizado", dominio)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
  });

  if (dominioCrudo.trim().length === 0) return { estado: "vacio" };
  if (formato) return { estado: "invalido", motivo: formato };
  if (isFetching || dominio !== dominioCrudo.trim() || data === undefined) {
    return { estado: "verificando" };
  }
  return data ? { estado: "ocupado" } : { estado: "disponible" };
}
