import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, ExternalLink, ImagePlus, Link2, Loader2, Lock, Trash2 } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import MockupFormato from "@/components/landing/MockupFormato";
import ModalLimite from "@/components/admin/ModalLimite";
import DiagramaModo from "@/components/admin/DiagramaModo";
import VistaPreviaMenu from "@/components/admin/VistaPreviaMenu";
import SelectorFuente from "@/components/admin/SelectorFuente";
import { useTenantActual } from "@/hooks/useTenantActual";
import { useActualizarTenant } from "@/hooks/useActualizarTenant";
import { borrarImagen, subirImagen } from "@/hooks/useCarta";
import {
  fuentesDelPlan,
  modosImagenDelPlan,
  permiteColorModificadores,
  permiteDesenfoque,
  permiteImagenDeFondo,
  puedeDesbloquearOtroFormato,
} from "@/lib/plan";
import { MODOS_IMAGEN, resolverTema, type TemaTenant } from "@/lib/tema";
import { CLAVES_FUENTE } from "@/lib/fuentes";
import { traducirError, type ErrorTraducido } from "@/lib/errores";
import { BOTONES, ESTADOS } from "@/lib/copy";
import { avisarGuardado } from "@/lib/avisos";
import { FORMATOS, NOMBRE_FORMATO, type FormatoMenu } from "@/types/database";
import { cn } from "@/lib/utils";

export default function Diseno() {
  return (
    <AdminLayout>
      <Contenido />
    </AdminLayout>
  );
}

/** Etiqueta de "esto es de otro plan". */
function Candado({ nota }: { nota: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-vm-body" title={nota}>
      <Lock className="size-3" aria-hidden />
      {nota}
    </span>
  );
}

