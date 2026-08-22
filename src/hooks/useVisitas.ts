import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Visitas al menu publico (migracion 007).
 *
 * No hay una fila por visita: `visitas_menu` guarda un contador por
 * (tenant, sucursal, dia) y la RPC `registrar_visita` lo incrementa. El comensal
 * no tiene sesion y no puede escribir en la tabla; la funcion es SECURITY DEFINER.
 *
 * "Visita" = una sesion del navegador que abrio ese menu. Recargar la pagina no
 * cuenta otra vez. Es la definicion honesta: si el comensal recarga tres veces
 * mientras decide, el dueno no vio tres clientes.
 */

const DIAS_HISTORIA = 30;

export type ResumenVisitas = {
  hoy: number;
  ultimos7: number;
  ultimos30: number;
  /** `null` como clave = el menú general, sin sucursal en la ruta. */
  porSucursal: Map<string | null, number>;
  /** Serie diaria de los últimos 30 días, del más viejo al más nuevo. */
  serie: { dia: string; visitas: number }[];
};

/** `YYYY-MM-DD` en la zona del navegador, que es la del dueño mirando su panel. */
function fechaLocal(desplazamientoDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + desplazamientoDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useVisitas(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["visitas", tenantId],
    enabled: Boolean(tenantId),
    staleTime: 60_000,
    // Sin la migración 007 la tabla no existe. Reintentar no la va a crear.
    retry: false,
    queryFn: async (): Promise<ResumenVisitas> => {
      const desde = fechaLocal(-(DIAS_HISTORIA - 1));

      const { data, error } = await supabase
        .from("visitas_menu")
        .select("sucursal_id, dia, visitas")
        .eq("tenant_id", tenantId!)
        .gte("dia", desde)
        .order("dia");
      if (error) throw error;

      const hoy = fechaLocal();
      const hace7 = fechaLocal(-6);

      const resumen: ResumenVisitas = {
        hoy: 0,
        ultimos7: 0,
        ultimos30: 0,
        porSucursal: new Map(),
        serie: [],
      };

      const porDia = new Map<string, number>();

      for (const fila of data) {
        resumen.ultimos30 += fila.visitas;
        if (fila.dia >= hace7) resumen.ultimos7 += fila.visitas;
        if (fila.dia === hoy) resumen.hoy += fila.visitas;

        const antes = resumen.porSucursal.get(fila.sucursal_id) ?? 0;
        resumen.porSucursal.set(fila.sucursal_id, antes + fila.visitas);

        porDia.set(fila.dia, (porDia.get(fila.dia) ?? 0) + fila.visitas);
      }

      resumen.serie = [...porDia.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dia, visitas]) => ({ dia, visitas }));

      return resumen;
    },
  });
}

/** Una visita por sesión del navegador y por menú. Recargar no cuenta de nuevo. */
function yaContada(clave: string): boolean {
  try {
    if (sessionStorage.getItem(clave)) return true;
    sessionStorage.setItem(clave, "1");
    return false;
  } catch {
    // Safari en privado lanza al escribir. Se cuenta y ya.
    return false;
  }
}

/**
 * Registra la visita desde el navegador, nunca desde el loader del servidor: ahi
 * contariamos los prefetch del router y cada rastreador que pase.
 *
 * Falla en silencio. Un menu publico no se rompe porque una metrica no cuadre.
 */
export function useRegistrarVisita(tenantId: string | undefined, sucursalId: string | null) {
  useEffect(() => {
    if (!tenantId) return;
    if (yaContada(`vm:visita:${tenantId}:${sucursalId ?? "general"}`)) return;

    void supabase.rpc("registrar_visita", {
      p_tenant_id: tenantId,
      p_sucursal_id: sucursalId ?? undefined,
    });
  }, [tenantId, sucursalId]);
}
