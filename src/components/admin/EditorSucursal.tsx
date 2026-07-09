import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import {
  cruzaMedianoche,
  DIAS,
  useGuardarSucursal,
  useHorarios,
  zonasHorarias,
  type BorradorHorario,
} from "@/hooks/useSucursales";
import { traducirError, type ErrorTraducido } from "@/lib/errores";
import { normalizarSlug } from "@/lib/slug";
import { BOTONES } from "@/lib/copy";
import type { Sucursal } from "@/types/database";

/** Lunes a domingo en pantalla, pero se guarda con 0 = domingo, como en la base. */
const ORDEN_VISUAL = [1, 2, 3, 4, 5, 6, 0];

const HORARIO_VACIO = (dia: number): BorradorHorario => ({
  dia_semana: dia,
  cerrado: false,
  hora_apertura: "09:00",
  hora_cierre: "18:00",
});

export default function EditorSucursal({
  tenantId,
  sucursal,
  alCerrar,
  alTopar,
}: {
  tenantId: string;
  sucursal: Sucursal | null;
  alCerrar: () => void;
  alTopar: (e: ErrorTraducido) => void;
}) {
  const esNueva = sucursal === null;
  const { data: horariosGuardados, isLoading: cargandoHorarios } = useHorarios(sucursal?.id);
  const guardar = useGuardarSucursal(tenantId);

  const [nombre, setNombre] = useState(sucursal?.nombre ?? "");
  const [slug, setSlug] = useState(sucursal?.slug ?? "");
  const [slugTocado, setSlugTocado] = useState(!esNueva);
  const [direccion, setDireccion] = useState(sucursal?.direccion ?? "");
  const [telefono, setTelefono] = useState(sucursal?.telefono ?? "");
  const [whatsapp, setWhatsapp] = useState(sucursal?.whatsapp ?? "");
  const [timezone, setTimezone] = useState(sucursal?.timezone ?? "America/Mexico_City");
  const [error, setError] = useState<string | null>(null);

  const [horarios, setHorarios] = useState<Record<number, BorradorHorario> | null>(null);

  const zonas = useMemo(() => zonasHorarias(), []);

  // Hasta que llegan los guardados, se muestran los de por defecto.
  const filas: Record<number, BorradorHorario> =
    horarios ??
    Object.fromEntries(
      ORDEN_VISUAL.map((d) => {
        const guardado = horariosGuardados?.find((h) => h.dia_semana === d);
        return [
          d,
          guardado
            ? {
                dia_semana: d,
                cerrado: guardado.cerrado,
                hora_apertura: guardado.hora_apertura?.slice(0, 5) ?? null,
                hora_cierre: guardado.hora_cierre?.slice(0, 5) ?? null,
              }
            : HORARIO_VACIO(d),
        ];
      }),
    );

  function editarDia(dia: number, cambio: Partial<BorradorHorario>) {
    setHorarios({ ...filas, [dia]: { ...filas[dia], ...cambio } });
  }

  function alCambiarNombre(v: string) {
    setNombre(v);
    if (!slugTocado) setSlug(normalizarSlug(v));
  }

  async function alGuardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      await guardar.mutateAsync({
        id: sucursal?.id,
        datos: {
          nombre: nombre.trim(),
          slug: slug.trim(),
          direccion: direccion.trim() || null,
          telefono: telefono.trim() || null,
          whatsapp: whatsapp.trim() || null,
          timezone,
        },
        horarios: ORDEN_VISUAL.map((d) => filas[d]),
      });
      alCerrar();
    } catch (err) {
      const traducido = traducirError(err as Error);
      if (traducido.esLimiteDePlan) {
        alTopar(traducido);
        alCerrar();
        return;
      }
      setError(traducido.mensaje);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={alCerrar} aria-hidden />

      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white"
        role="dialog"
        aria-modal="true"
        aria-label={esNueva ? "Nueva sucursal" : `Editar ${sucursal.nombre}`}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
          <h2 className="text-lg">{esNueva ? "Nueva sucursal" : "Editar sucursal"}</h2>
          <button type="button" onClick={alCerrar} aria-label="Cerrar" className="text-vm-body">
            <X className="size-5" />
          </button>
        </header>

        {/* Sin los horarios reales cargados, guardar sobreescribiria los guardados
            con los valores por defecto. Se espera a que lleguen. */}
        {cargandoHorarios ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-vm-body" aria-label="Cargando horarios" />
          </div>
        ) : (
          <form onSubmit={alGuardar} className="flex-1 space-y-5 p-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="s-nombre" className="text-sm font-medium text-vm-ink">
                  Nombre
                </label>
                <input
                  id="s-nombre"
                  required
                  value={nombre}
                  onChange={(e) => alCambiarNombre(e.target.value)}
                  placeholder="Centro Histórico"
                  className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
                />
              </div>
              <div>
                <label htmlFor="s-slug" className="text-sm font-medium text-vm-ink">
                  Dirección web
                </label>
                <input
                  id="s-slug"
                  required
                  value={slug}
                  onChange={(e) => {
                    setSlugTocado(true);
                    setSlug(normalizarSlug(e.target.value));
                  }}
                  placeholder="centro"
                  className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary"
                />
              </div>
            </div>

            <div>
              <label htmlFor="s-dir" className="text-sm font-medium text-vm-ink">
                Dirección
              </label>
              <input
                id="s-dir"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="s-tel" className="text-sm font-medium text-vm-ink">
                  Teléfono
                </label>
                <input
                  id="s-tel"
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+52 55 1234 5678"
                  className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary"
                />
              </div>
              <div>
                <label htmlFor="s-wa" className="text-sm font-medium text-vm-ink">
                  WhatsApp
                </label>
                <input
                  id="s-wa"
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+52 55 1234 5678"
                  className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary"
                />
              </div>
            </div>

            <div>
              <label htmlFor="s-tz" className="text-sm font-medium text-vm-ink">
                Zona horaria
              </label>
              <select
                id="s-tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-2 h-12 w-full rounded-lg border px-3 text-sm outline-none focus:border-vm-primary"
              >
                {zonas.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-vm-body">
                Se usa para calcular si tu negocio está abierto ahora. El cálculo ocurre en el
                servidor, no en el celular de tu cliente.
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-vm-ink">Horarios</p>
              <ul className="mt-3 space-y-2">
                {ORDEN_VISUAL.map((dia) => {
                  const fila = filas[dia];
                  const cruza =
                    !fila.cerrado && cruzaMedianoche(fila.hora_apertura, fila.hora_cierre);

                  return (
                    <li key={dia} className="flex flex-wrap items-center gap-2.5">
                      <span className="w-24 shrink-0 text-sm text-vm-ink">{DIAS[dia]}</span>

                      <label className="flex items-center gap-1.5 text-xs text-vm-body">
                        <input
                          type="checkbox"
                          checked={fila.cerrado}
                          onChange={(e) => editarDia(dia, { cerrado: e.target.checked })}
                          className="size-3.5 accent-vm-primary"
                        />
                        Cerrado
                      </label>

                      {!fila.cerrado && (
                        <>
                          <input
                            type="time"
                            aria-label={`Apertura ${DIAS[dia]}`}
                            value={fila.hora_apertura ?? ""}
                            onChange={(e) => editarDia(dia, { hora_apertura: e.target.value })}
                            className="vm-data h-10 rounded-lg border px-2 text-sm outline-none focus:border-vm-primary"
                          />
                          <span className="text-xs text-vm-body">a</span>
                          <input
                            type="time"
                            aria-label={`Cierre ${DIAS[dia]}`}
                            value={fila.hora_cierre ?? ""}
                            onChange={(e) => editarDia(dia, { hora_cierre: e.target.value })}
                            className="vm-data h-10 rounded-lg border px-2 text-sm outline-none focus:border-vm-primary"
                          />
                          {cruza && (
                            <span className="rounded-full bg-vm-bg-soft px-2 py-0.5 text-[11px] text-vm-body">
                              +1 día
                            </span>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {error && (
              <p className="rounded-lg bg-vm-danger-soft px-3.5 py-2.5 text-sm text-vm-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={guardar.isPending}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white hover:bg-vm-primary-hover disabled:opacity-50"
            >
              {guardar.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {BOTONES.guardarCambios}
            </button>
          </form>
        )}
      </motion.aside>
    </div>
  );
}
