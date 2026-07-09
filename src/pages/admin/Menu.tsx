import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { FolderPlus, ImageOff, Plus, Trash2 } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import EditorProducto from "@/components/admin/EditorProducto";
import ModalLimite from "@/components/admin/ModalLimite";
import { DialogoConfirmar, DialogoTexto } from "@/components/ui/dialogo";
import { useTenantActual } from "@/hooks/useTenantActual";
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
import { alcanzoLimite } from "@/lib/plan";
import type { Producto } from "@/types/database";
import { cn } from "@/lib/utils";

export default function Menu() {
  return (
    <AdminLayout>
      <Contenido />
    </AdminLayout>
  );
}

function Contenido() {
  const { data: ctx } = useTenantActual();
  const tenantId = ctx?.tenant.id;

  const { data: categorias } = useCategorias(tenantId);
  const { data: productos } = useProductos(tenantId);

  const crearCategoria = useCrearCategoria(tenantId);
  const borrarCategoria = useBorrarCategoria(tenantId);
  const alternarActivo = useAlternarActivo(tenantId);

  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ producto: Producto | null } | null>(null);
  const [limite, setLimite] = useState<ErrorTraducido | null>(null);
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [categoriaABorrar, setCategoriaABorrar] = useState<{ id: string; nombre: string } | null>(
    null,
  );

  // Al cargar, se selecciona la primera categoria.
  useEffect(() => {
    if (!seleccionada && categorias?.length) setSeleccionada(categorias[0].id);
  }, [categorias, seleccionada]);

  if (!ctx) return null;

  const total = productos?.length ?? 0;
  const topado = alcanzoLimite(ctx.plan.limite_productos, total);
  const productosDeCategoria = productos?.filter((p) => p.categoria_id === seleccionada) ?? [];

  async function crear(nombre: string) {
    await crearCategoria.mutateAsync({ nombre, orden: categorias?.length ?? 0 });
    setCreandoCategoria(false);
  }

  async function borrar(id: string) {
    await borrarCategoria.mutateAsync(id);
    if (id === seleccionada) setSeleccionada(null);
    setCategoriaABorrar(null);
  }

  return (
    <>
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
          disabled={!seleccionada || topado}
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

          {!categorias?.length ? (
            <p className="mt-4 rounded-xl border border-dashed p-5 text-sm text-vm-body">
              {ESTADOS.sinCategorias}
            </p>
          ) : (
            <ul className="mt-4 space-y-1">
              {categorias.map((c) => {
                const cuantos = productos?.filter((p) => p.categoria_id === c.id).length ?? 0;
                const activa = c.id === seleccionada;
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
                        className="flex-1 text-left"
                      >
                        {c.nombre}
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
          {!seleccionada ? null : productosDeCategoria.length === 0 ? (
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
              {productosDeCategoria.map((p) => (
                <li key={p.id} className="flex gap-3 rounded-xl border p-3">
                  {p.imagen_url ? (
                    <img src={p.imagen_url} alt="" className="size-20 rounded-lg object-cover" />
                  ) : (
                    <div className="grid size-20 place-items-center rounded-lg bg-vm-bg-soft">
                      <ImageOff className="size-5 text-vm-body" aria-hidden />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setEditando({ producto: p })}
                      className="block truncate text-left text-sm font-medium text-vm-ink hover:underline"
                    >
                      {p.nombre}
                    </button>
                    <p className="vm-data mt-0.5 text-sm text-vm-body">{precioMenu(p.precio)}</p>

                    <label className="mt-2 flex items-center gap-2 text-xs text-vm-body">
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
              ))}
            </ul>
          )}
        </section>
      </div>

      <AnimatePresence>
        {editando && seleccionada && (
          <EditorProducto
            tenantId={ctx.tenant.id}
            categoriaId={seleccionada}
            producto={editando.producto}
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
