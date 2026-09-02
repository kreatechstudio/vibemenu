import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  Categoria,
  FormatoMenu,
  GrupoModificador,
  OpcionModificador,
  Plan,
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
  /** planes.permite_embudo_resenas — gatea el aviso "¿cómo estuvo tu visita?". */
  permiteEmbudoResenas: boolean;
  /** planes.permite_pedidos_whatsapp — gatea "Pedir por WhatsApp" (el carrito). */
  permitePedidosWhatsApp: boolean;
  /** planes.permite_reservaciones — gatea "Reservar" en el menú. */
  permiteReservaciones: boolean;
  /** planes.permite_analitica_platillo — cuenta interacciones por platillo (Enterprise). */
  permiteAnaliticaPlatillo: boolean;
  menuIndependiente: boolean;
  sucursales: Sucursal[];
  sucursalActiva: Sucursal | null;
  categorias: CategoriaConProductos[];
};

/**
 * Menu publico de un tenant, por slug. Se lee sin sesion: todas estas tablas
 * tienen `select using (true)` en RLS, asi que tambien funciona desde el servidor.
 *
 * Menu compartido vs. independiente: `sucursal_id` nullable en `categorias` y
 * `productos`. NULL = visible en todas las sucursales. Un uuid = exclusivo de esa.
 * Cuando hay sucursal activa se traen las dos cosas: las suyas y las compartidas,
 * y el precio que se muestra es el de `precios_sucursal` si esa sucursal lo fijo.
 *
 * Devuelve null si el slug (o la sucursal) no existe. El loader de la ruta lo
 * convierte en un 404 de verdad.
 */
export async function obtenerMenuPublico(
  slug: string,
  sucursalSlug?: string,
): Promise<MenuPublico | null> {
  const { data: tenantRow, error: errorTenant } = await supabase
    .from("tenants")
    .select(
      "*, plan:planes(marca_agua, menu_independiente_por_sucursal, permite_embudo_resenas, permite_pedidos_whatsapp, permite_reservaciones, permite_analitica_platillo)",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (errorTenant) throw errorTenant;
  return armarMenuPublico(tenantRow, sucursalSlug);
}

/**
 * Igual que `obtenerMenuPublico`, pero busca por `dominio_personalizado` en vez
 * de slug. La usa la ruta raiz cuando el Host de la request no es vibemenu.com.mx:
 * asi el dueno de un dominio propio ve su carta en "/", no en "/<slug>".
 */
export async function obtenerMenuPublicoPorDominio(host: string): Promise<MenuPublico | null> {
  const { data: tenantRow, error: errorTenant } = await supabase
    .from("tenants")
    .select(
      "*, plan:planes(marca_agua, menu_independiente_por_sucursal, permite_embudo_resenas, permite_pedidos_whatsapp, permite_reservaciones, permite_analitica_platillo)",
    )
    .eq("dominio_personalizado", host)
    .maybeSingle();

  if (errorTenant) throw errorTenant;
  return armarMenuPublico(tenantRow);
}

/**
 * Igual que `obtenerMenuPublicoPorDominio`, pero para una sucursal especifica.
 * La usa `routes/sucursal.$sucursalSlug.tsx` -- el equivalente, bajo dominio
 * propio, de `$slug.sucursal.$sucursalSlug.tsx`.
 */
export async function obtenerSucursalPublicaPorDominio(
  host: string,
  sucursalSlug: string,
): Promise<MenuPublico | null> {
  const { data: tenantRow, error: errorTenant } = await supabase
    .from("tenants")
    .select(
      "*, plan:planes(marca_agua, menu_independiente_por_sucursal, permite_embudo_resenas, permite_pedidos_whatsapp, permite_reservaciones, permite_analitica_platillo)",
    )
    .eq("dominio_personalizado", host)
    .maybeSingle();

  if (errorTenant) throw errorTenant;
  return armarMenuPublico(tenantRow, sucursalSlug);
}

async function armarMenuPublico(
  tenantRow:
    | (Tenant & {
        plan: Pick<
          Plan,
          | "marca_agua"
          | "menu_independiente_por_sucursal"
          | "permite_embudo_resenas"
          | "permite_pedidos_whatsapp"
          | "permite_reservaciones"
          | "permite_analitica_platillo"
        > | null;
      })
    | null,
  sucursalSlug?: string,
): Promise<MenuPublico | null> {
  if (!tenantRow) return null;

  const { plan, ...tenant } = tenantRow;

  // Lista explícita de columnas (no select("*")): mantiene `reservaciones_email`
  // —correo interno de avisos que teclea el dueño— fuera del payload público que
  // se serializa en el HTML hidratado del menú.
  const { data: sucursales, error: errorSuc } = await supabase
    .from("sucursales")
    .select(
      "id, tenant_id, nombre, slug, direccion, telefono, whatsapp, maps_url, google_reviews_url, timezone, activa, created_at, acepta_reservaciones",
    )
    .eq("tenant_id", tenant.id)
    .eq("activa", true)
    .order("created_at")
    .returns<Sucursal[]>();
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

  const [catRes, prodRes, gruposRes, vinculosRes, preciosRes] = await Promise.all([
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
    // Los precios sobrescritos solo existen dentro de una sucursal concreta.
    sucursalActiva
      ? supabase
          .from("precios_sucursal")
          .select("producto_id, precio")
          .eq("sucursal_id", sucursalActiva.id)
      : null,
  ]);

  for (const r of [catRes, prodRes, gruposRes, vinculosRes]) {
    if (r.error) throw r.error;
  }
  if (preciosRes?.error) throw preciosRes.error;

  // Sin fila propia, la sucursal cobra `productos.precio`.
  const precioEnSucursal = new Map(
    (preciosRes?.data ?? []).map((f) => [f.producto_id, f.precio] as const),
  );

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
        .map((p) => ({
          ...p,
          precio: precioEnSucursal.get(p.id) ?? p.precio,
          grupos: gruposDeProducto.get(p.id) ?? [],
        })),
    }))
    .filter((c) => c.productos.length > 0);

  return {
    tenant: tenant as Tenant,
    formato: tenant.formato_activo as FormatoMenu,
    marcaAgua: plan?.marca_agua ?? true,
    permiteEmbudoResenas: plan?.permite_embudo_resenas ?? false,
    permitePedidosWhatsApp: plan?.permite_pedidos_whatsapp ?? false,
    permiteReservaciones: plan?.permite_reservaciones ?? false,
    permiteAnaliticaPlatillo: plan?.permite_analitica_platillo ?? false,
    menuIndependiente: plan?.menu_independiente_por_sucursal ?? false,
    sucursales: sucursales ?? [],
    sucursalActiva,
    categorias: categoriasConProductos,
  };
}

/**
 * `inicial` lo trae el loader de la ruta. Sin eso, el SSR sirve el esqueleto y el
 * menu del negocio no existe en el HTML: invisible para Google. Para un producto
 * que vende "tu menu digital", eso es regalar el posicionamiento del cliente.
 */
export function useMenuPublico(slug: string, sucursalSlug?: string, inicial?: MenuPublico) {
  return useQuery({
    queryKey: ["menu-publico", slug, sucursalSlug ?? null],
    staleTime: 60_000,
    initialData: inicial,
    queryFn: () => obtenerMenuPublico(slug, sucursalSlug),
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
