import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSesion } from "@/hooks/useSesion";
import type { FormatoMenu, Plan, RolUsuario, Tenant } from "@/types/database";

export type ContextoTenant = {
  tenant: Tenant;
  plan: Plan;
  rol: RolUsuario;
  /** Facturacion y equipo son exclusivos del owner. */
  esOwner: boolean;
  formatosDesbloqueados: FormatoMenu[];
};

/**
 * Tenant del usuario autenticado, con su plan y su rol, en una sola consulta.
 * Un usuario pertenece a un solo tenant (unique en tenant_usuarios).
 *
 * Las RLS ya limitan la fila a la del usuario, pero se filtra por user_id
 * igualmente para no depender solo de la politica.
 */
export function useTenantActual() {
  const { user, cargando: cargandoSesion } = useSesion();

  return useQuery({
    queryKey: ["tenant-actual", user?.id],
    enabled: !cargandoSesion && Boolean(user?.id),
    staleTime: 30_000,
    queryFn: async (): Promise<ContextoTenant | null> => {
      const { data, error } = await supabase
        .from("tenant_usuarios")
        .select("rol, tenant:tenants(*, plan:planes(*))")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      if (!data?.tenant) return null;

      const tenant = data.tenant as Tenant & { plan: Plan | null };
      const { plan, ...tenantSinPlan } = tenant;

      // plan_id es nullable en el schema, pero un trigger lo rellena a 'free'
      // en el insert. Si llega null, algo se salto el trigger.
      if (!plan) throw new Error("plan_inexistente");

      const rol = data.rol as RolUsuario;

      return {
        tenant: tenantSinPlan as Tenant,
        plan,
        rol,
        esOwner: rol === "owner",
        formatosDesbloqueados: tenant.formatos_desbloqueados as FormatoMenu[],
      };
    },
  });
}

/**
 * Conteos de uso del tenant, para pintar "2 de 3 sucursales" y deshabilitar
 * botones antes de que el trigger reviente. Usa head:true: cuenta sin traer filas.
 */
export function useUsoDelTenant(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["uso-tenant", tenantId],
    enabled: Boolean(tenantId),
    staleTime: 10_000,
    queryFn: async () => {
      const contar = async (
        tabla: "productos" | "sucursales" | "tenant_usuarios" | "grupos_modificadores",
      ) => {
        const { count, error } = await supabase
          .from(tabla)
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId!);
        if (error) throw error;
        return count ?? 0;
      };

      const [productos, sucursales, usuarios, gruposModificadores] = await Promise.all([
        contar("productos"),
        contar("sucursales"),
        contar("tenant_usuarios"),
        contar("grupos_modificadores"),
      ]);

      return { productos, sucursales, usuarios, gruposModificadores };
    },
  });
}
