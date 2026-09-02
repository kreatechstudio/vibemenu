import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { traducirError } from "@/lib/errores";
import { guardarTarjetaLocal, leerTarjetaLocal, olvidarTarjetaLocal } from "@/lib/lealtad";

export type TarjetaPublica = {
  sellos: number;
  sellosMeta: number;
  premio: string;
  codigo: string;
  premiosCanjeados: number;
  tenantNombre: string;
  tenantSlug: string;
  tieneContacto: boolean;
  contactoEnmascarado: string | null;
};

export function useTarjetaLocal(slug: string) {
  const [uuid, setUuid] = useState<string | null>(() => leerTarjetaLocal(slug));
  useEffect(() => setUuid(leerTarjetaLocal(slug)), [slug]);

  const guardar = useCallback(
    (u: string) => {
      guardarTarjetaLocal(slug, u);
      setUuid(u);
    },
    [slug],
  );
  const olvidar = useCallback(() => {
    olvidarTarjetaLocal(slug);
    setUuid(null);
  }, [slug]);

  return { uuid, guardar, olvidar };
}

export function useTarjeta(slug: string, uuid: string | null) {
  return useQuery({
    queryKey: ["tarjeta-lealtad", uuid],
    enabled: Boolean(uuid),
    retry: false,
    staleTime: 15_000,
    queryFn: async (): Promise<TarjetaPublica | null> => {
      const { data, error } = await supabase.rpc("obtener_tarjeta_lealtad", {
        p_tarjeta_id: uuid!,
      });
      if (error) throw error;
      const fila = (data ?? [])[0];
      if (!fila) return null;
      return {
        sellos: fila.sellos,
        sellosMeta: fila.sellos_meta,
        premio: fila.premio,
        codigo: fila.codigo,
        premiosCanjeados: fila.premios_canjeados,
        tenantNombre: fila.tenant_nombre,
        tenantSlug: fila.tenant_slug,
        tieneContacto: fila.tiene_contacto,
        contactoEnmascarado: fila.contacto_enmascarado,
      };
    },
  });
}

export function useCrearTarjeta(tenantId: string | undefined, slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc("crear_tarjeta_lealtad", {
        p_tenant_id: tenantId!,
      });
      if (error) throw new Error(traducirError(error).mensaje);
      const fila = Array.isArray(data) ? data[0] : data;
      if (!fila?.id) throw new Error("No pudimos crear tu tarjeta.");
      return fila.id as string;
    },
    onSuccess: (uuid) => {
      guardarTarjetaLocal(slug, uuid);
      void qc.invalidateQueries({ queryKey: ["tarjeta-lealtad", uuid] });
    },
  });
}

export function useGuardarContacto(uuid: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { contacto: string; tipo: "telefono" | "correo"; consent: boolean }) => {
      const { error } = await supabase.rpc("guardar_contacto_tarjeta", {
        p_tarjeta_id: uuid!,
        p_contacto: v.contacto,
        p_tipo: v.tipo,
        p_consent: v.consent,
      });
      if (error) throw new Error(traducirError(error).mensaje);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tarjeta-lealtad", uuid] }),
  });
}
