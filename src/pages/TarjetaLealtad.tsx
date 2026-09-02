import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import QRCode from "react-qr-code";
import { Loader2 } from "lucide-react";
import { useGuardarContacto, useTarjeta, useTarjetaLocal } from "@/hooks/useLealtad";
import { progresoLealtad, rejillaSellos, validarCorreo, validarTelefono } from "@/lib/lealtad";
import { resolverTema, variablesDeTema } from "@/lib/tema";
import { supabase } from "@/lib/supabase";
import PhoneInput from "@/components/ui/phone-input";
import type { FormatoMenu } from "@/types/database";

/**
 * Tarjeta de lealtad del comensal, en `/:slug/lealtad/:tarjetaId`.
 *
 * Nombre del negocio, rejilla de sellos, avance y el código con su QR para que
 * el mesero lo lea; "guardar en este teléfono" (localStorage), respaldo opcional
 * de contacto (teléfono o correo, con consentimiento) y "cómo funciona".
 *
 * Ruta sin `loader`: la tarjeta es privada del comensal, se pide desde el
 * navegador con `useTarjeta`. El tema del negocio se trae aparte (consulta
 * ligera a `tenants`, de lectura pública) y se aplica al `<main>`; los tokens
 * `--menu-*` conservan su respaldo literal por si la consulta aún no resuelve.
 */
const FONDO = "var(--menu-fondo, #ffffff)";
const TEXTO = "var(--menu-texto, #0b0b0f)";
const SUAVE = "var(--menu-texto-suave, #6b7280)";
const PRIMARIO = "var(--menu-primario, #111827)";
const BORDE = "color-mix(in srgb, var(--menu-texto, #0b0b0f) 12%, transparent)";
const HUECO = "color-mix(in srgb, var(--menu-texto, #0b0b0f) 25%, transparent)";

