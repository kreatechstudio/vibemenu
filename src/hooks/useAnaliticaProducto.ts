import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useProductos } from "@/hooks/useCarta";
import {
  ignoradosDesde,
  porHoraDe,
  rankingDesde,
  serieDesde,
  UMBRAL_IGNORADO,
  type FilaInteraccion,
  type FilaRanking,
} from "@/lib/analitica";

/** Tope de filas que traemos de una sola vez; más allá el panel avisa que está truncado. */
const TOPE_FILAS = 50_000;

export type ResumenAnalitica = {
  ranking: FilaRanking[];
  porHora: (productoId: string) => { hora: number; vistas: number; agregados: number }[];
  ignorados: { productoId: string; nombre: string; vistas: number }[];
  serie: { dia: string; vistas: number; agregados: number }[];
  /** true si el select topó `TOPE_FILAS` y las cifras son parciales. */
  truncado: boolean;
};

/** `YYYY-MM-DD` de `base` desplazada `dias` días, con getters LOCALES (no UTC). */
function ymd(base: Date, desplazamientoDias = 0): string {
  const d = new Date(base);
  d.setDate(d.getDate() + desplazamientoDias);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function useAnaliticaProducto(
  tenantId: string | undefined,
  opts: { dias: 7 | 30 | 90; sucursalId: string | "todas" | "general" },
  habilitado: boolean,
) {
  const productosQ = useProductos(tenantId);

  const query = useQuery({
    queryKey: ["analitica-producto", tenantId, opts.dias, opts.sucursalId],
    enabled: Boolean(tenantId) && productosQ.isSuccess && habilitado,
    retry: false,
    staleTime: 60_000,
    queryFn: async (): Promise<ResumenAnalitica> => {
      // Un solo "ahora" para que el límite inferior del query y la serie coincidan
      // aunque crucemos la medianoche local a mitad del render.
      const ahora = new Date();

      let q = supabase
        .from("interacciones_producto")
        .select("sucursal_id, producto_id, dia, hora, vistas, agregados")
        .eq("tenant_id", tenantId!)
        .gte("dia", ymd(ahora, -(opts.dias - 1)))
        .order("dia", { ascending: true })
        .limit(TOPE_FILAS);
      if (opts.sucursalId === "general") q = q.is("sucursal_id", null);
      else if (opts.sucursalId !== "todas") q = q.eq("sucursal_id", opts.sucursalId);

      const { data, error } = await q;
      if (error) throw error;
      const filas = (data ?? []) as FilaInteraccion[];
      const truncado = filas.length >= TOPE_FILAS;

      const productos = productosQ.data ?? [];
      const nombres = new Map(productos.map((p) => [p.id, p.nombre]));
      const activos = productos
        .filter((p) => p.activo)
        .map((p) => ({ id: p.id, nombre: p.nombre }));

      return {
        ranking: rankingDesde(filas, nombres),
        porHora: (id: string) => porHoraDe(filas, id),
        ignorados: ignoradosDesde(filas, activos, UMBRAL_IGNORADO),
        serie: serieDesde(filas, opts.dias, ahora),
        truncado,
      };
    },
  });

  // El panel jamás debe quedar en blanco: `useProductos` puede estar pending (sin
  // skeleton propio) o error (falla tras 3 reintentos y este hook ni se entera,
  // porque su query está `enabled:false`). Fusionamos ambos estados.
  return {
    ...query,
    isLoading: query.isLoading || (Boolean(tenantId) && productosQ.isPending),
    isError: query.isError || productosQ.isError,
  };
}
