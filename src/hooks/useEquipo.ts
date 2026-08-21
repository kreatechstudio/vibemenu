import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { RolUsuario } from "@/types/database";

export type MiembroEquipo = {
  user_id: string;
  email: string;
  /* Migración 011 — de raw_user_meta_data: null para quien entró con email/password. */
  nombre: string | null;
  avatar_url: string | null;
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
 * Crea (o reenvia) una invitacion y manda el correo por Resend. No crea la
 * cuenta del encargado todavia -- eso pasa hasta que acepta en
 * /invitacion/:token (Edge Function `aceptar-invitacion`), que es cuando de
 * verdad hace falta el `service_role_key`. Ver supabase/functions/invitar-encargado.
 *
 * El error real (correo ya invitado, ya administra otro negocio, funcion sin
 * desplegar, etc.) se traduce en el llamador con `traducirErrorEdge`.
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
