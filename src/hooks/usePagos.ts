import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Pago } from "@/types/database";

/**
 * Recibos del tenant, alimentados por el evento `invoice.paid` del webhook de
 * Stripe. Igual que `useHistorialSuscripciones`: la RLS solo deja leer esto al
 * owner (`pagos_select_owner`), nadie escribe desde el frontend.
 */
export function usePagos(tenantId: string | undefined, esOwner: boolean) {
  return useQuery({
    queryKey: ["pagos", tenantId],
    enabled: Boolean(tenantId) && esOwner,
    queryFn: async (): Promise<Pago[]> => {
      const { data, error } = await supabase
        .from("pagos")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("fecha_pago", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
