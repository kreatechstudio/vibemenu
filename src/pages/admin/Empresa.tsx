import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Check, ImagePlus, Loader2, Trash2 } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useTenantActual } from "@/hooks/useTenantActual";
import { useActualizarTenant } from "@/hooks/useActualizarTenant";
import { borrarImagen, subirImagen } from "@/hooks/useCarta";
import { useSlugDisponible } from "@/hooks/useSlugDisponible";
import { traducirError } from "@/lib/errores";
import { esUrlValida } from "@/lib/url";
import { avisarGuardado } from "@/lib/avisos";
import { MENSAJE_ERROR_SLUG, normalizarSlug } from "@/lib/slug";
import { BOTONES, ESTADOS } from "@/lib/copy";
import { EMPRESA } from "@/lib/legal";
import { cn } from "@/lib/utils";

export default function Empresa() {
  return (
    <AdminLayout>
      <Contenido />
    </AdminLayout>
  );
}

const MAX_DESCRIPCION = 200;

/**
 * Las cuatro van en `tenants`, no en `sucursales`: una cafetería tiene un
 * Instagram aunque tenga cinco locales. El mapa sí es de cada sucursal.
 */
type ClaveRed = "instagram_url" | "facebook_url" | "tiktok_url" | "google_reviews_url";

const REDES: { clave: ClaveRed; etiqueta: string; marcador: string }[] = [
  { clave: "instagram_url", etiqueta: "Instagram", marcador: "https://instagram.com/tunegocio" },
  { clave: "facebook_url", etiqueta: "Facebook", marcador: "https://facebook.com/tunegocio" },
  { clave: "tiktok_url", etiqueta: "TikTok", marcador: "https://tiktok.com/@tunegocio" },
  {
    clave: "google_reviews_url",
    etiqueta: "Reseñas en Google",
    marcador: "https://g.page/r/…/review",
  },
];

