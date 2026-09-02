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

export type ResumenAnalitica = {
  ranking: FilaRanking[];
  porHora: (productoId: string) => { hora: number; vistas: number; agregados: number }[];
  ignorados: { productoId: string; nombre: string; vistas: number }[];
  serie: { dia: string; vistas: number; agregados: number }[];
};

function fechaLocal(desplazamientoDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + desplazamientoDias);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function useAnaliticaProducto(
  tenantId: string | undefined,
  opts: { dias: 7 | 30 | 90; sucursalId: string | "todas" },
) {
  const productosQ = useProductos(tenantId);

  return useQuery({
    queryKey: ["analitica-producto", tenantId, opts.dias, opts.sucursalId],
    enabled: Boolean(tenantId) && productosQ.isSuccess,
    retry: false,
    staleTime: 60_000,
    queryFn: async (): Promise<ResumenAnalitica> => {
      let q = supabase
        .from("interacciones_producto")
        .select("sucursal_id, producto_id, dia, hora, vistas, agregados")
        .eq("tenant_id", tenantId!)
        .gte("dia", fechaLocal(-(opts.dias - 1)));
      if (opts.sucursalId !== "todas") q = q.eq("sucursal_id", opts.sucursalId);

      const { data, error } = await q;
      if (error) throw error;
      const filas = (data ?? []) as FilaInteraccion[];

      const productos = productosQ.data ?? [];
      const nombres = new Map(productos.map((p) => [p.id, p.nombre]));
      const activos = productos
        .filter((p) => p.activo)
        .map((p) => ({ id: p.id, nombre: p.nombre }));

      return {
        ranking: rankingDesde(filas, nombres),
        porHora: (id: string) => porHoraDe(filas, id),
        ignorados: ignoradosDesde(filas, activos, UMBRAL_IGNORADO),
        serie: serieDesde(filas, opts.dias, new Date()),
      };
    },
  });
}
