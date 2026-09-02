import { Link } from "@tanstack/react-router";
import QRCode from "react-qr-code";
import { useTarjeta } from "@/hooks/useLealtad";
import { progresoLealtad, rejillaSellos } from "@/lib/lealtad";

/**
 * Tarjeta de lealtad del comensal, en `/:slug/lealtad/:tarjetaId`.
 *
 * Versión base: nombre del negocio, rejilla de sellos, avance y el código con
 * su QR para que el mesero lo lea. El formulario de contacto, el "guardar en
 * este teléfono" y el "cómo funciona" llegan después.
 *
 * Ruta sin `loader`: la tarjeta es privada del comensal, se pide desde el
 * navegador con `useTarjeta`. Los tokens `--menu-*` llevan respaldo porque esta
 * pantalla no está envuelta por el tema del negocio todavía.
 */
const FONDO = "var(--menu-fondo, #ffffff)";
const TEXTO = "var(--menu-texto, #0b0b0f)";
const SUAVE = "var(--menu-texto-suave, #6b7280)";
const PRIMARIO = "var(--menu-primario, #111827)";
const BORDE = "color-mix(in srgb, var(--menu-texto, #0b0b0f) 12%, transparent)";
const HUECO = "color-mix(in srgb, var(--menu-texto, #0b0b0f) 25%, transparent)";

export default function TarjetaLealtad({ slug, tarjetaId }: { slug: string; tarjetaId: string }) {
  const { data, isLoading, isError } = useTarjeta(slug, tarjetaId);

  if (isLoading) {
    return (
      <main className="min-h-screen" style={{ background: FONDO }}>
        <div className="mx-auto max-w-md animate-pulse px-4 py-12">
          <div className="mx-auto h-6 w-40 rounded" style={{ background: BORDE }} />
          <div className="mt-8 h-32 rounded-2xl" style={{ background: BORDE }} />
          <div className="mx-auto mt-8 size-40 rounded" style={{ background: BORDE }} />
        </div>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="grid min-h-screen place-items-center px-4" style={{ background: FONDO }}>
        <div className="text-center">
          <p className="text-sm" style={{ color: TEXTO }}>
            No encontramos esta tarjeta.
          </p>
          <Link
            to="/$slug"
            params={{ slug }}
            className="mt-3 inline-block text-sm font-medium underline"
            style={{ color: PRIMARIO }}
          >
            Ir al menú
          </Link>
        </div>
      </main>
    );
  }

  const prog = progresoLealtad(data.sellos, data.sellosMeta);
  const rejilla = rejillaSellos(data.sellos, data.sellosMeta);

  return (
    <main className="min-h-screen" style={{ background: FONDO }}>
      <div className="mx-auto max-w-md px-4 py-10">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold" style={{ color: TEXTO }}>
            {data.tenantNombre}
          </h1>
          <Link
            to="/$slug"
            params={{ slug }}
            className="shrink-0 text-xs font-medium"
            style={{ color: SUAVE }}
          >
            ← al menú
          </Link>
        </header>

        <div
          className="mt-6 flex flex-wrap gap-2 rounded-2xl border p-5"
          style={{ borderColor: BORDE }}
          aria-label={`${prog.hechos} de ${data.sellosMeta} sellos`}
        >
          {rejilla.map((lleno, i) => (
            <span
              key={i}
              className="size-8 rounded-full border"
              style={
                lleno ? { background: PRIMARIO, borderColor: PRIMARIO } : { borderColor: HUECO }
              }
              aria-hidden
            />
          ))}
        </div>

        <p className="mt-4 text-sm" style={{ color: TEXTO }}>
          {prog.completa
            ? `¡Listo! Enseña esta tarjeta para tu ${data.premio}.`
            : `Te faltan ${prog.faltan} para tu ${data.premio}.`}
        </p>

        <div className="mt-10 text-center">
          <p className="text-xs" style={{ color: SUAVE }}>
            Enséñale esto al mesero
          </p>
          <div className="mx-auto mt-3 w-fit rounded-2xl bg-white p-4">
            <QRCode value={data.codigo} size={160} />
          </div>
          <p className="mt-4 font-mono text-3xl font-bold tracking-widest" style={{ color: TEXTO }}>
            {data.codigo}
          </p>
        </div>
      </div>
    </main>
  );
}
