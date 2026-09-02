import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { traducirError } from "@/lib/errores";
import { useActualizarTenant } from "@/hooks/useActualizarTenant";

export type VistaTarjeta = {
  codigo: string;
  sellos: number;
  sellosMeta: number;
  premio: string;
  premiosCanjeados: number;
  listoParaCanje: boolean;
  selloRepetidoHoy: boolean;
};

const mapVista = (f: Record<string, unknown>): VistaTarjeta => ({
  codigo: f.codigo as string,
  sellos: f.sellos as number,
  sellosMeta: f.sellos_meta as number,
  premio: f.premio as string,
  premiosCanjeados: f.premios_canjeados as number,
  listoParaCanje: f.listo_para_canje as boolean,
  selloRepetidoHoy: f.sello_repetido_hoy as boolean,
});

const primera = (data: unknown): Record<string, unknown> | null =>
  Array.isArray(data) ? (data[0] ?? null) : ((data as Record<string, unknown>) ?? null);

export function useGuardarConfigLealtad(tenantId: string | undefined) {
  return useActualizarTenant(tenantId); // update { lealtad_activa, lealtad_sellos_meta, lealtad_premio }
}

export function useBuscarTarjeta() {
  return useMutation({
    mutationFn: async (codigo: string): Promise<VistaTarjeta> => {
      const { data, error } = await supabase.rpc("buscar_tarjeta", { p_codigo: codigo });
      if (error) throw new Error(traducirError(error).mensaje);
      const f = primera(data);
      if (!f) throw new Error("No encontramos una tarjeta con ese código.");
      return mapVista(f);
    },
  });
}

export function useSellar(tenantId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { codigo: string; sucursalId: string | null }): Promise<VistaTarjeta> => {
      const { data, error } = await supabase.rpc("sellar_tarjeta", {
        p_codigo: v.codigo,
        p_sucursal_id: v.sucursalId ?? undefined,
      });
      if (error) throw new Error(traducirError(error).mensaje);
      return mapVista(primera(data)!);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["movimientos-lealtad", tenantId] }),
  });
}

export function useCanjear(tenantId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { codigo: string; sucursalId: string | null }): Promise<VistaTarjeta> => {
      const { data, error } = await supabase.rpc("canjear_premio", {
        p_codigo: v.codigo,
        p_sucursal_id: v.sucursalId ?? undefined,
      });
      if (error) throw new Error(traducirError(error).mensaje);
      return mapVista(primera(data)!);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["movimientos-lealtad", tenantId] }),
  });
}

export function useRecuperarTarjetas() {
  return useMutation({
    mutationFn: async (contacto: string) => {
      const { data, error } = await supabase.rpc("buscar_tarjetas_por_contacto", {
        p_contacto: contacto,
      });
      if (error) throw new Error(traducirError(error).mensaje);
      return (data ?? []) as {
        id: string;
        codigo: string;
        sellos: number;
        sellos_meta: number;
        contacto_enmascarado: string;
        creada_at: string;
      }[];
    },
  });
}

export function useMovimientosLealtad(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["movimientos-lealtad", tenantId],
    enabled: Boolean(tenantId),
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimientos_lealtad")
        .select(
          "id, tipo, creado_at, sucursal_id, tarjeta:tarjetas_lealtad(codigo), sucursal:sucursales(nombre)",
        )
        .eq("tenant_id", tenantId!)
        .order("creado_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}
