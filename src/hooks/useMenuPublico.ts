import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  Categoria,
  FormatoMenu,
  GrupoModificador,
  OpcionModificador,
  Producto,
  Sucursal,
  Tenant,
} from "@/types/database";

export type GrupoConOpciones = GrupoModificador & { opciones: OpcionModificador[] };
export type ProductoConModificadores = Producto & { grupos: GrupoConOpciones[] };
export type CategoriaConProductos = Categoria & { productos: ProductoConModificadores[] };

export type MenuPublico = {
  tenant: Tenant;
  formato: FormatoMenu;
  /** Del plan del tenant. Free lleva "Hecho con Vibemenu" al pie. */
  marcaAgua: boolean;
  menuIndependiente: boolean;
  sucursales: Sucursal[];
  sucursalActiva: Sucursal | null;
  categorias: CategoriaConProductos[];
};

/**
 * Menu publico de un tenant, por slug. Se lee sin sesion: todas estas tablas
 * tienen `select using (true)` en RLS.
 *
 * Menu compartido vs. independiente: `sucursal_id` nullable en `categorias` y
 * `productos`. NULL = visible en todas las sucursales. Un uuid = exclusivo de esa.
 * Cuando hay sucursal activa se traen las dos cosas: las suyas y las compartidas.
 *
 * Devuelve null si el slug no existe, para que la pagina muestre
 * "Este menú no existe o ya no está disponible."
 */
export function useMenuPublico(slug: string, sucursalSlug?: string) {
  return useQuery({
    queryKey: ["menu-publico", slug, sucursalSlug ?? null],
    staleTime: 60_000,
    queryFn: async (): Promise<MenuPublico | null> => {
      const { data: tenantRow, error: errorTenant } = await supabase
        .from("tenants")
        .select("*, plan:planes(marca_agua, menu_independiente_por_sucursal)")
        .eq("slug", slug)
        .maybeSingle();

      if (errorTenant) throw errorTenant;
      if (!tenantRow) return null;

      const { plan, ...tenant } = tenantRow;

      const { data: sucursales, error: errorSuc } = await supabase
        .from("sucursales")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("activa", true)
        .order("created_at");
      if (errorSuc) throw errorSuc;

      const sucursalActiva = sucursalSlug
        ? (sucursales.find((s) => s.slug === sucursalSlug) ?? null)
        : null;

      // Si se pidio una sucursal que no existe, el menu tampoco existe.
      if (sucursalSlug && !sucursalActiva) return null;

      const visiblesEn = <T extends { sucursal_id: string | null }>(filas: T[]) =>
        sucursalActiva
          ? filas.filter((f) => f.sucursal_id === null || f.sucursal_id === sucursalActiva.id)
          : filas;

      const [catRes, prodRes, gruposRes, vinculosRes] = await Promise.all([
        supabase.from("categorias").select("*").eq("tenant_id", tenant.id).order("orden"),
        supabase
          .from("productos")
          .select("*")
          .eq("tenant_id", tenant.id)
          .eq("activo", true)
          .order("orden"),
        supabase
          .from("grupos_modificadores")
          .select("*, opciones:opciones_modificador(*)")
          .eq("tenant_id", tenant.id)
          .order("orden"),
        supabase.from("producto_modificadores").select("producto_id, grupo_id"),
      ]);

      for (const r of [catRes, prodRes, gruposRes, vinculosRes]) {
        if (r.error) throw r.error;
      }

      const gruposPorId = new Map(
        (gruposRes.data ?? []).map((g) => [
          g.id,
          { ...g, opciones: [...g.opciones].sort((a, b) => a.orden - b.orden) },
        ]),
      );

      // producto_modificadores no tiene tenant_id; se filtra por los grupos del tenant.
      const gruposDeProducto = new Map<string, GrupoConOpciones[]>();
      for (const v of vinculosRes.data ?? []) {
        const grupo = gruposPorId.get(v.grupo_id);
        if (!grupo) continue;
        const lista = gruposDeProducto.get(v.producto_id) ?? [];
        lista.push(grupo);
        gruposDeProducto.set(v.producto_id, lista);
      }

      const productos = visiblesEn(prodRes.data ?? []);
      const categorias = visiblesEn(catRes.data ?? []);

      const categoriasConProductos: CategoriaConProductos[] = categorias
        .map((c) => ({
          ...c,
          productos: productos
            .filter((p) => p.categoria_id === c.id)
            .map((p) => ({ ...p, grupos: gruposDeProducto.get(p.id) ?? [] })),
        }))
        .filter((c) => c.productos.length > 0);

      return {
        tenant: tenant as Tenant,
        formato: tenant.formato_activo as FormatoMenu,
        marcaAgua: plan?.marca_agua ?? true,
        menuIndependiente: plan?.menu_independiente_por_sucursal ?? false,
        sucursales: sucursales ?? [],
        sucursalActiva,
        categorias: categoriasConProductos,
      };
    },
  });
}

/**
 * Abierto / cerrado calculado EN EL SERVIDOR, con la timezone de la sucursal.
 * No se calcula en el navegador: un comensal en otro huso veria el estado equivocado.
 */
export function useSucursalAbierta(sucursalId: string | undefined) {
  return useQuery({
    queryKey: ["sucursal-abierta", sucursalId],
    enabled: Boolean(sucursalId),
    staleTime: 60_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("sucursal_esta_abierta", {
        p_sucursal_id: sucursalId!,
      });
      if (error) throw error;
      return data ?? false;
    },
  });
}
