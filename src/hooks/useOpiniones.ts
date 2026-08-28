import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type Opinion = {
  id: number;
  sucursal_id: string | null;
  sentimiento: "regular" | "mal";
  comentario: string | null;
  resuelto: boolean;
  creado_at: string;
};

/**
 * Opiniones privadas del tenant, más reciente primero. `retry: false`: sin la
 * migración `vibemenu_migracion_embudo_resenas.sql` la tabla no existe y
 * reintentar no la crea.
 */
export function useOpiniones(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["opiniones", tenantId],
    enabled: Boolean(tenantId),
    retry: false,
    queryFn: async (): Promise<Opinion[]> => {
      const { data, error } = await supabase
        .from("feedback_privado")
        .select("id, sucursal_id, sentimiento, comentario, resuelto, creado_at")
        .eq("tenant_id", tenantId!)
        .order("creado_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Opinion[];
    },
  });
}

export function useMarcarOpinionResuelta(tenantId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    // La policy feedback_update_miembros + grant update(resuelto) solo dejan
    // tocar esta columna.
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("feedback_privado")
        .update({ resuelto: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["opiniones", tenantId] }),
  });
}
