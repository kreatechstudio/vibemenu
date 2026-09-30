import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import type { MenuPublico } from "@/hooks/useMenuPublico";
import { resolverTema, variablesDeTema } from "@/lib/tema";

/**
 * Se sirve en `/:slug` cuando el negocio tiene más de una sucursal: en vez del
 * catálogo plano sin filtrar (que no atribuye lealtad/reseñas/reservaciones a
 * ninguna sucursal), pide elegir una para que el link resuelva a algo real.
 * Con exactamente una sucursal, el loader de la ruta redirige directo — este
 * componente solo aparece con 2+.
 */
export default function SeleccionarSucursal({
  menu,
  dominioPersonalizado = false,
}: {
  menu: MenuPublico;
  /** En dominio propio los links son `/sucursal/:slug`, sin el prefijo del tenant. */
  dominioPersonalizado?: boolean;
}) {
  const tema = resolverTema(menu.tenant.tema, menu.formato);

  return (
    <main
      className="flex min-h-screen flex-col items-center px-4 py-14"
      style={{ ...variablesDeTema(tema), background: "var(--menu-fondo)" }}
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          {menu.tenant.logo_url ? (
            <img
              src={menu.tenant.logo_url}
              alt=""
              className="size-16 rounded-full object-cover shadow-vm-2"
            />
          ) : (
            <div
              className="grid size-16 place-items-center rounded-full text-xl font-bold text-white"
              style={{ background: "var(--menu-primario)" }}
              aria-hidden
            >
              {menu.tenant.nombre_negocio.slice(0, 1).toUpperCase()}
            </div>
          )}
          <h1
            className="mt-4 text-lg font-bold"
            style={{ fontFamily: "var(--menu-fuente)", color: "var(--menu-texto)" }}
          >
            {menu.tenant.nombre_negocio}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--menu-texto-suave)" }}>
            ¿A cuál sucursal quieres ver el menú?
          </p>
        </div>

        <ul className="mt-8 space-y-2.5">
          {menu.sucursales.map((s) => (
            <li key={s.id}>
              <Link
                {...(dominioPersonalizado
                  ? { to: "/sucursal/$sucursalSlug", params: { sucursalSlug: s.slug } }
                  : {
                      to: "/$slug/sucursal/$sucursalSlug",
                      params: { slug: menu.tenant.slug, sucursalSlug: s.slug },
                    })}
                className="flex items-center gap-3 rounded-xl border p-4 text-sm font-medium transition-opacity hover:opacity-75"
                style={{
                  borderColor: "color-mix(in srgb, var(--menu-texto) 12%, transparent)",
                  color: "var(--menu-texto)",
                }}
              >
                <MapPin className="size-4 shrink-0" style={{ color: "var(--menu-primario)" }} />
                {s.nombre}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
