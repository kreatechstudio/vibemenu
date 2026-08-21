import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSesion } from "@/hooks/useSesion";
import type { NombrePlan, Plan } from "@/types/database";

/**
 * true si el usuario esta en `super_admins`. La RLS de esa tabla solo deja leer
 * la propia fila (ver migracion 009), asi que esta consulta nunca revela quien
 * mas es admin.
 */
export function useEsSuperAdmin() {
  const { user, cargando: cargandoSesion } = useSesion();

  return useQuery({
    queryKey: ["es-super-admin", user?.id],
    enabled: !cargandoSesion && Boolean(user?.id),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("super_admins")
        .select("user_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
  });
}

type SuscripcionResumen = {
  estado: string;
  precio_congelado_usd: number;
  precio_congelado_mxn: number;
  moneda_cobro: string;
  fecha_renovacion: string | null;
};

type FilaTenantSuperAdmin = {
  id: string;
  nombre_negocio: string;
  slug: string;
  estado: string;
  created_at: string;
  /* Migración 013 — para saber a quién falta darle de alta el dominio en Vercel. */
  dominio_personalizado: string | null;
  plan: Pick<Plan, "nombre"> | null;
  suscripciones: SuscripcionResumen[];
};

export type TenantSuperAdmin = Omit<FilaTenantSuperAdmin, "suscripciones"> & {
  suscripcionActiva: SuscripcionResumen | null;
};

/**
 * Todos los tenants de la plataforma, con su plan y su suscripcion activa (si
 * tiene). `tenants` y `planes` ya son de lectura publica; `suscripciones` solo
 * se abre a super-admins via la policy `suscripciones_select_super_admin`
 * (migracion 009) — sin ella este select vendria vacio para cualquiera que no
 * sea el owner del tenant.
 */
export function useTenantsSuperAdmin(habilitado: boolean) {
  return useQuery({
    queryKey: ["super-admin-tenants"],
    enabled: habilitado,
    queryFn: async (): Promise<TenantSuperAdmin[]> => {
      const { data, error } = await supabase
        .from("tenants")
        .select(
          "id, nombre_negocio, slug, estado, created_at, dominio_personalizado, plan:planes(nombre), suscripciones(estado, precio_congelado_usd, precio_congelado_mxn, moneda_cobro, fecha_renovacion)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;

      return (data as unknown as FilaTenantSuperAdmin[]).map(({ suscripciones, ...t }) => ({
        ...t,
        suscripcionActiva: suscripciones.find((s) => s.estado === "activa") ?? null,
      }));
    },
  });
}

export const nombrePlanDeTenant = (t: TenantSuperAdmin): NombrePlan =>
  (t.plan?.nombre as NombrePlan) ?? "free";
