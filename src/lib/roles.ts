import type { RolUsuario } from "@/types/database";

/**
 * Rutas del admin que un barista sí puede usar: operación diaria (carta
 * solo activo/inactivo, reservaciones, lealtad), nada de administrar el
 * negocio. Compartido por `AdminLayout` (nav + redirect) y `PillTabs`
 * (para no mostrar pestañas que lo mandarían de vuelta igual).
 */
export const RUTAS_BARISTA = ["/admin/menu", "/admin/reservaciones", "/admin/lealtad"] as const;

export const puedeVerRuta = (rol: RolUsuario, pathname: string): boolean =>
  rol !== "barista" || RUTAS_BARISTA.some((r) => pathname === r || pathname.startsWith(`${r}/`));