export default function TarjetaLealtad({ slug, tarjetaId }: { slug: string; tarjetaId: string }) {
  const navigate = useNavigate();
  const { uuid, guardar, olvidar } = useTarjetaLocal(slug);
  const { data, isLoading, isError, isFetched } = useTarjeta(slug, tarjetaId);
  const guardarContacto = useGuardarContacto(tarjetaId);

  const tema = useQuery({
    queryKey: ["tema-tenant", slug],
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("tema, formato_activo")
        .eq("slug", slug)
        .maybeSingle();
      return data;
    },
  });
  const estilo = tema.data
    ? variablesDeTema(resolverTema(tema.data.tema, tema.data.formato_activo as FormatoMenu))
    : {};

  // Respaldo de contacto: colapsado por defecto.
  const [respaldoAbierto, setRespaldoAbierto] = useState(false);
  const [tipo, setTipo] = useState<"telefono" | "correo">("telefono");
  const [tel, setTel] = useState("");
  const [correo, setCorreo] = useState("");
  const [consent, setConsent] = useState(false);

  // La tarjeta ya no existe en el servidor (purga) y la clave local apunta a
  // ella: límpiala para que el banner del menú ofrezca crear una nueva.
  useEffect(() => {
    if (isFetched && !data && uuid === tarjetaId) olvidar();
  }, [isFetched, data, uuid, tarjetaId, olvidar]);

  // El slug de la URL no es el del negocio dueño de la tarjeta: redirige al
  // correcto para no pintar la tarjeta bajo el tema/localStorage equivocados.
  useEffect(() => {
    if (data && data.tenantSlug !== slug) {
      void navigate({
        to: "/$slug/lealtad/$tarjetaId",
        params: { slug: data.tenantSlug, tarjetaId },
        replace: true,
      });
    }
  }, [data, slug, tarjetaId, navigate]);

  if (isLoading) {
    return (
      <main className="min-h-screen" style={{ ...estilo, background: FONDO }}>
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
      <main
        className="grid min-h-screen place-items-center px-4"
        style={{ ...estilo, background: FONDO }}
      >
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

  if (data.tenantSlug !== slug) return null;

  const prog = progresoLealtad(data.sellos, data.sellosMeta);
  const rejilla = rejillaSellos(data.sellos, data.sellosMeta);

  const contactoValido = tipo === "telefono" ? validarTelefono(tel).ok : validarCorreo(correo);
  const puedeEnviar = contactoValido && consent && !guardarContacto.isPending;

  const enviarContacto = () => {
    if (!puedeEnviar) return;
    guardarContacto.mutate(
      {
        contacto: tipo === "telefono" ? validarTelefono(tel).e164! : correo.trim(),
        tipo,
        consent: true,
      },
      {
        onSuccess: () => {
          setRespaldoAbierto(false);
          setTel("");
          setCorreo("");
          setConsent(false);
        },
      },
    );
  };

  const guardadaAqui = uuid === tarjetaId;

  return (
    <main className="min-h-screen" style={{ ...estilo, background: FONDO }}>
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

        {/* Guardar en este teléfono */}
        <div className="mt-8 rounded-2xl border p-4" style={{ borderColor: BORDE }}>
          {guardadaAqui ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm" style={{ color: TEXTO }}>
                Guardada en este teléfono ✓
              </span>
              <button
                type="button"
                onClick={() => olvidar()}
                className="shrink-0 text-xs underline"
                style={{ color: SUAVE }}
              >
                Quitar de este teléfono
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm" style={{ color: SUAVE }}>
                Ábrela rápido la próxima vez.
              </span>
              <button
                type="button"
                onClick={() => guardar(tarjetaId)}
                className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold"
                style={{ background: PRIMARIO, color: FONDO }}
              >
                Guardar en este teléfono
              </button>
            </div>
          )}
        </div>

        {/* Respaldo opcional de contacto */}
        <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: BORDE }}>
          {data.tieneContacto && !respaldoAbierto ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm" style={{ color: TEXTO }}>
                  Respaldo: {data.contactoEnmascarado}
                </span>
                <span className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setRespaldoAbierto(true)}
                    className="text-xs underline"
                    style={{ color: SUAVE }}
                  >
                    Cambiar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      guardarContacto.mutate({ contacto: "", tipo: "telefono", consent: false })
                    }
                    className="text-xs underline"
                    style={{ color: SUAVE }}
                  >
                    Quitar
                  </button>
                </span>
              </div>
              {guardarContacto.isError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {(guardarContacto.error as Error).message}
                </p>
              )}
            </div>
          ) : !respaldoAbierto ? (
            <button
              type="button"
              onClick={() => setRespaldoAbierto(true)}
              className="text-sm font-medium underline"
              style={{ color: PRIMARIO }}
            >
              Guarda tu tarjeta con tu teléfono o correo
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviarContacto();
              }}
              className="space-y-3"
            >
              <div
                className="flex overflow-hidden rounded-lg border text-sm"
                style={{ borderColor: BORDE }}
              >
                {(["telefono", "correo"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={tipo === t}
                    onClick={() => setTipo(t)}
                    className="flex-1 px-3 py-2 font-medium"
                    style={
                      tipo === t
                        ? { background: PRIMARIO, color: FONDO }
                        : { color: SUAVE, background: "transparent" }
                    }
                  >
                    {t === "telefono" ? "Teléfono" : "Correo"}
                  </button>
                ))}
              </div>

              {tipo === "telefono" ? (
                <div>
                  <label className="sr-only" htmlFor="lealtad-tel">
                    Teléfono
                  </label>
                  <PhoneInput
                    id="lealtad-tel"
                    value={tel}
                    onChange={setTel}
                    placeholder="55 1234 5678"
                  />
                </div>
              ) : (
                <input
                  type="email"
                  aria-label="Correo"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[var(--menu-primario)]"
                  style={{ borderColor: BORDE, color: TEXTO }}
                />
              )}

              <label className="flex items-start gap-2 text-xs" style={{ color: SUAVE }}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 size-4"
                  style={{ accentColor: PRIMARIO }}
                />
                <span>
                  Acepto que {data.tenantNombre} guarde este dato para recuperar mi tarjeta y
                  enviarme promociones.{" "}
                  <a href="/privacidad" target="_blank" rel="noreferrer" className="underline">
                    Aviso de privacidad
                  </a>
                </span>
              </label>

              {guardarContacto.isError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {(guardarContacto.error as Error).message}
                </p>
              )}

              <button
                type="submit"
                disabled={!puedeEnviar}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                style={{ background: PRIMARIO, color: FONDO }}
              >
                {guardarContacto.isPending && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                Guardar respaldo
              </button>
            </form>
          )}
        </div>

        {/* Cómo funciona */}
        <div className="mt-8 space-y-1 text-xs" style={{ color: SUAVE }}>
          <p>Junta 1 sello por visita (máximo 1 al día).</p>
          <p>
            Al llegar a {data.sellosMeta} sellos, enseña tu tarjeta para tu {data.premio}.
          </p>
          <p>Si borras el navegador y no dejaste un teléfono o correo, la tarjeta se pierde.</p>
        </div>
      </div>
    </main>
  );
}
