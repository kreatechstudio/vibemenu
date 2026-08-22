import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSesion } from "@/hooks/useSesion";
import type { MiembroEquipo } from "@/hooks/useEquipo";
import type {
  EstadoTenant,
  Invitacion,
  NombrePlan,
  NotaInterna,
  Pago,
  Plan,
  Suscripcion,
  Tenant,
} from "@/types/database";

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
  /* Migración 018 — estado del dominio (verificado, pendiente, etc). */
  dominio_estado: string | null;
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
          "id, nombre_negocio, slug, estado, created_at, dominio_personalizado, dominio_estado, plan:planes(nombre), suscripciones(estado, precio_congelado_usd, precio_congelado_mxn, moneda_cobro, fecha_renovacion)",
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

/**
 * Ingreso mensual recurrente, sobre las suscripciones activas que ya trae
 * `useTenantsSuperAdmin`. Nunca se suma mxn con usd — son dos negocios de
 * cobro distintos, mezclarlos en un solo numero mentiria sobre cuanto entra.
 */
export function calcularMrr(tenants: TenantSuperAdmin[]): { mxn: number; usd: number } {
  return tenants.reduce(
    (acc, t) => {
      const s = t.suscripcionActiva;
      if (!s) return acc;
      if (s.moneda_cobro === "usd") acc.usd += s.precio_congelado_usd;
      else acc.mxn += s.precio_congelado_mxn;
      return acc;
    },
    { mxn: 0, usd: 0 },
  );
}

export type DetalleTenantSuperAdmin = {
  tenant: Tenant;
  plan: Plan | null;
  historialSuscripciones: Suscripcion[];
  pagos: Pago[];
  equipo: MiembroEquipo[];
  invitaciones: Invitacion[];
};

/**
 * Ficha completa de un negocio para la vista de detalle. Cinco consultas en
 * paralelo: `pagos` y `suscripciones` ya tenian policy de super-admin
 * (migraciones 010 y 009); `tenant_usuarios` (via la RPC `super_admin_equipo`,
 * que si lee `auth.users`) e `invitaciones` las abre la migracion 014.
 */
export function useDetalleTenantSuperAdmin(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["super-admin-detalle", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async (): Promise<DetalleTenantSuperAdmin> => {
      const [tenantRes, suscripcionesRes, pagosRes, equipoRes, invitacionesRes] = await Promise.all(
        [
          supabase.from("tenants").select("*, plan:planes(*)").eq("id", tenantId!).single(),
          supabase
            .from("suscripciones")
            .select("*")
            .eq("tenant_id", tenantId!)
            .order("fecha_inicio", { ascending: false }),
          supabase
            .from("pagos")
            .select("*")
            .eq("tenant_id", tenantId!)
            .order("fecha_pago", { ascending: false }),
          supabase.rpc("super_admin_equipo", { p_tenant_id: tenantId! }),
          supabase
            .from("invitaciones")
            .select("*")
            .eq("tenant_id", tenantId!)
            .order("created_at", { ascending: false }),
        ],
      );

      if (tenantRes.error) throw tenantRes.error;
      if (suscripcionesRes.error) throw suscripcionesRes.error;
      if (pagosRes.error) throw pagosRes.error;
      if (equipoRes.error) throw equipoRes.error;
      if (invitacionesRes.error) throw invitacionesRes.error;

      const { plan, ...tenant } = tenantRes.data as Tenant & { plan: Plan | null };

      return {
        tenant: tenant as Tenant,
        plan,
        historialSuscripciones: suscripcionesRes.data ?? [],
        pagos: pagosRes.data ?? [],
        equipo: (equipoRes.data ?? []) as MiembroEquipo[],
        invitaciones: invitacionesRes.data ?? [],
      };
    },
  });
}

/**
 * Mueve `estado` a mano, fuera del webhook de Stripe — via la RPC
 * `cambiar_estado_tenant` (migracion 014), que revisa `es_super_admin()` por
 * dentro porque SECURITY DEFINER bypassea la RLS normal de `tenants`.
 */
export function useCambiarEstadoTenant() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { tenantId: string; estado: EstadoTenant }) => {
      const { error } = await supabase.rpc("cambiar_estado_tenant", {
        p_tenant_id: vars.tenantId,
        p_estado: vars.estado,
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["super-admin-detalle", vars.tenantId] });
      void qc.invalidateQueries({ queryKey: ["super-admin-tenants"] });
    },
  });
}

export function useNotasInternas(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["notas-internas", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async (): Promise<NotaInterna[]> => {
      const { data, error } = await supabase
        .from("notas_internas")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Sin update ni delete a proposito: una nota es un registro historico, no un campo editable. */
export function useCrearNotaInterna(tenantId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useSesion();

  return useMutation({
    mutationFn: async (texto: string) => {
      const { error } = await supabase.from("notas_internas").insert({
        tenant_id: tenantId!,
        autor_id: user!.id,
        texto: texto.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notas-internas", tenantId] });
    },
  });
}
