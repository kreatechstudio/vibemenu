import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { FolderPlus, ImageOff, Lock, Plus, Store, Trash2 } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import PillTabs from "@/components/layout/PillTabs";
import EditorProducto from "@/components/admin/EditorProducto";
import ModalLimite from "@/components/admin/ModalLimite";
import { DialogoConfirmar, DialogoTexto } from "@/components/ui/dialogo";
import { useTenantActual } from "@/hooks/useTenantActual";
import { useSucursales } from "@/hooks/useSucursales";
import {
  useAlternarActivo,
  useBorrarCategoria,
  useCategorias,
  useCrearCategoria,
  useProductos,
} from "@/hooks/useCarta";
import type { ErrorTraducido } from "@/lib/errores";
import { precioMenu } from "@/lib/tema";
import { BOTONES, ESTADOS } from "@/lib/copy";
import { avisarExito } from "@/lib/avisos";
import { alcanzoLimite, permiteMenuPorSucursal } from "@/lib/plan";
import type { Producto, Sucursal } from "@/types/database";
import { cn } from "@/lib/utils";

export default function Menu() {
  return (
    <AdminLayout>
      <Contenido />
    </AdminLayout>
  );
}

/** Marca lo que solo existe en un local. Lo compartido no lleva etiqueta: es lo normal. */
function EtiquetaSucursal({ nombre }: { nombre: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-vm-primary/10 px-2 py-0.5 text-[10px] font-medium text-vm-primary">
      <Store className="size-2.5" aria-hidden />
      Solo en {nombre}
    </span>
  );
}

/**
 * Ambito de trabajo: "todo el negocio" o una sucursal concreta.
 *
 * No es un filtro cosmetico. Define que `sucursal_id` llevan las categorias y los
 * productos que se creen desde aqui — la regla del proyecto es que menu compartido
 * vs. independiente se resuelve con `sucursal_id` nullable, nunca con otra tabla.
 */
function SelectorAmbito({
  sucursales,
  ambito,
  alElegir,
}: {
  sucursales: Sucursal[];
  ambito: string | null;
  alElegir: (id: string | null) => void;
}) {
  const activa = sucursales.find((s) => s.id === ambito);

  return (
    <div className="mt-6 rounded-xl border bg-vm-bg-soft p-4">
      <p className="text-sm font-medium text-vm-ink">Estás editando</p>

      <div className="tira-scroll mt-2.5 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => alElegir(null)}
          aria-pressed={ambito === null}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
            ambito === null
              ? "border-vm-primary bg-vm-primary text-white"
              : "border-transparent bg-white text-vm-body hover:text-vm-ink",
          )}
        >
          Todo el negocio
        </button>

        {sucursales.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => alElegir(s.id)}
            aria-pressed={ambito === s.id}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              ambito === s.id
                ? "border-vm-primary bg-vm-primary text-white"
                : "border-transparent bg-white text-vm-body hover:text-vm-ink",
            )}
          >
            {s.nombre}
          </button>
        ))}
      </div>

      <p className="mt-2.5 text-xs text-vm-body">
        {activa ? (
          <>
            Ves lo que se vende en <strong className="text-vm-ink">{activa.nombre}</strong>: lo
            compartido más lo suyo. Lo que crees aquí será exclusivo de esa sucursal.
          </>
        ) : (
          <>
            Ves la carta completa. Lo que crees aquí se muestra en todas tus sucursales, y desde
            cada producto puedes darle un precio distinto a cada una.
          </>
        )}
      </p>
    </div>
  );
}

