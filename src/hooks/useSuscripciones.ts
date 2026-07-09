import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Plan, Suscripcion } from "@/types/database";

export type SuscripcionConPlan = Suscripcion & { plan: Pick<Plan, "nombre"> | null };

/**
 * Historial completo de suscripciones del tenant, la mas reciente primero.
 *
 * Una fila por periodo de plan, no una fila mutable. El indice unico parcial
 * `uniq_suscripcion_activa_por_tenant` garantiza una sola fila 'activa'.
 *
 * La RLS solo deja leer esto al owner (`suscripciones_select_owner`), y NADIE
 * puede escribir desde el frontend: solo la Edge Function de webhooks de Stripe,
 * que usa el service_role_key.
 */
export function useHistorialSuscripciones(tenantId: string | undefined, esOwner: boolean) {
  return useQuery({
    queryKey: ["suscripciones", tenantId],
    enabled: Boolean(tenantId) && esOwner,
    queryFn: async (): Promise<SuscripcionConPlan[]> => {
      const { data, error } = await supabase
        .from("suscripciones")
        .select("*, plan:planes(nombre)")
        .eq("tenant_id", tenantId!)
        .order("fecha_inicio", { ascending: false });
      if (error) throw error;
      return data as SuscripcionConPlan[];
    },
  });
}

/** La única fila 'activa', si existe. En trial no hay ninguna. */
export const suscripcionActiva = (historial: SuscripcionConPlan[] | undefined) =>
  historial?.find((s) => s.estado === "activa") ?? null;
