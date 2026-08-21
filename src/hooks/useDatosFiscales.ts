import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { DatosFiscales, TablesInsert } from "@/types/database";

/**
 * Datos fiscales del tenant receptor. RLS (`datos_fiscales_owner`) solo deja
 * leer o escribir al owner — ni encargados, ni el menú público. Puede no
 * haber fila todavía (negocio que no ha llenado nada), de ahí el maybeSingle.
 */
export function useDatosFiscales(tenantId: string | undefined, esOwner: boolean) {
  return useQuery({
    queryKey: ["datos-fiscales", tenantId],
    enabled: Boolean(tenantId) && esOwner,
    queryFn: async (): Promise<DatosFiscales | null> => {
      const { data, error } = await supabase
        .from("datos_fiscales")
        .select("*")
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useGuardarDatosFiscales(tenantId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (cambios: Omit<TablesInsert<"datos_fiscales">, "tenant_id">) => {
      const { error } = await supabase
        .from("datos_fiscales")
        .upsert({ ...cambios, tenant_id: tenantId! }, { onConflict: "tenant_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["datos-fiscales", tenantId] });
    },
  });
}
