import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { RolUsuario } from "@/types/database";

export type MiembroEquipo = {
  user_id: string;
  email: string;
  rol: RolUsuario;
  created_at: string;
};

/**
 * Equipo del tenant. Pasa por la funcion `equipo_del_tenant`, que es SECURITY
 * DEFINER: `auth.users` no es legible desde el navegador y no debe serlo.
 * La funcion valida internamente que quien llama pertenezca al tenant.
 */
export function useEquipo(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["equipo", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async (): Promise<MiembroEquipo[]> => {
      const { data, error } = await supabase.rpc("equipo_del_tenant", {
        p_tenant_id: tenantId!,
      });
      if (error) throw error;
      return (data ?? []) as MiembroEquipo[];
    },
  });
}

export function useQuitarDelEquipo(tenantId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    // El unique parcial `uniq_owner_por_tenant` y la policy de delete impiden
    // que un encargado se elimine a si mismo o al owner.
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("tenant_usuarios")
        .delete()
        .eq("tenant_id", tenantId!)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["equipo", tenantId] });
      void qc.invalidateQueries({ queryKey: ["uso-tenant", tenantId] });
    },
  });
}

/**
 * Invitar a un encargado exige crear un usuario en auth, y eso solo lo puede
 * hacer el `service_role_key`, que jamas vive en el frontend. La llamada va a la
 * Edge Function `invitar-encargado` (ver supabase/functions/).
 *
 * Mientras no este desplegada, `functions.invoke` responde 404 y se traduce a un
 * mensaje claro en vez de un error crudo.
 */
export function useInvitarEncargado(tenantId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.functions.invoke("invitar-encargado", {
        body: { tenant_id: tenantId, email },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["equipo", tenantId] });
    },
  });
}
