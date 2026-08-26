import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import PillTabs from "@/components/layout/PillTabs";
import ModalLimite from "@/components/admin/ModalLimite";
import { DialogoConfirmar, DialogoTexto } from "@/components/ui/dialogo";
import { useTenantActual } from "@/hooks/useTenantActual";
import {
  useBorrarGrupo,
  useBorrarOpcion,
  useCrearOpcion,
  useGrupos,
  useGuardarGrupo,
  type GrupoConOpciones,
} from "@/hooks/useModificadores";
import { traducirError, type ErrorTraducido } from "@/lib/errores";
import { precioMenu } from "@/lib/tema";
import { alcanzoLimite } from "@/lib/plan";
import { BOTONES } from "@/lib/copy";
import type { TipoSeleccion } from "@/types/database";
import { cn } from "@/lib/utils";

export default function Modificadores() {
  return (
    <AdminLayout>
      <Contenido />
    </AdminLayout>
  );
}

function NuevaOpcion({
  tenantId,
  grupoId,
  orden,
}: {
  tenantId: string;
  grupoId: string;
  orden: number;
}) {
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const crear = useCrearOpcion(tenantId);

  async function alAgregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    await crear.mutateAsync({
      grupo_id: grupoId,
      nombre: nombre.trim(),
      precio_extra: Number(precio) || 0,
      orden,
    });
    setNombre("");
    setPrecio("");
  }

  return (
    <form onSubmit={alAgregar} className="mt-3 flex gap-2">
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Grande"
        aria-label="Nombre de la opción"
        className="h-11 flex-1 rounded-lg border px-3 text-sm outline-none focus:border-vm-primary"
      />
      <input
        value={precio}
        onChange={(e) => setPrecio(e.target.value)}
        type="number"
        min="0"
        step="0.01"
        placeholder="+$0"
        aria-label="Precio extra"
        className="vm-data h-11 w-24 rounded-lg border px-3 text-sm outline-none focus:border-vm-primary"
      />
      <button
        type="submit"
        disabled={crear.isPending}
        className="inline-flex size-11 items-center justify-center rounded-lg border text-vm-primary hover:bg-vm-bg-soft disabled:opacity-50"
        aria-label="Agregar opción"
      >
        {crear.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
      </button>
    </form>
  );
}

function TarjetaGrupo({ tenantId, grupo }: { tenantId: string; grupo: GrupoConOpciones }) {
  const [abierto, setAbierto] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const guardar = useGuardarGrupo(tenantId);
  const borrarGrupo = useBorrarGrupo(tenantId);
  const borrarOpcion = useBorrarOpcion(tenantId);

  const tipo = grupo.tipo_seleccion as TipoSeleccion;

  return (
    <li className="rounded-xl border">
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-vm-body transition-transform",
              abierto && "rotate-180",
            )}
            aria-hidden
          />
          <span className="text-sm font-medium text-vm-ink">{grupo.nombre}</span>
          <span className="rounded-full bg-vm-bg-soft px-2 py-0.5 text-[11px] text-vm-body">
            {tipo === "unica" ? "Una opción" : "Varias opciones"}
          </span>
          {grupo.obligatorio && (
            <span className="rounded-full bg-vm-warning-soft px-2 py-0.5 text-[11px] font-medium text-vm-warning">
              Obligatorio
            </span>
          )}
          <span className="vm-data ml-auto text-xs text-vm-body">{grupo.opciones.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setConfirmandoBorrado(true)}
          aria-label={`Eliminar ${grupo.nombre}`}
          className="text-vm-danger"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {abierto && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="overflow-hidden border-t px-4 pb-4"
        >
          <div className="flex flex-wrap gap-4 pt-4">
            <label className="flex items-center gap-2 text-sm text-vm-body">
              <input
                type="checkbox"
                checked={grupo.obligatorio}
                onChange={(e) =>
                  void guardar.mutateAsync({
                    id: grupo.id,
                    datos: {
                      nombre: grupo.nombre,
                      tipo_seleccion: tipo,
                      obligatorio: e.target.checked,
                      min_selecciones: e.target.checked ? Math.max(1, grupo.min_selecciones) : 0,
                      max_selecciones: grupo.max_selecciones,
                    },
                  })
                }
                className="size-4 accent-vm-primary"
              />
              Obligatorio
            </label>

            <label className="flex items-center gap-2 text-sm text-vm-body">
              Selección
              <select
                value={tipo}
                onChange={(e) =>
                  void guardar.mutateAsync({
                    id: grupo.id,
                    datos: {
                      nombre: grupo.nombre,
                      tipo_seleccion: e.target.value as TipoSeleccion,
                      obligatorio: grupo.obligatorio,
                      min_selecciones: grupo.min_selecciones,
                      // Con seleccion unica el maximo es 1, si no la restriccion no tiene sentido.
                      max_selecciones: e.target.value === "unica" ? 1 : null,
                    },
                  })
                }
                className="h-9 rounded-lg border px-2 text-sm"
              >
                <option value="unica">Una opción</option>
                <option value="multiple">Varias opciones</option>
              </select>
            </label>
          </div>

          <ul className="mt-4 space-y-1.5">
            {grupo.opciones.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between rounded-lg bg-vm-bg-soft px-3 py-2.5"
              >
                <span className="text-sm text-vm-ink">{o.nombre}</span>
                <div className="flex items-center gap-3">
                  {o.precio_extra > 0 && (
                    <span className="vm-data text-sm text-vm-body">
                      +{precioMenu(o.precio_extra)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void borrarOpcion.mutateAsync(o.id)}
                    aria-label={`Eliminar ${o.nombre}`}
                    className="text-vm-body hover:text-vm-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <NuevaOpcion tenantId={tenantId} grupoId={grupo.id} orden={grupo.opciones.length} />
        </motion.div>
      )}

      <DialogoConfirmar
        abierto={confirmandoBorrado}
        titulo={`¿Eliminar "${grupo.nombre}"?`}
        mensaje="Se quita de todos los productos que lo usan. Esto no se puede deshacer."
        alConfirmar={() => {
          void borrarGrupo.mutateAsync(grupo.id);
          setConfirmandoBorrado(false);
        }}
        alCancelar={() => setConfirmandoBorrado(false)}
      />
    </li>
  );
}