/** Una tarjeta por bloque: identidad, enlace público, contacto. */
function Bloque({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border p-5 sm:p-6">
      <h2 className="text-sm font-medium text-vm-ink">{titulo}</h2>
      {nota && <p className="mt-1 max-w-prose text-xs text-vm-body">{nota}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Contenido() {
  const { data: ctx } = useTenantActual();
  const tenant = ctx?.tenant;
  const actualizar = useActualizarTenant(tenant?.id);
  const inputLogo = useRef<HTMLInputElement>(null);

  const [nombre, setNombre] = useState(tenant?.nombre_negocio ?? "");
  const [giro, setGiro] = useState(tenant?.giro ?? "");
  const [descripcion, setDescripcion] = useState(tenant?.descripcion ?? "");
  const [slug, setSlug] = useState(tenant?.slug ?? "");
  const [telefono, setTelefono] = useState(tenant?.telefono ?? "");
  const [whatsapp, setWhatsapp] = useState(tenant?.whatsapp ?? "");
  const [logoUrl, setLogoUrl] = useState(tenant?.logo_url ?? "");

  // Sin la migración 007 estas columnas llegan como `undefined`, no como null.
  const [redes, setRedes] = useState<Record<ClaveRed, string>>({
    instagram_url: tenant?.instagram_url ?? "",
    facebook_url: tenant?.facebook_url ?? "",
    tiktok_url: tenant?.tiktok_url ?? "",
    google_reviews_url: tenant?.google_reviews_url ?? "",
  });

  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Su propio slug siempre está "ocupado": lo ocupa él. No es un conflicto.
  const cambioSlug = tenant ? slug !== tenant.slug : false;
  const estadoSlug = useSlugDisponible(cambioSlug ? slug : "");

  if (!ctx || !tenant) return null;

  // TS no estrecha `tenant` dentro de las funciones de abajo: se captura aquí.
  const tenantId = tenant.id;
  const logoOriginal = tenant.logo_url ?? "";
  const slugInvalido =
    cambioSlug &&
    (estadoSlug.estado === "invalido" ||
      estadoSlug.estado === "ocupado" ||
      estadoSlug.estado === "reservado" ||
      estadoSlug.estado === "vacio");

  async function alElegirLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError(null);
    setSubiendo(true);
    try {
      // Se comprime a WebP de 512px: un logo no necesita más.
      setLogoUrl(await subirImagen(tenantId, archivo, "logos"));
    } catch {
      setError(ESTADOS.errorImagen);
    } finally {
      setSubiendo(false);
    }
  }

  async function alGuardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Un enlace mal escrito rompe el icono en el menú de un comensal, no aquí.
    const limpias = {} as Record<ClaveRed, string | null>;
    for (const { clave, etiqueta } of REDES) {
      const valor = redes[clave].trim();
      if (valor && !esUrlValida(valor)) {
        setError(`El enlace de ${etiqueta} debe empezar por https://`);
        return;
      }
      limpias[clave] = valor || null;
    }

    try {
      await actualizar.mutateAsync({
        nombre_negocio: nombre.trim(),
        giro: giro.trim() || null,
        descripcion: descripcion.trim() || null,
        slug: slug.trim(),
        telefono: telefono.trim() || null,
        whatsapp: whatsapp.trim() || null,
        logo_url: logoUrl || null,
        ...limpias,
      });

      // El logo viejo solo se borra si el guardado salió bien.
      if (logoOriginal && logoOriginal !== logoUrl) await borrarImagen(logoOriginal);

      avisarGuardado();
    } catch (err) {
      setError(traducirError(err as Error).mensaje);
    }
  }

  return (
    <form onSubmit={alGuardar}>
      <h1 className="text-2xl">Datos de tu negocio</h1>
      <p className="mt-1 max-w-prose text-sm text-vm-body">
        Es lo que ve el comensal al abrir tu menú, y lo que se imprime en tu QR.
      </p>

      <div className="mt-7 grid max-w-4xl gap-5">
        <Bloque titulo="Identidad">
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="shrink-0">
              <input
                ref={inputLogo}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={alElegirLogo}
                className="sr-only"
              />

              {logoUrl ? (
                <div className="text-center">
                  <img
                    src={logoUrl}
                    alt="Logo de tu negocio"
                    className="size-28 rounded-full border object-cover"
                  />
                  <div className="mt-2 flex items-center justify-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => inputLogo.current?.click()}
                      className="font-medium text-vm-primary hover:underline"
                    >
                      Cambiar
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoUrl("")}
                      className="inline-flex items-center gap-1 text-vm-danger hover:underline"
                    >
                      <Trash2 className="size-3" aria-hidden />
                      Quitar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={subiendo}
                  onClick={() => inputLogo.current?.click()}
                  className="grid size-28 place-items-center gap-1 rounded-full border border-dashed text-xs text-vm-body hover:bg-vm-bg-soft"
                >
                  {subiendo ? (
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                  ) : (
                    <>
                      <ImagePlus className="size-5" aria-hidden />
                      Logo
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-5">
              <div>
                <label htmlFor="e-nombre" className="text-sm font-medium text-vm-ink">
                  Nombre del negocio
                </label>
                <input
                  id="e-nombre"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
                />
              </div>

              <div>
                <label htmlFor="e-giro" className="text-sm font-medium text-vm-ink">
                  Giro <span className="font-normal text-vm-body">(opcional)</span>
                </label>
                <input
                  id="e-giro"
                  value={giro}
                  onChange={(e) => setGiro(e.target.value)}
                  placeholder="Cafetería de especialidad"
                  className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
                />
              </div>

              <div>
                <label htmlFor="e-desc" className="text-sm font-medium text-vm-ink">
                  Descripción <span className="font-normal text-vm-body">(opcional)</span>
                </label>
                <textarea
                  id="e-desc"
                  rows={3}
                  maxLength={MAX_DESCRIPCION}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Tostamos nuestro café cada semana, a media cuadra del zócalo."
                  className="mt-2 w-full resize-none rounded-lg border p-3 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
                />
                <p className="mt-1 text-right text-xs text-vm-body">
                  <span className="vm-data">
                    {descripcion.length}/{MAX_DESCRIPCION}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </Bloque>

        <Bloque
          titulo="Tu enlace público"
          nota="Es la dirección a la que apunta tu código QR y el enlace que compartes."
        >
          <label htmlFor="e-slug" className="sr-only">
            Dirección web
          </label>
          <div className="flex h-12 items-center rounded-lg border pl-4 focus-within:border-vm-primary focus-within:ring-2 focus-within:ring-vm-primary/20">
            <span className="vm-data shrink-0 text-sm text-vm-body">{EMPRESA.dominio}/</span>
            <input
              id="e-slug"
              required
              value={slug}
              onChange={(e) => setSlug(normalizarSlug(e.target.value))}
              className="vm-data h-full min-w-0 flex-1 rounded-r-lg pr-4 text-sm outline-none"
            />
            {cambioSlug && estadoSlug.estado === "verificando" && (
              <Loader2 className="mr-4 size-4 shrink-0 animate-spin text-vm-body" aria-hidden />
            )}
            {cambioSlug && estadoSlug.estado === "disponible" && (
              <Check className="mr-4 size-4 shrink-0 text-vm-success" aria-hidden />
            )}
          </div>

          {cambioSlug && estadoSlug.estado === "invalido" && (
            <p className="mt-2 text-xs text-vm-danger">{MENSAJE_ERROR_SLUG[estadoSlug.motivo]}</p>
          )}
          {cambioSlug && estadoSlug.estado === "ocupado" && (
            <p className="mt-2 text-xs text-vm-danger">Ese nombre ya está en uso.</p>
          )}
          {cambioSlug && estadoSlug.estado === "reservado" && (
            <p className="mt-2 text-xs text-vm-danger">Esa palabra está reservada.</p>
          )}

          {/* El QR impreso apunta al slug viejo. Nadie debería descubrir esto en la mesa. */}
          {cambioSlug && !slugInvalido && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex gap-2 rounded-lg bg-vm-warning-soft px-3.5 py-3 text-xs text-vm-warning"
            >
              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
              <span>
                Si cambias tu enlace, los QR que ya imprimiste dejarán de funcionar. Tendrás que
                volver a imprimirlos desde la pantalla de QR.
              </span>
            </motion.p>
          )}
        </Bloque>

        <Bloque
          titulo="Contacto"
          nota="Los de tu negocio. Cada sucursal puede tener los suyos, y esos mandan en su menú."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="e-tel" className="text-sm font-medium text-vm-ink">
                Teléfono
              </label>
              <input
                id="e-tel"
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+52 55 1234 5678"
                className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
              />
            </div>
            <div>
              <label htmlFor="e-wa" className="text-sm font-medium text-vm-ink">
                WhatsApp
              </label>
              <input
                id="e-wa"
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+52 55 1234 5678"
                className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
              />
            </div>
          </div>
        </Bloque>

        <Bloque
          titulo="Redes sociales"
          nota="Salen como iconos en la cabecera de tu menú, con los colores que elegiste en Diseño. Deja vacío lo que no uses."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            {REDES.map(({ clave, etiqueta, marcador }) => (
              <div key={clave}>
                <label htmlFor={`e-${clave}`} className="text-sm font-medium text-vm-ink">
                  {etiqueta}
                </label>
                <input
                  id={`e-${clave}`}
                  type="url"
                  inputMode="url"
                  value={redes[clave]}
                  onChange={(e) => setRedes({ ...redes, [clave]: e.target.value })}
                  placeholder={marcador}
                  className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
                />
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-vm-body">
            Para las reseñas, en tu ficha de Google entra a «Pedir reseñas» y copia el enlace corto.
            Lleva al comensal directo a escribir su calificación.
          </p>
        </Bloque>

        {error && (
          <p className="rounded-lg bg-vm-danger-soft px-4 py-3 text-sm text-vm-danger">{error}</p>
        )}
      </div>

      {/* El formulario es largo: el botón viaja con el scroll, como en Diseño. */}
      <div className="sticky bottom-0 -mx-4 mt-6 flex items-center justify-end border-t bg-white/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <button
          type="submit"
          disabled={actualizar.isPending || subiendo || slugInvalido}
          className={cn(
            "inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-vm-primary px-6 text-sm font-medium text-white hover:bg-vm-primary-hover",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {actualizar.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {BOTONES.guardarCambios}
        </button>
      </div>
    </form>
  );
}
