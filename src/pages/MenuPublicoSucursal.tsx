import MenuPublico from "@/pages/MenuPublico";

interface MenuPublicoSucursalProps {
  slug: string;
  sucursalSlug: string;
}

/**
 * `/:slug/sucursal/:sucursalSlug`. Es el mismo menu, filtrado a una sucursal:
 * se muestran sus categorias y productos exclusivos mas los compartidos
 * (`sucursal_id is null`).
 *
 * Si el plan no permite menu independiente, el tenant nunca pudo escribir un
 * `sucursal_id` no nulo, asi que esta ruta devuelve lo mismo que `/:slug`.
 */
export default function MenuPublicoSucursal({ slug, sucursalSlug }: MenuPublicoSucursalProps) {
  return <MenuPublico slug={slug} sucursalSlug={sucursalSlug} />;
}
