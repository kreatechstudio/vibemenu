import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Horario, Sucursal } from "@/types/database";

export const DIAS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export type BorradorSucursal = {
  nombre: string;
  slug: string;
  direccion: string | null;
  /** Enlace de Google Maps del negocio. Si falta, se arma uno con la dirección. */
  maps_url: string | null;
  /** Enlace de "Pedir reseñas" de la ficha de Google de esta sucursal. */
  google_reviews_url: string | null;
  telefono: string | null;
  whatsapp: string | null;
  timezone: string;
};

/** Una fila por dia. `dia_semana` 0 = domingo, igual que `extract(dow ...)` en Postgres. */
export type BorradorHorario = {
  dia_semana: number;
  cerrado: boolean;
  hora_apertura: string | null;
  hora_cierre: string | null;
};

export function useSucursales(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["sucursales", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async (): Promise<Sucursal[]> => {
      const { data, error } = await supabase
        .from("sucursales")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useHorarios(sucursalId: string | undefined) {
  return useQuery({
    queryKey: ["horarios", sucursalId],
    enabled: Boolean(sucursalId),
    queryFn: async (): Promise<Horario[]> => {
      const { data, error } = await supabase
        .from("horarios")
        .select("*")
        .eq("sucursal_id", sucursalId!)
        .order("dia_semana");
      if (error) throw error;
      return data;
    },
  });
}

function useInvalidar(tenantId: string | undefined) {
  const qc = useQueryClient();
  return (sucursalId?: string) => {
    void qc.invalidateQueries({ queryKey: ["sucursales", tenantId] });
    void qc.invalidateQueries({ queryKey: ["uso-tenant", tenantId] });
    if (sucursalId) void qc.invalidateQueries({ queryKey: ["horarios", sucursalId] });
  };
}

/**
 * Crea o actualiza la sucursal y reescribe sus 7 horarios.
 *
 * Dos triggers pueden rechazar esto: `trg_sucursales_10_timezone` si la zona no
 * existe en pg_timezone_names, y `trg_sucursales_20_limite` si el plan ya topo.
 *
 * `datos` siempre lleva `google_reviews_url`, así que la migración
 * `vibemenu_migracion_contacto_sucursal.sql` debe estar aplicada antes del deploy.
 */
export function useGuardarSucursal(tenantId: string | undefined) {
  const invalidar = useInvalidar(tenantId);

  return useMutation({
    mutationFn: async ({
      id,
      datos,
      horarios,
    }: {
      id?: string;
      datos: BorradorSucursal;
      horarios: BorradorHorario[];
    }) => {
      let sucursalId = id;

      if (sucursalId) {
        const { error } = await supabase.from("sucursales").update(datos).eq("id", sucursalId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("sucursales")
          .insert({ ...datos, tenant_id: tenantId! })
          .select("id")
          .single();
        if (error) throw error;
        sucursalId = data.id;
      }

      // unique (sucursal_id, dia_semana) permite el upsert de las 7 filas de golpe.
      const { error: errorHorarios } = await supabase.from("horarios").upsert(
        horarios.map((h) => ({ ...h, sucursal_id: sucursalId! })),
        { onConflict: "sucursal_id,dia_semana" },
      );
      if (errorHorarios) throw errorHorarios;

      return sucursalId;
    },
    onSuccess: (sucursalId) => invalidar(sucursalId),
  });
}

export function useBorrarSucursal(tenantId: string | undefined) {
  const invalidar = useInvalidar(tenantId);
  return useMutation({
    // on delete cascade limpia horarios. Los productos con esa sucursal_id tambien caen.
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sucursales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(),
  });
}

/**
 * Zonas horarias IANA que soporta el navegador. Postgres valida contra
 * pg_timezone_names, asi que una zona valida aqui lo es alla salvo rarezas.
 */
export function zonasHorarias(): string[] {
  const conSoporte = Intl as typeof Intl & { supportedValuesOf?: (k: string) => string[] };
  const todas = conSoporte.supportedValuesOf?.("timeZone");
  if (todas?.length) return todas;

  // Node viejo o navegador sin soporte: las que importan para México y EE.UU.
  return [
    "America/Mexico_City",
    "America/Cancun",
    "America/Monterrey",
    "America/Tijuana",
    "America/Hermosillo",
    "America/Chicago",
    "America/Los_Angeles",
    "America/New_York",
    "America/Denver",
  ];
}

/** Un turno que cierra antes de abrir cruza la medianoche: 20:00 → 02:00. */
export const cruzaMedianoche = (apertura: string | null, cierre: string | null): boolean =>
  Boolean(apertura && cierre && cierre < apertura);
