import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, ImagePlus, Loader2, Lock, Trash2 } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import MockupFormato from "@/components/landing/MockupFormato";
import ModalLimite from "@/components/admin/ModalLimite";
import DiagramaModo from "@/components/admin/DiagramaModo";
import VistaPreviaMenu from "@/components/admin/VistaPreviaMenu";
import { useTenantActual } from "@/hooks/useTenantActual";
import { useActualizarTenant } from "@/hooks/useActualizarTenant";
import { subirImagen } from "@/hooks/useCarta";
import {
  fuentesDelPlan,
  modosImagenDelPlan,
  permiteColorModificadores,
  permiteDesenfoque,
  permiteImagenDeFondo,
  puedeDesbloquearOtroFormato,
} from "@/lib/plan";
import { MODOS_IMAGEN, resolverTema, type ModoImagen, type TemaTenant } from "@/lib/tema";
import { CLAVES_FUENTE, FUENTES, type ClaveFuente } from "@/lib/fuentes";
import { traducirError, type ErrorTraducido } from "@/lib/errores";
import { BOTONES, ESTADOS } from "@/lib/copy";
import { FORMATOS, NOMBRE_FORMATO, type FormatoMenu } from "@/types/database";
import { cn } from "@/lib/utils";

export default function Diseno() {
  return (
    <AdminLayout>
      <Contenido />
    </AdminLayout>
  );
}

