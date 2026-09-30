import { useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, ChevronDown, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import PillTabs from "@/components/layout/PillTabs";
import ModalLimite from "@/components/admin/ModalLimite";
import { DialogoConfirmar, DialogoTexto } from "@/components/ui/dialogo";
import { useTenantActual } from "@/hooks/useTenantActual";
import { useCategorias } from "@/hooks/useCarta";
import {
  useBorrarGrupo,
  useBorrarOpcion,
  useCrearOpcion,
  useGrupos,
  useGuardarGrupo,
  useGuardarOpcion,
  type GrupoConOpciones,
} from "@/hooks/useModificadores";
import { traducirError, type ErrorTraducido } from "@/lib/errores";
import { precioMenu } from "@/lib/tema";
import { alcanzoLimite } from "@/lib/plan";
import { BOTONES } from "@/lib/copy";
import { useIniciarTour, type PasoTour } from "@/lib/tour";
import type { Categoria, TipoSeleccion } from "@/types/database";
import { cn } from "@/lib/utils";

const routeApi = getRouteApi("/admin/modificadores");

const PASOS_TOUR_MODIFICADORES: PasoTour[] = [
  {
    titulo: "Modificadores",
    descripcion:
      "Grupos reutilizables — tamaños, tipo de leche, extras — que puedes asignar a varios productos a la vez, en vez de repetir las mismas opciones producto por producto.",
  },
  {
    elemento: '[data-tour="mod-agregar"]',
    titulo: "Crea tu primer grupo",
    descripcion:
      'Ponle un nombre, por ejemplo "Tamaños" o "Extras". Después le agregas las opciones y su precio.',
  },
  {
    elemento: '[data-tour="mod-lista"]',
    titulo: "Tócalo para configurarlo",
    descripcion:
      "Ábrelo para marcarlo como obligatorio, elegir si el cliente puede elegir una opción o varias, y agregar sus opciones.",
  },
  {
    titulo: "Actívalo en tus productos",
    descripcion:
      'Ve a "Mi carta", abre un producto y actívale los grupos de modificadores que le apliquen.',
  },
];

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

function FilaOpcion({
  tenantId,
  opcion,
}: {
  tenantId: string;
  opcion: GrupoConOpciones["opciones"][number];
}) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(opcion.nombre);
  const [precio, setPrecio] = useState(opcion.precio_extra ? String(opcion.precio_extra) : "");
  const guardar = useGuardarOpcion(tenantId);
  const borrar = useBorrarOpcion(tenantId);

  if (editando) {
    return (
      <li className="flex items-center gap-2 rounded-lg bg-vm-bg-soft px-3 py-2">
        <input
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          aria-label="Nombre de la opción"
          className="h-9 min-w-0 flex-1 rounded-lg border px-2 text-sm outline-none focus:border-vm-primary"
        />
        <input
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          type="number"
          min="0"
          step="0.01"
          aria-label="Precio extra"
          className="vm-data h-9 w-20 shrink-0 rounded-lg border px-2 text-sm outline-none focus:border-vm-primary"
        />
        <button
          type="button"
          onClick={() => {
            if (!nombre.trim()) return;
            void guardar.mutateAsync({
              id: opcion.id,
              nombre: nombre.trim(),
              precio_extra: Number(precio) || 0,
            });
            setEditando(false);
          }}
          aria-label="Guardar opción"
          className="shrink-0 text-vm-success"
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setNombre(opcion.nombre);
            setPrecio(opcion.precio_extra ? String(opcion.precio_extra) : "");
            setEditando(false);
          }}
          aria-label="Cancelar"
          className="shrink-0 text-vm-body"
        >
          <X className="size-4" />
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between rounded-lg bg-vm-bg-soft px-3 py-2.5">
      <span className="text-sm text-vm-ink">{opcion.nombre}</span>
      <div className="flex items-center gap-3">
        {opcion.precio_extra > 0 && (
          <span className="vm-data text-sm text-vm-body">+{precioMenu(opcion.precio_extra)}</span>
        )}
        <button
          type="button"
          onClick={() => setEditando(true)}
          aria-label={`Editar ${opcion.nombre}`}
          className="text-vm-body hover:text-vm-ink"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => void borrar.mutateAsync(opcion.id)}
          aria-label={`Eliminar ${opcion.nombre}`}
          className="text-vm-body hover:text-vm-danger"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </li>
  );
}