function Contenido() {
  const { data: ctx } = useTenantActual();
  const actualizar = useActualizarTenant(ctx?.tenant.id);
  const inputImagen = useRef<HTMLInputElement>(null);

  const [limite, setLimite] = useState<ErrorTraducido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const [tema, setTema] = useState<TemaTenant>((ctx?.tenant.tema ?? {}) as TemaTenant);
  // Solo se borra la imagen vieja si el guardado sale bien.
  const fondoOriginal = useRef(((ctx?.tenant.tema ?? {}) as TemaTenant).imagen_fondo_url ?? null);

  if (!ctx) return null;

  const { plan, tenant, formatosDesbloqueados } = ctx;
  const pool = plan.formatos_permitidos;
  const activo = tenant.formato_activo as FormatoMenu;

  const hayCupo = puedeDesbloquearOtroFormato(plan, formatosDesbloqueados);
  const fuentesPermitidas = fuentesDelPlan(plan);
  const modosPermitidos = modosImagenDelPlan(plan);
  const hayImagen = permiteImagenDeFondo(plan);
  const hayColorModif = permiteColorModificadores(plan);
  const hayDesenfoque = permiteDesenfoque(plan);

  // El tema se resuelve contra el formato ACTIVO: cada uno trae sus defaults.
  const preview = resolverTema(tema, activo);
  const urlMenu = `/${tenant.slug}`;

  function parche(cambio: Partial<TemaTenant>) {
    setTema({ ...tema, ...cambio });
  }

  async function elegirFormato(f: FormatoMenu) {
    setError(null);
    const yaEsta = formatosDesbloqueados.includes(f);
    try {
      await actualizar.mutateAsync({
        formato_activo: f,
        formatos_desbloqueados: yaEsta ? formatosDesbloqueados : [...formatosDesbloqueados, f],
      });
      avisarGuardado();
    } catch (err) {
      const t = traducirError(err as Error);
      if (t.esLimiteDePlan) setLimite(t);
      else setError(t.mensaje);
    }
  }

  async function alSubirImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError(null);
    setSubiendo(true);
    try {
      const url = await subirImagen(tenant.id, archivo, "fondos");
      parche({ imagen_fondo_url: url, modo_imagen: tema.modo_imagen ?? modosPermitidos[0] });
    } catch {
      setError(ESTADOS.errorImagen);
    } finally {
      setSubiendo(false);
    }
  }

  /** El trigger `validar_tema_tenant` rechaza cualquier clave fuera del plan. */
  async function guardarTema(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await actualizar.mutateAsync({ tema });

      const nuevo = tema.imagen_fondo_url ?? null;
      if (fondoOriginal.current && fondoOriginal.current !== nuevo) {
        await borrarImagen(fondoOriginal.current);
      }
      fondoOriginal.current = nuevo;

      avisarGuardado();
    } catch (err) {
      const t = traducirError(err as Error);
      if (t.esLimiteDePlan) setLimite(t);
      else setError(t.mensaje);
    }
  }

  async function copiarEnlace() {
    await navigator.clipboard.writeText(window.location.origin + urlMenu);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <>
      <h1 className="text-2xl">Diseño</h1>
      <p className="mt-1 max-w-prose text-sm text-vm-body">
        Elige cómo se ve tu carta y ajústala a tu marca. El azul de Vibemenu nunca aparece en tu
        menú.
      </p>

      <div className="mt-6 gap-10 xl:grid xl:grid-cols-[1fr_320px]">
        {/* ── Vista previa ─────────────────────────────────────
            En móvil queda pegada arriba mientras bajas por las opciones.
            En escritorio vive en la columna derecha, también pegada. */}
        <aside className="sticky top-0 z-20 -mx-4 mb-6 border-b bg-white/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8 xl:order-2 xl:mx-0 xl:mb-0 xl:self-start xl:border-0 xl:bg-transparent xl:px-0 xl:py-0 xl:backdrop-blur-none">
          <div className="mx-auto flex max-w-[220px] items-center justify-between gap-3 xl:max-w-none">
            <p className="text-xs font-medium text-vm-ink xl:text-sm">Vista previa</p>
            <span className="rounded-full bg-vm-bg-soft px-2 py-0.5 text-[11px] text-vm-body">
              {NOMBRE_FORMATO[activo]}
            </span>
          </div>

          <div className="mx-auto mt-2 max-w-[220px] xl:mt-3 xl:max-w-none">
            <VistaPreviaMenu tema={preview} formato={activo} />
          </div>

          <p className="mt-3 hidden text-xs text-vm-body xl:block">
            Los cambios se ven aquí antes de guardarlos. Cada formato tiene su propia anatomía.
          </p>
        </aside>

        {/* ── Opciones ─────────────────────────────────────── */}
        <form onSubmit={guardarTema} className="min-w-0 space-y-10 xl:order-1">
          {/* Formatos */}
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg">Formato del menú</h2>
              <p className="text-xs text-vm-body">
                {plan.limite_formatos === null
                  ? "Los 4 incluidos"
                  : plan.limite_formatos === 1
                    ? "Solo Clásico"
                    : `${formatosDesbloqueados.length} de ${plan.limite_formatos} desbloqueados`}
              </p>
            </div>

            {/* Carrusel táctil en móvil, rejilla desde md. */}
            <div className="tira-scroll -mx-4 mt-4 flex gap-3 px-4 pb-3 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 2xl:grid-cols-4">
              {FORMATOS.map((f) => {
                const fuera = !pool.includes(f);
                const esActivo = activo === f;
                const desbloqueado = formatosDesbloqueados.includes(f);
                const sinCupo = !fuera && !desbloqueado && !hayCupo;

                return (
                  <motion.div
                    key={f}
                    whileHover={fuera ? undefined : { y: -3 }}
                    className={cn(
                      "w-[62%] shrink-0 rounded-xl border bg-white p-3 md:w-auto",
                      esActivo && "border-2 border-vm-primary shadow-vm-2",
                      fuera && "opacity-60",
                    )}
                  >
                    <div className={cn(fuera && "grayscale")}>
                      <MockupFormato formato={f} />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-vm-ink">{NOMBRE_FORMATO[f]}</p>
                      {esActivo && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-vm-primary">
                          <Check className="size-3.5" aria-hidden />
                          Activo
                        </span>
                      )}
                      {fuera && <Lock className="size-3.5 text-vm-body" aria-hidden />}
                    </div>

                    {fuera ? (
                      <Link
                        to="/admin/suscripcion"
                        className="mt-3 flex h-10 items-center justify-center rounded-lg border text-xs font-medium text-vm-ink hover:bg-vm-bg-soft"
                      >
                        Actualizar plan
                      </Link>
                    ) : esActivo ? (
                      <p className="mt-3 flex h-10 items-center justify-center text-xs text-vm-body">
                        Es el que ven tus clientes
                      </p>
                    ) : (
                      <button
                        type="button"
                        disabled={sinCupo || actualizar.isPending}
                        onClick={() => void elegirFormato(f)}
                        title={
                          sinCupo ? `Tu plan permite ${plan.limite_formatos} formatos.` : undefined
                        }
                        className="mt-3 flex h-10 w-full items-center justify-center rounded-lg bg-vm-primary text-xs font-medium text-white hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {desbloqueado ? "Usar este" : "Desbloquear"}
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </section>

          {/* Tipografía, en lista */}
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg">Tipografía</h2>
              <p className="text-xs text-vm-body">
                {fuentesPermitidas.length} de {CLAVES_FUENTE.length} en tu plan
              </p>
            </div>

            <div className="mt-4">
              <SelectorFuente
                valor={preview.fuente}
                permitidas={fuentesPermitidas}
                alElegir={(f) => parche({ fuente: f, tipografia: undefined })}
              />
            </div>

            {fuentesPermitidas.length < CLAVES_FUENTE.length && (
              <Link
                to="/admin/suscripcion"
                className="mt-3 inline-block text-xs font-medium text-vm-primary hover:underline"
              >
                Desbloquea las {CLAVES_FUENTE.length} tipografías →
              </Link>
            )}
          </section>

          {/* Colores */}
          <section>
            <h2 className="text-lg">Colores</h2>
            {/* Horizontal, bajando de línea si no cabe.
                Cada color: etiqueta arriba, muestra en medio, hexadecimal abajo. */}
            <div className="mt-4 flex flex-wrap gap-4">
              {(
                [
                  ["color_primario", "Acento", true],
                  ["color_fondo", "Fondo", true],
                  ["color_texto", "Texto", true],
                  ["color_modificadores", "Modificadores", hayColorModif],
                ] as const
              ).map(([clave, etiqueta, permitido]) => (
                <div key={clave} className="w-[120px]">
                  <label
                    htmlFor={clave}
                    className="block truncate text-center text-xs font-medium text-vm-ink"
                  >
                    {etiqueta}
                  </label>

                  <input
                    id={clave}
                    type="color"
                    disabled={!permitido}
                    value={preview[clave]}
                    onChange={(e) => parche({ [clave]: e.target.value })}
                    className="mt-1.5 h-12 w-full cursor-pointer rounded-lg border disabled:cursor-not-allowed disabled:opacity-50"
                  />

                  <span className="vm-data mt-1 block text-center text-[11px] uppercase text-vm-body">
                    {preview[clave]}
                  </span>

                  {!permitido && (
                    <span className="mt-1 flex justify-center">
                      <Candado nota="Basic" />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Imagen de fondo */}
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg">Imagen de fondo</h2>
              {!hayImagen && <Candado nota="Parte de Basic" />}
            </div>

            {!hayImagen ? (
              <div className="mt-4 rounded-xl border border-dashed p-6">
                <p className="text-sm text-vm-body">
                  Ponle una foto de tu local a tu carta. Está incluido desde Basic.
                </p>
                <div className="mt-4 grid max-w-md gap-3 sm:grid-cols-2">
                  <div className="opacity-50">
                    <DiagramaModo modo="marco" imagen={null} />
                    <p className="mt-1.5 text-xs text-vm-body">Marco</p>
                  </div>
                  <div className="opacity-50">
                    <DiagramaModo modo="completo" imagen={null} desenfoque />
                    <p className="mt-1.5 text-xs text-vm-body">Fondo completo</p>
                  </div>
                </div>
                <Link
                  to="/admin/suscripcion"
                  className="mt-5 inline-flex h-11 items-center rounded-lg bg-vm-primary px-5 text-sm font-medium text-white"
                >
                  Actualizar plan
                </Link>
              </div>
            ) : (
              <>
                <input
                  ref={inputImagen}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={alSubirImagen}
                  className="sr-only"
                />

                {tema.imagen_fondo_url ? (
                  <div className="mt-4 flex items-center gap-3">
                    <img
                      src={tema.imagen_fondo_url}
                      alt=""
                      className="h-20 w-32 rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => parche({ imagen_fondo_url: null, modo_imagen: "ninguno" })}
                      className="inline-flex items-center gap-1.5 text-sm text-vm-danger hover:underline"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Quitar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => inputImagen.current?.click()}
                    disabled={subiendo}
                    className="mt-4 flex h-28 w-full max-w-md flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-sm text-vm-body hover:bg-vm-bg-soft"
                  >
                    {subiendo ? (
                      <Loader2 className="size-5 animate-spin" aria-hidden />
                    ) : (
                      <ImagePlus className="size-5" aria-hidden />
                    )}
                    {subiendo ? "Subiendo…" : "Sube una foto en JPG o PNG"}
                  </button>
                )}

                {activo === "tiktok" && tema.imagen_fondo_url && (
                  <p className="mt-3 max-w-xl rounded-lg bg-vm-warning-soft px-3.5 py-2.5 text-xs text-vm-warning">
                    El formato TikTok ocupa la pantalla con tus fotos y videos, así que la imagen de
                    fondo no se usa mientras esté activo.
                  </p>
                )}

                <p className="mt-6 text-sm font-medium text-vm-ink">Cómo se usa la foto</p>
                <div className="tira-scroll -mx-4 mt-3 flex gap-3 px-4 pb-3 sm:mx-0 sm:grid sm:max-w-2xl sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0">
                  {(["ninguno", "marco", "completo"] as const).map((modo) => {
                    const permitido = modo === "ninguno" || modosPermitidos.includes(modo);
                    const seleccionado = preview.modo_imagen === modo;
                    const sinFoto = modo !== "ninguno" && !tema.imagen_fondo_url;

                    return (
                      <button
                        key={modo}
                        type="button"
                        disabled={!permitido || sinFoto}
                        onClick={() => parche({ modo_imagen: modo })}
                        className={cn(
                          "w-[58%] shrink-0 rounded-xl border p-2.5 text-left transition-colors sm:w-auto",
                          seleccionado && "border-2 border-vm-primary",
                          (!permitido || sinFoto) && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <DiagramaModo
                          modo={modo}
                          imagen={tema.imagen_fondo_url ?? null}
                          desenfoque={preview.desenfoque_texto}
                        />
                        <div className="mt-2 flex items-center justify-between gap-1">
                          <span className="text-xs font-medium text-vm-ink">
                            {modo === "ninguno" ? "Sin foto" : MODOS_IMAGEN[modo].nombre}
                          </span>
                          {!permitido && <Lock className="size-3 text-vm-body" aria-hidden />}
                        </div>
                        <p className="mt-0.5 text-[11px] leading-snug text-vm-body">
                          {modo === "ninguno" ? "Solo color de fondo." : MODOS_IMAGEN[modo].nota}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <label
                  className={cn(
                    "mt-4 flex max-w-xl items-start gap-3 rounded-xl border p-4",
                    !hayDesenfoque && "opacity-70",
                  )}
                >
                  <input
                    type="checkbox"
                    disabled={!hayDesenfoque || preview.modo_imagen === "ninguno"}
                    checked={preview.desenfoque_texto}
                    onChange={(e) => parche({ desenfoque_texto: e.target.checked })}
                    className="mt-0.5 size-4 accent-vm-primary"
                  />
                  <span className="flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-vm-ink">
                      Desenfocar la foto de fondo
                      {!hayDesenfoque && <Lock className="size-3" aria-hidden />}
                    </span>
                    <span className="mt-0.5 block text-xs text-vm-body">
                      {hayDesenfoque
                        ? "Una foto muy cargada hace ilegible el precio. En fondo completo se difumina detrás del texto; en modo marco se difumina todo el marco y la carta lo deja translucir."
                        : "El desenfoque de la foto es parte de Pro."}
                    </span>
                  </span>
                </label>
              </>
            )}
          </section>

          {error && (
            <p className="rounded-lg bg-vm-danger-soft px-3.5 py-2.5 text-sm text-vm-danger">
              {error}
            </p>
          )}

          {/* ── Barra de acciones, pegada abajo ─────────────────
              Antes había que bajar hasta el final para guardar y volver arriba
              para copiar el enlace o ver el menú. Ahora viven juntas. */}
          <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t bg-white/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
            <button
              type="submit"
              disabled={actualizar.isPending || subiendo}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-vm-primary px-6 text-sm font-medium text-white hover:bg-vm-primary-hover disabled:opacity-50 sm:flex-none"
            >
              {actualizar.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {BOTONES.guardarCambios}
            </button>

            <button
              type="button"
              onClick={() => void copiarEnlace()}
              className="inline-flex h-12 items-center gap-1.5 rounded-lg border px-4 text-sm text-vm-ink hover:bg-vm-bg-soft"
            >
              <Link2 className="size-4" aria-hidden />
              {copiado ? "Copiado" : BOTONES.copiarLink}
            </button>

            <a
              href={urlMenu}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center gap-1.5 rounded-lg border px-4 text-sm text-vm-ink hover:bg-vm-bg-soft"
            >
              <ExternalLink className="size-4" aria-hidden />
              <span className="hidden sm:inline">Ver mi menú</span>
            </a>
          </div>
        </form>
      </div>

      <ModalLimite error={limite} alCerrar={() => setLimite(null)} />
    </>
  );
}
