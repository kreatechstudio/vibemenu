import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { TablesUpdate } from "@/types/database";

/**
 * Actualiza el tenant. Solo columnas cosmeticas: `plan_id`, `estado`,
 * `stripe_customer_id` y `trial_iniciado_at` estan revocadas a nivel de columna
 * para el rol `authenticated`, asi que un intento de tocarlas falla en Postgres.
 *
 * `trg_tenants_20_formatos` valida `formatos_desbloqueados` y `formato_activo`
 * contra el pool y el limite del plan.
 */
export function useActualizarTenant(tenantId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (cambios: TablesUpdate<"tenants">) => {
      const { error } = await supabase.from("tenants").update(cambios).eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tenant-actual"] });
      void qc.invalidateQueries({ queryKey: ["menu-publico"] });
    },
  });
}