function TarjetaGrupo({
  tenantId,
  grupo,
  categorias,
  abierto,
  onToggle,
}: {
  tenantId: string;
  grupo: GrupoConOpciones;
  categorias: Categoria[];
  abierto: boolean;
  onToggle: () => void;
}) {
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreBorrador, setNombreBorrador] = useState(grupo.nombre);
  const guardar = useGuardarGrupo(tenantId);
  const borrarGrupo = useBorrarGrupo(tenantId);

  const tipo = grupo.tipo_seleccion as TipoSeleccion;

  function guardarConfig(cambios: Partial<Parameters<typeof guardar.mutateAsync>[0]["datos"]>) {
    void guardar.mutateAsync({
      id: grupo.id,
      datos: {
        nombre: grupo.nombre,
        tipo_seleccion: tipo,
        obligatorio: grupo.obligatorio,
        min_selecciones: grupo.min_selecciones,
        max_selecciones: grupo.max_selecciones,
        ...cambios,
      },
    });
  }

  function alGuardarNombre(e: React.FormEvent) {
    e.preventDefault();
    const limpio = nombreBorrador.trim();
    setEditandoNombre(false);
    if (!limpio || limpio === grupo.nombre) return;
    guardarConfig({ nombre: limpio });
  }

  function alternarCategoria(categoriaId: string) {
    const activa = grupo.categoriaIds.includes(categoriaId);
    const nuevo = activa
      ? grupo.categoriaIds.filter((id) => id !== categoriaId)
      : [...grupo.categoriaIds, categoriaId];
    void guardar.mutateAsync({
      id: grupo.id,
      datos: {
        nombre: grupo.nombre,
        tipo_seleccion: tipo,
        obligatorio: grupo.obligatorio,
        min_selecciones: grupo.min_selecciones,
        max_selecciones: grupo.max_selecciones,
      },
      categoriaIds: nuevo,
    });
  }

  return (
    <li className="rounded-xl border">
      <div className="flex items-center gap-2 p-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={abierto}
          aria-label={abierto ? `Contraer ${grupo.nombre}` : `Expandir ${grupo.nombre}`}
          className="shrink-0"
        >
          <ChevronDown
            className={cn("size-4 text-vm-body transition-transform", abierto && "rotate-180")}
            aria-hidden
          />
        </button>

        {editandoNombre ? (
          <form onSubmit={alGuardarNombre} className="flex flex-1 items-center gap-2">
            <input
              autoFocus
              value={nombreBorrador}
              onChange={(e) => setNombreBorrador(e.target.value)}
              aria-label="Nombre del grupo"
              className="h-9 min-w-0 flex-1 rounded-lg border px-2 text-sm outline-none focus:border-vm-primary"
            />
            <button type="submit" aria-label="Guardar nombre" className="shrink-0 text-vm-success">
              <Check className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setEditandoNombre(false)}
              aria-label="Cancelar"
              className="shrink-0 text-vm-body"
            >
              <X className="size-4" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="flex flex-1 items-center gap-2 text-left"
          >
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
        )}

        {!editandoNombre && (
          <button
            type="button"
            onClick={() => {
              setNombreBorrador(grupo.nombre);
              setEditandoNombre(true);
            }}
            aria-label={`Renombrar ${grupo.nombre}`}
            className="shrink-0 text-vm-body hover:text-vm-ink"
          >
            <Pencil className="size-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => setConfirmandoBorrado(true)}
          aria-label={`Eliminar ${grupo.nombre}`}
          className="shrink-0 text-vm-danger"
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
                  guardarConfig({
                    obligatorio: e.target.checked,
                    min_selecciones: e.target.checked ? Math.max(1, grupo.min_selecciones) : 0,
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
                  guardarConfig({
                    tipo_seleccion: e.target.value as TipoSeleccion,
                    // Con seleccion unica el maximo es 1, si no la restriccion no tiene sentido.
                    max_selecciones: e.target.value === "unica" ? 1 : null,
                  })
                }
                className="h-9 rounded-lg border px-2 text-sm"
              >
                <option value="unica">Una opción</option>
                <option value="multiple">Varias opciones</option>
              </select>
            </label>
          </div>

          {categorias.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-vm-body">Categorías</p>
              <p className="mt-0.5 text-xs text-vm-body">
                Filtra en qué categoría aparece primero al asignarlo desde un producto. Sin ninguna
                marcada, aparece para todas.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {categorias.map((c) => {
                  const activa = grupo.categoriaIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={activa}
                      onClick={() => alternarCategoria(c.id)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        activa
                          ? "border-vm-primary bg-vm-primary/10 text-vm-primary"
                          : "text-vm-body hover:bg-vm-bg-soft",
                      )}
                    >
                      {c.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <ul className="mt-4 space-y-1.5">
            {grupo.opciones.map((o) => (
              <FilaOpcion key={o.id} tenantId={tenantId} opcion={o} />
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
  const { data: categorias } = useCategorias(tenantId);
  const guardar = useGuardarGrupo(tenantId);
  const [limite, setLimite] = useState<ErrorTraducido | null>(null);
  const [creando, setCreando] = useState(false);
  // Un solo grupo desplegado a la vez: abrir otro repliega el anterior.
  const [abiertoId, setAbiertoId] = useState<string | null>(null);

  const { tour } = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  useIniciarTour(
    "modificadores",
    Boolean(tour),
    grupos !== undefined,
    PASOS_TOUR_MODIFICADORES,
    navigate,
  );

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
          data-tour="mod-agregar"
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
        <ul className="mt-7 space-y-3" data-tour="mod-lista">
          {grupos!.map((g) => (
            <TarjetaGrupo
              key={g.id}
              tenantId={ctx.tenant.id}
              grupo={g}
              categorias={categorias ?? []}
              abierto={abiertoId === g.id}
              onToggle={() => setAbiertoId((actual) => (actual === g.id ? null : g.id))}
            />
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
