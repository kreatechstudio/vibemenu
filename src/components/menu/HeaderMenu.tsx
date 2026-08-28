import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import RedesSociales, { tieneRedes } from "@/components/menu/RedesSociales";
import { useSucursalAbierta } from "@/hooks/useMenuPublico";
import { contactoSucursal } from "@/lib/contacto";
import { enlaceMaps } from "@/lib/maps";
import { ESTADOS } from "@/lib/copy";
import type { Sucursal, Tenant } from "@/types/database";
import { cn } from "@/lib/utils";

function BadgeAbierto({ abierta }: { abierta: boolean | undefined }) {
  if (abierta === undefined) {
    return <span className="h-6 w-20 animate-pulse rounded-full bg-black/10" aria-hidden />;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        abierta ? "bg-vm-success-soft text-vm-success" : "bg-vm-danger-soft text-vm-danger",
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", abierta ? "bg-vm-success" : "bg-vm-danger")}
        aria-hidden
      />
      {abierta ? "Abierto" : "Cerrado ahora"}
    </span>
  );
}

/**
 * Cabecera comun a los 4 formatos. Usa el tema del tenant, nunca el azul de Vibemenu.
 * Si la sucursal esta cerrada, muestra el mensaje completo de copywriting.md debajo.
 */
export default function HeaderMenu({
  tenant,
  sucursales,
  sucursalActiva,
  menuIndependiente,
  compacta = false,
  sobreOscuro = false,
  abiertaFija,
}: {
  tenant: Tenant;
  sucursales: Sucursal[];
  sucursalActiva: Sucursal | null;
  menuIndependiente: boolean;
  /** Instagram la quiere minima, mas pegada al contenido. */
  compacta?: boolean;
  /** Modo `completo`: el texto ya va en blanco sobre la foto; los iconos también. */
  sobreOscuro?: boolean;
  /**
   * Solo para /demo, que usa datos en memoria con ids ficticios.
   * Si se pasa, no se llama a la funcion sucursal_esta_abierta de Postgres:
   * ese RPC espera un uuid real y reventaria.
   */
  abiertaFija?: boolean;
}) {
  const sucursal = sucursalActiva ?? sucursales[0] ?? null;
  const resenas = contactoSucursal(sucursal, tenant).googleReviewsUrl;
  const consulta = useSucursalAbierta(abiertaFija === undefined ? sucursal?.id : undefined);
  const abierta = abiertaFija ?? consulta.data;
  const mapa = sucursal ? enlaceMaps(sucursal, tenant.nombre_negocio) : null;

  return (
    <header
      className={cn("px-4 pt-6", compacta ? "pb-3" : "pb-5")}
      style={{ color: "var(--menu-texto)" }}
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        {tenant.logo_url ? (
          <img
            src={tenant.logo_url}
            alt=""
            className="size-11 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
            style={{ background: "var(--menu-primario)" }}
            aria-hidden
          >
            {tenant.nombre_negocio.slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h1
            className="truncate text-lg font-bold"
            style={{ fontFamily: "var(--menu-fuente)", color: "var(--menu-texto)" }}
          >
            {tenant.nombre_negocio}
          </h1>
          {/*
            El enlace muestra el NOMBRE de la sucursal, no la dirección: una calle
            con número y colonia se come dos renglones y empuja todo. La dirección
            completa viaja en el `title`, y va en color de acento con subrayado para
            que se lea como enlace y no como un dato más.
          */}
          {sucursal &&
            (mapa ? (
              <a
                href={mapa}
                target="_blank"
                rel="noreferrer"
                title={sucursal.direccion ?? undefined}
                className="flex items-center gap-1 truncate text-xs font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid"
                style={{ color: "var(--menu-primario)" }}
              >
                <MapPin className="size-3 shrink-0" aria-hidden />
                {sucursal.nombre}
              </a>
            ) : (
              <p
                className="flex items-center gap-1 truncate text-xs"
                style={{ color: "var(--menu-texto-suave)" }}
              >
                <MapPin className="size-3 shrink-0" aria-hidden />
                {sucursal.nombre}
              </p>
            ))}
        </div>

        {sucursal && <BadgeAbierto abierta={abierta} />}
      </div>

      {/* Van justo después del nombre y la dirección. */}
      {tieneRedes(tenant, resenas) && (
        <div className="mx-auto mt-3 flex max-w-2xl">
          <RedesSociales tenant={tenant} sobreOscuro={sobreOscuro} resenasUrlOverride={resenas} />
        </div>
      )}

      {/* Instagram pide una cabecera minima: ahi la descripcion sobra. */}
      {tenant.descripcion && !compacta && (
        <p
          className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed"
          style={{ color: "var(--menu-texto-suave)" }}
        >
          {tenant.descripcion}
        </p>
      )}

      {/* Solo los planes con menu independiente muestran el selector de sucursal. */}
      {menuIndependiente && sucursales.length > 1 && (
        <nav className="mx-auto mt-4 flex max-w-2xl gap-2 overflow-x-auto pb-1">
          {sucursales.map((s) => {
            const activa = s.id === sucursal?.id;
            return (
              <Link
                key={s.id}
                to="/$slug/sucursal/$sucursalSlug"
                params={{ slug: tenant.slug, sucursalSlug: s.slug }}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-opacity",
                  activa ? "text-white" : "opacity-70 hover:opacity-100",
                )}
                style={
                  activa
                    ? { background: "var(--menu-primario)", borderColor: "var(--menu-primario)" }
                    : { borderColor: "var(--menu-texto-suave)", color: "var(--menu-texto)" }
                }
              >
                {s.nombre}
              </Link>
            );
          })}
        </nav>
      )}

      {sucursal && abierta === false && (
        <p
          className="mx-auto mt-4 max-w-2xl rounded-lg px-3.5 py-2.5 text-sm"
          style={{
            background: "color-mix(in srgb, var(--menu-texto) 6%, transparent)",
            color: "var(--menu-texto-suave)",
          }}
        >
          {ESTADOS.negocioCerrado}
        </p>
      )}
    </header>
  );
}
