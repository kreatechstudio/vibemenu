import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { traducirErrorEdge } from "@/lib/erroresEdge";
import { payloadReservacion, type BorradorReservacion } from "@/lib/reservaciones";

export type EstadoReservacion = "nueva" | "atendida" | "cancelada";

export type Reservacion = {
  id: string;
  sucursal_id: string;
  nombre: string;
  personas: number;
  fecha_hora: string;
  telefono: string;
  email: string | null;
  nota: string | null;
  estado: EstadoReservacion;
  creada_en: string;
};

const COLS =
  "id, sucursal_id, nombre, personas, fecha_hora, telefono, email, nota, estado, creada_en";

/**
 * Reservaciones del tenant. `retry: false`: sin la migración
 * `vibemenu_migracion_reservaciones.sql` la tabla no existe y reintentar no la crea.
 *
 * Orden DESCENDENTE + `limit`: el tope recorta las filas MÁS VIEJAS (pasadas),
 * nunca las futuras. Con ~90 días de retención una sucursal ocupada rebasaría 500
 * filas y, ordenando ascendente, las reservaciones próximas quedaban fuera del
 * corte y "Próximas" salía vacía. El componente reordena para mostrar.
 */
export function useReservaciones(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["reservaciones", tenantId],
    enabled: Boolean(tenantId),
    retry: false,
    queryFn: async (): Promise<Reservacion[]> => {
      const { data, error } = await supabase
        .from("reservaciones")
        .select(COLS)
        .eq("tenant_id", tenantId!)
        .order("fecha_hora", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Reservacion[];
    },
  });
}

/** Conteo de `nueva` para el badge de la pestaña. Silencioso si no aplica. */
export function useReservacionesNuevas(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["reservaciones-nuevas", tenantId],
    enabled: Boolean(tenantId),
    retry: false,
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("reservaciones")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .eq("estado", "nueva");
      if (error) return 0;
      return count ?? 0;
    },
  });
}

export function useCambiarEstadoReservacion(tenantId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: EstadoReservacion }) => {
      const { error } = await supabase.from("reservaciones").update({ estado }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["reservaciones", tenantId] });
      void qc.invalidateQueries({ queryKey: ["reservaciones-nuevas", tenantId] });
    },
  });
}

/**
 * Envío del formulario público. Invoca la edge function `crear-reservacion`.
 * El comensal no tiene sesión: supabase-js manda la anon key sola, que es lo
 * que la función espera.
 */
export function useCrearReservacion(sucursalId: string) {
  return useMutation({
    mutationFn: async ({
      borrador,
      token,
    }: {
      borrador: BorradorReservacion;
      token: string | null;
    }) => {
      const { data, error } = await supabase.functions.invoke("crear-reservacion", {
        body: payloadReservacion(borrador, sucursalId, token),
      });
      if (error) throw new Error(await traducirErrorEdge(error));
      return data as { ok: true; aviso?: string };
    },
  });
}