/** Etiqueta de "esto es de otro plan", reutilizada en fuentes, colores y modos. */
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
  const [guardado, setGuardado] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  const [tema, setTema] = useState<TemaTenant>((ctx?.tenant.tema ?? {}) as TemaTenant);

  if (!ctx) return null;

  const { plan, tenant, formatosDesbloqueados } = ctx;
  const pool = plan.formatos_permitidos;
  const hayCupo = puedeDesbloquearOtroFormato(plan, formatosDesbloqueados);

  const fuentesPermitidas = fuentesDelPlan(plan);
  const hayImagen = permiteImagenDeFondo(plan);
  const modosPermitidos = modosImagenDelPlan(plan);
  const hayColorModif = permiteColorModificadores(plan);
  const hayDesenfoque = permiteDesenfoque(plan);

  const preview = resolverTema(tema, tenant.formato_activo as FormatoMenu);

  function parche(cambio: Partial<TemaTenant>) {
    setGuardado(false);
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
      // Al subir la primera imagen se activa el primer modo que el plan permita.
      parche({ imagen_fondo_url: url, modo_imagen: tema.modo_imagen ?? modosPermitidos[0] });
    } catch {
      setError(ESTADOS.errorImagen);
    } finally {
      setSubiendo(false);
    }
  }

  /**
   * El trigger `validar_tema_tenant` rechaza cualquier clave que el plan no permita.
   * La UI las esconde, pero la garantia esta en Postgres.
   */
  async function guardarTema(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardado(false);
    try {
      await actualizar.mutateAsync({ tema });
      setGuardado(true);
    } catch (err) {
      const t = traducirError(err as Error);
      if (t.esLimiteDePlan) setLimite(t);
      else setError(t.mensaje);
    }
  }

  return (
    <>
      <h1 className="text-2xl">Diseño</h1>
      <p className="mt-1 max-w-prose text-sm text-vm-body">
        Elige cómo se ve tu carta y ajústala a tu marca. El azul de Vibemenu nunca aparece en tu
        menú.
      </p>

      {/* ── Formatos ─────────────────────────────────────── */}
      <h2 className="mt-9 text-lg">Formato del menú</h2>
      <p className="mt-1 text-sm text-vm-body">
        {plan.limite_formatos === null
          ? "Tu plan incluye los 4 formatos."
          : plan.limite_formatos === 1
            ? "Tu plan incluye el formato Clásico."
            : `Tu plan permite ${plan.limite_formatos} formatos. Llevas ${formatosDesbloqueados.length}.`}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {FORMATOS.map((f) => {
          const fuera = !pool.includes(f);
          const activo = tenant.formato_activo === f;
          const desbloqueado = formatosDesbloqueados.includes(f);
          const sinCupo = !fuera && !desbloqueado && !hayCupo;

          return (
            <motion.div
              key={f}
              whileHover={fuera ? undefined : { y: -3 }}
              className={cn(
                "rounded-xl border bg-white p-3",
                activo && "border-2 border-vm-primary shadow-vm-2",
                fuera && "opacity-60",
              )}
            >
              <div className={cn(fuera && "grayscale")}>
                <MockupFormato formato={f} />
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-vm-ink">{NOMBRE_FORMATO[f]}</p>
                {activo && (
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
              ) : activo ? (
                <p className="mt-3 flex h-10 items-center justify-center text-xs text-vm-body">
                  Es el que ven tus clientes
                </p>
              ) : (
                <button
                  type="button"
                  disabled={sinCupo || actualizar.isPending}
                  onClick={() => void elegirFormato(f)}
                  title={sinCupo ? `Tu plan permite ${plan.limite_formatos} formatos.` : undefined}
                  className="mt-3 flex h-10 w-full items-center justify-center rounded-lg bg-vm-primary text-xs font-medium text-white hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {desbloqueado ? "Usar este" : "Desbloquear"}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ── Tema ─────────────────────────────────────────── */}
      <div className="mt-12 grid gap-10 xl:grid-cols-[1fr_340px]">
        <form onSubmit={guardarTema} className="min-w-0 space-y-10">
          {/* Tipografía */}
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg">Tipografía</h2>
              <p className="text-xs text-vm-body">
                {fuentesPermitidas.length} de {CLAVES_FUENTE.length} disponibles en tu plan
              </p>
            </div>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {CLAVES_FUENTE.map((clave) => {
                const permitida = fuentesPermitidas.includes(clave);
                const activa = preview.fuente === clave;
                const f = FUENTES[clave];

                return (
                  <button
                    key={clave}
                    type="button"
                    disabled={!permitida}
                    onClick={() => parche({ fuente: clave, tipografia: undefined })}
                    className={cn(
                      "rounded-xl border p-3.5 text-left transition-colors",
                      activa && "border-2 border-vm-primary bg-vm-primary/5",
                      !permitida && "cursor-not-allowed bg-vm-bg-soft opacity-70",
                    )}
                  >
                    <p
                      className="truncate text-xl"
                      style={{ fontFamily: f.css, color: "var(--vm-ink)" }}
                    >
                      Flat White
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-vm-ink">{f.nombre}</span>
                      {permitida ? (
                        <span className="text-[11px] text-vm-body">{f.categoria}</span>
                      ) : (
                        <Lock className="size-3 text-vm-body" aria-hidden />
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-vm-body">{f.nota}</p>
                  </button>
                );
              })}
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
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["color_primario", "Acento", true],
                  ["color_fondo", "Fondo", true],
                  ["color_texto", "Texto", true],
                  ["color_modificadores", "Modificadores", hayColorModif],
                ] as const
              ).map(([clave, etiqueta, permitido]) => (
                <div key={clave}>
                  <label htmlFor={clave} className="text-sm font-medium text-vm-ink">
                    {etiqueta}
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      id={clave}
                      type="color"
                      disabled={!permitido}
                      value={preview[clave]}
                      onChange={(e) => parche({ [clave]: e.target.value })}
                      className="size-11 cursor-pointer rounded-lg border disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <span className="vm-data text-xs uppercase text-vm-body">{preview[clave]}</span>
                  </div>
                  {!permitido && <Candado nota="Parte de Basic" />}
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
                  accept="image/jpeg,image/png"
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

                {/* Modos, con ayuda visual de cómo se verá */}
                <p className="mt-6 text-sm font-medium text-vm-ink">Cómo se usa la foto</p>
                <div className="mt-3 grid max-w-2xl gap-3 sm:grid-cols-3">
                  {(["ninguno", "marco", "completo"] as const).map((modo) => {
                    const permitido = modo === "ninguno" || modosPermitidos.includes(modo);
                    const activo = preview.modo_imagen === modo;

                    return (
                      <button
                        key={modo}
                        type="button"
                        disabled={!permitido || (modo !== "ninguno" && !tema.imagen_fondo_url)}
                        onClick={() => parche({ modo_imagen: modo })}
                        className={cn(
                          "rounded-xl border p-2.5 text-left transition-colors",
                          activo && "border-2 border-vm-primary",
                          (!permitido || (modo !== "ninguno" && !tema.imagen_fondo_url)) &&
                            "cursor-not-allowed opacity-60",
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

                {/* Desenfoque: solo tiene sentido con fondo completo */}
                <label
                  className={cn(
                    "mt-6 flex max-w-xl items-start gap-3 rounded-xl border p-4",
                    !hayDesenfoque && "opacity-70",
                  )}
                >
                  <input
                    type="checkbox"
                    disabled={!hayDesenfoque || preview.modo_imagen !== "completo"}
                    checked={preview.desenfoque_texto}
                    onChange={(e) => parche({ desenfoque_texto: e.target.checked })}
                    className="mt-0.5 size-4 accent-vm-primary"
                  />
                  <span className="flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-vm-ink">
                      Desenfocar la foto detrás del texto
                      {!hayDesenfoque && <Lock className="size-3" aria-hidden />}
                    </span>
                    <span className="mt-0.5 block text-xs text-vm-body">
                      {hayDesenfoque
                        ? "Con fondo completo, una foto muy cargada hace ilegible el precio. Esto lo arregla."
                        : "El desenfoque detrás del texto es parte de Pro."}
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
          {guardado && (
            <p className="rounded-lg bg-vm-success-soft px-3.5 py-2.5 text-sm text-vm-success">
              {ESTADOS.exitoGuardar}
            </p>
          )}

          <button
            type="submit"
            disabled={actualizar.isPending || subiendo}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-vm-primary px-6 text-sm font-medium text-white hover:bg-vm-primary-hover disabled:opacity-50"
          >
            {actualizar.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {BOTONES.guardarCambios}
          </button>
        </form>

        <aside className="xl:sticky xl:top-8 xl:self-start">
          <p className="text-sm font-medium text-vm-ink">Vista previa</p>
          <div className="mt-3">
            <VistaPreviaMenu tema={preview} />
          </div>
          <p className="mt-3 text-xs text-vm-body">
            Los cambios se ven aquí antes de guardarlos. Incluye los modificadores, que es donde más
            se nota el color.
          </p>
        </aside>
      </div>

      <ModalLimite error={limite} alCerrar={() => setLimite(null)} />
    </>
  );
}
