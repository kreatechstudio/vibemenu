import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { EstadoInvitacion } from "@/types/database";

export type InvitacionInfo = {
  tenant_nombre: string;
  email: string;
  estado: EstadoInvitacion;
  expira_at: string;
  /** true si ese correo ya tiene cuenta en Vibemenu — decide el formulario que se pinta. */
  cuenta_existente: boolean;
};

/** Lectura pública por token, vía `invitacion_info` (SECURITY DEFINER, ver migración 012). */
export function useInvitacionInfo(token: string | undefined) {
  return useQuery({
    queryKey: ["invitacion-info", token],
    enabled: Boolean(token),
    retry: false,
    queryFn: async (): Promise<InvitacionInfo | null> => {
      const { data, error } = await supabase.rpc("invitacion_info", { p_token: token! });
      if (error) throw error;
      return (data?.[0] as InvitacionInfo) ?? null;
    },
  });
}

type RespuestaAceptar = { ok: true; creado?: boolean };

/**
 * Llama a la Edge Function `aceptar-invitacion`. `password` solo hace falta
 * cuando `cuenta_existente` es false (correo sin cuenta todavía); si ya existe
 * cuenta, la función exige sesión activa con ese mismo correo y la ignora.
 */
export function useAceptarInvitacion() {
  return useMutation({
    mutationFn: async (vars: { token: string; password?: string }): Promise<RespuestaAceptar> => {
      const { data, error } = await supabase.functions.invoke("aceptar-invitacion", {
        body: vars,
      });
      if (error) throw error;
      return data as RespuestaAceptar;
    },
  });
}