function Contenido() {
  const { data: ctx } = useTenantActual();
  const tenantId = ctx?.tenant.id;
  const { data: grupos } = useGrupos(tenantId);
  const guardar = useGuardarGrupo(tenantId);
  const [limite, setLimite] = useState<ErrorTraducido | null>(null);
  const [creando, setCreando] = useState(false);

  if (!ctx) return null;

  const total = grupos?.length ?? 0;
  const topado = alcanzoLimite(ctx.plan.limite_grupos_modificadores, total);

  async function nuevoGrupo(nombre: string) {
    setCreando(false);
    try {
      await guardar.mutateAsync({
        datos: {
          nombre,
          tipo_seleccion: "unica",
          obligatorio: false,
          min_selecciones: 0,
          max_selecciones: 1,
        },
      });
    } catch (err) {
      const traducido = traducirError(err as Error);
      if (traducido.esLimiteDePlan) setLimite(traducido);
    }
  }

  return (
    <>
      <PillTabs
        pestanas={[
          { a: "/admin/menu", etiqueta: "Productos" },
          { a: "/admin/modificadores", etiqueta: "Modificadores" },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">Modificadores</h1>
          <p className="mt-1 max-w-prose text-sm text-vm-body">
            Grupos reutilizables que puedes asignar a varios productos: tamaño, tipo de leche,
            extras.
            {ctx.plan.limite_grupos_modificadores !== null &&
              ` Tu plan permite ${ctx.plan.limite_grupos_modificadores}.`}
          </p>
        </div>

        <button
          type="button"
          disabled={topado || guardar.isPending}
          onClick={() => setCreando(true)}
          className="inline-flex h-12 items-center gap-2 rounded-lg bg-vm-primary px-5 text-sm font-medium text-white hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden />
          {BOTONES.agregarModificador}
        </button>
      </div>

      {total === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm text-vm-body">
            Todavía no tienes modificadores. Crea el primero y úsalo en los productos que quieras.
          </p>
        </div>
      ) : (
        <ul className="mt-7 space-y-3">
          {grupos!.map((g) => (
            <TarjetaGrupo key={g.id} tenantId={ctx.tenant.id} grupo={g} />
          ))}
        </ul>
      )}

      <ModalLimite error={limite} alCerrar={() => setLimite(null)} />

      <DialogoTexto
        abierto={creando}
        titulo="Nuevo grupo de modificadores"
        etiqueta="Nombre"
        marcador="Tamaño de café"
        alConfirmar={(nombre) => void nuevoGrupo(nombre)}
        alCancelar={() => setCreando(false)}
      />
    </>
  );
}