function Contenido() {
  const { data: ctx } = useTenantActual();
  const tenantId = ctx?.tenant.id;

  const { data: categorias } = useCategorias(tenantId);
  const { data: productos } = useProductos(tenantId);
  const { data: sucursales } = useSucursales(tenantId);

  const crearCategoria = useCrearCategoria(tenantId);
  const borrarCategoria = useBorrarCategoria(tenantId);
  const alternarActivo = useAlternarActivo(tenantId);

  const [ambito, setAmbito] = useState<string | null>(null);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ producto: Producto | null } | null>(null);
  const [limite, setLimite] = useState<ErrorTraducido | null>(null);
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [categoriaABorrar, setCategoriaABorrar] = useState<{ id: string; nombre: string } | null>(
    null,
  );

  const independiente = ctx ? permiteMenuPorSucursal(ctx.plan) : false;
  const locales = sucursales ?? [];

  // Dentro de una sucursal se ve lo suyo y lo compartido, igual que en el menú público.
  const enAmbito = <T extends { sucursal_id: string | null }>(fila: T) =>
    ambito === null || fila.sucursal_id === null || fila.sucursal_id === ambito;

  const visibles = categorias?.filter(enAmbito) ?? [];
  const idsVisibles = visibles.map((c) => c.id).join(",");

  // Al cargar, y cuando la categoría abierta se sale del ámbito, se abre la primera.
  useEffect(() => {
    if (!idsVisibles) return;
    const ids = idsVisibles.split(",");
    if (!seleccionada || !ids.includes(seleccionada)) setSeleccionada(ids[0]);
  }, [idsVisibles, seleccionada]);

  if (!ctx) return null;

  const total = productos?.length ?? 0;
  const topado = alcanzoLimite(ctx.plan.limite_productos, total);

  const categoria = visibles.find((c) => c.id === seleccionada) ?? null;
  const productosDeCategoria =
    productos?.filter((p) => p.categoria_id === seleccionada && enAmbito(p)) ?? [];

  const nombreDe = (id: string | null) =>
    id ? (locales.find((s) => s.id === id)?.nombre ?? "otra sucursal") : null;

  async function crear(nombre: string) {
    // El ámbito manda: en "Todo el negocio" la categoría nace compartida.
    await crearCategoria.mutateAsync({
      nombre,
      orden: categorias?.length ?? 0,
      sucursalId: ambito,
    });
    avisarExito(`Categoría "${nombre}" creada.`);
    setCreandoCategoria(false);
  }

  async function borrar(id: string) {
    await borrarCategoria.mutateAsync(id);
    if (id === seleccionada) setSeleccionada(null);
    setCategoriaABorrar(null);
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
          <h1 className="text-2xl">Mi carta</h1>
          <p className="mt-1 text-sm text-vm-body">
            {total} {total === 1 ? "producto" : "productos"}
            {ctx.plan.limite_productos !== null && ` de ${ctx.plan.limite_productos}`}
          </p>
        </div>

        <button
          type="button"
          disabled={!categoria || topado}
          onClick={() => setEditando({ producto: null })}
          title={topado ? ESTADOS.limiteProductos : undefined}
          className="inline-flex h-12 items-center gap-2 rounded-lg bg-vm-primary px-5 text-sm font-medium text-white hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden />
          {BOTONES.agregarProducto}
        </button>
      </div>

      {topado && (
        <p className="mt-5 rounded-lg bg-vm-warning-soft px-4 py-3 text-sm text-vm-warning">
          {ESTADOS.limiteProductos}
        </p>
      )}

      {/* Solo Pro separa la carta por sucursal. En los demás planes todo es compartido. */}
      {independiente && locales.length > 0 && (
        <SelectorAmbito sucursales={locales} ambito={ambito} alElegir={setAmbito} />
      )}

      {!independiente && locales.length > 1 && (
        <p className="mt-5 flex items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-vm-body">
          <Lock className="size-3.5 shrink-0" aria-hidden />
          Tus {locales.length} sucursales comparten esta carta. Con Pro, cada una puede tener sus
          propios platillos y sus propios precios.
        </p>
      )}

      <div className="mt-7 grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Categorías */}
        <aside>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-vm-ink">Categorías</h2>
            <button
              type="button"
              onClick={() => setCreandoCategoria(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-vm-primary hover:underline"
            >
              <FolderPlus className="size-3.5" aria-hidden />
              Nueva
            </button>
          </div>

          {!visibles.length ? (
            <p className="mt-4 rounded-xl border border-dashed p-5 text-sm text-vm-body">
              {ESTADOS.sinCategorias}
            </p>
          ) : (
            <ul className="mt-4 space-y-1">
              {visibles.map((c) => {
                const cuantos =
                  productos?.filter((p) => p.categoria_id === c.id && enAmbito(p)).length ?? 0;
                const activa = c.id === seleccionada;
                const exclusiva = nombreDe(c.sucursal_id);

                return (
                  <li key={c.id}>
                    <div
                      className={cn(
                        "group flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm",
                        activa ? "bg-vm-bg-soft font-medium text-vm-ink" : "text-vm-body",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSeleccionada(c.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate">{c.nombre}</span>
                        {exclusiva && (
                          <span className="mt-1 block">
                            <EtiquetaSucursal nombre={exclusiva} />
                          </span>
                        )}
                      </button>
                      <span className="vm-data text-xs text-vm-body">{cuantos}</span>
                      <button
                        type="button"
                        aria-label={`Eliminar ${c.nombre}`}
                        onClick={() => setCategoriaABorrar({ id: c.id, nombre: c.nombre })}
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Trash2 className="size-3.5 text-vm-danger" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Productos */}
        <section>
          {!categoria ? null : productosDeCategoria.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <p className="text-sm text-vm-body">{ESTADOS.sinProductos}</p>
              <button
                type="button"
                disabled={topado}
                onClick={() => setEditando({ producto: null })}
                className="mt-5 inline-flex h-12 items-center gap-2 rounded-lg bg-vm-primary px-5 text-sm font-medium text-white disabled:opacity-50"
              >
                <Plus className="size-4" aria-hidden />
                {BOTONES.agregarProducto}
              </button>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {productosDeCategoria.map((p) => {
                const exclusivo = nombreDe(p.sucursal_id);

                return (
                  <li
                    key={p.id}
                    className="group relative flex gap-3 rounded-xl border p-3 transition-colors hover:border-vm-primary/40 hover:bg-vm-bg-soft/50"
                  >
                    {/*
                      Toda la tarjeta abre el editor, no solo el nombre. El botón va
                      detrás del contenido y este deja pasar el clic; la casilla de
                      Activo lo recupera, porque ahí sí hay que quedarse en la lista.
                    */}
                    <button
                      type="button"
                      onClick={() => setEditando({ producto: p })}
                      aria-label={`Editar ${p.nombre}`}
                      className="absolute inset-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vm-primary"
                    />

                    {p.imagen_url ? (
                      <img
                        src={p.imagen_url}
                        alt=""
                        className="pointer-events-none size-20 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="pointer-events-none grid size-20 place-items-center rounded-lg bg-vm-bg-soft">
                        <ImageOff className="size-5 text-vm-body" aria-hidden />
                      </div>
                    )}

                    <div className="pointer-events-none relative min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-vm-ink group-hover:underline">
                        {p.nombre}
                      </p>
                      <p className="vm-data mt-0.5 text-sm text-vm-body">{precioMenu(p.precio)}</p>

                      {/* Si la categoría ya es exclusiva, repetirlo en cada producto es ruido. */}
                      {exclusivo && !categoria.sucursal_id && (
                        <p className="mt-1.5">
                          <EtiquetaSucursal nombre={exclusivo} />
                        </p>
                      )}

                      <label className="pointer-events-auto mt-2 flex w-fit items-center gap-2 text-xs text-vm-body">
                        <input
                          type="checkbox"
                          checked={p.activo}
                          onChange={(e) =>
                            void alternarActivo.mutateAsync({ id: p.id, activo: e.target.checked })
                          }
                          className="size-3.5 accent-vm-primary"
                        />
                        {p.activo ? "Activo" : "Borrador"}
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <AnimatePresence>
        {editando && categoria && (
          <EditorProducto
            tenantId={ctx.tenant.id}
            categoria={categoria}
            producto={editando.producto}
            sucursales={locales}
            permiteIndependiente={independiente}
            sucursalPorDefecto={ambito}
            alCerrar={() => setEditando(null)}
            alTopar={setLimite}
          />
        )}
      </AnimatePresence>

      <ModalLimite error={limite} alCerrar={() => setLimite(null)} />

      <DialogoTexto
        abierto={creandoCategoria}
        titulo="Nueva categoría"
        etiqueta="Nombre"
        marcador="Cafetería"
        alConfirmar={(nombre) => void crear(nombre)}
        alCancelar={() => setCreandoCategoria(false)}
      />

      <DialogoConfirmar
        abierto={categoriaABorrar !== null}
        titulo={`¿Eliminar "${categoriaABorrar?.nombre ?? ""}"?`}
        mensaje="También se eliminan todos sus productos. Esto no se puede deshacer."
        alConfirmar={() => void borrar(categoriaABorrar!.id)}
        alCancelar={() => setCategoriaABorrar(null)}
      />
    </>
  );
}
