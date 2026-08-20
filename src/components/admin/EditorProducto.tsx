import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { ImagePlus, Loader2, Lock, Store, Trash2, X } from "lucide-react";
import {
  borrarImagen,
  subirFotoProducto,
  useBorrarProducto,
  useGuardarProducto,
  type BorradorProducto,
} from "@/hooks/useCarta";
import { sincronizarModificadores, useGrupos, useGruposDeProducto } from "@/hooks/useModificadores";
import {
  sincronizarPreciosSucursal,
  usePreciosDeProducto,
  type PreciosPorSucursal,
} from "@/hooks/usePreciosSucursal";
import { traducirError, type ErrorTraducido } from "@/lib/errores";
import { BOTONES, ESTADOS } from "@/lib/copy";
import { avisarGuardado } from "@/lib/avisos";
import { precioMenu } from "@/lib/tema";
import type { Categoria, Producto, Sucursal } from "@/types/database";
import { cn } from "@/lib/utils";

/**
 * Editor de producto. Panel lateral que se desliza, no modal centrado.
 *
 * Una sola foto por producto en todos los planes: es el mayor riesgo de costo de
 * Storage. El video no se sube, solo se guarda su URL embebida.
 *
 * Sucursales (Pro): un producto es compartido (`sucursal_id` null) o exclusivo de
 * una sucursal. Si es compartido puede ademas cobrar distinto en cada local, y eso
 * vive en `precios_sucursal`, no en copias del producto.
 */
export default function EditorProducto({
  tenantId,
  categoria,
  producto,
  sucursales,
  permiteIndependiente,
  sucursalPorDefecto,
  alCerrar,
  alTopar,
}: {
  tenantId: string;
  /** La categoria completa: si es exclusiva de una sucursal, arrastra al producto. */
  categoria: Categoria;
  producto: Producto | null;
  sucursales: Sucursal[];
  permiteIndependiente: boolean;
  /** Sucursal en la que el dueño está trabajando. null = menú compartido. */
  sucursalPorDefecto: string | null;
  alCerrar: () => void;
  /** El padre abre el modal de upsell cuando el trigger rechaza por limite. */
  alTopar: (e: ErrorTraducido) => void;
}) {
  const esNuevo = producto === null;
  const inputFoto = useRef<HTMLInputElement>(null);

  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? "");
  const [precio, setPrecio] = useState(String(producto?.precio ?? ""));
  const [imagenUrl, setImagenUrl] = useState(producto?.imagen_url ?? "");
  // La foto vieja solo se borra si el guardado sale bien. Si el usuario cancela,
  // el producto sigue apuntando a una imagen que existe.
  const imagenOriginal = useRef(producto?.imagen_url ?? "");
  const [videoUrl, setVideoUrl] = useState(producto?.video_url ?? "");

  /**
   * `trg_productos_20_categoria`: si la categoria es exclusiva de una sucursal, el
   * producto DEBE ser de la misma. No es una preferencia, es un rechazo de
   * Postgres — asi que aqui ni se ofrece la opcion.
   */
  const forzada = categoria.sucursal_id;
  const [sucursalId, setSucursalId] = useState<string | null>(
    forzada ?? (esNuevo ? sucursalPorDefecto : (producto?.sucursal_id ?? null)),
  );

  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = useGuardarProducto(tenantId);
  const borrar = useBorrarProducto(tenantId);

  const { data: grupos } = useGrupos(tenantId);
  const { data: yaAsignados, isLoading: cargandoGrupos } = useGruposDeProducto(producto?.id);
  const { data: preciosGuardados, isLoading: cargandoPrecios } = usePreciosDeProducto(producto?.id);

  // `undefined` = todavía no llega la consulta; entonces se usa lo que hay en la base.
  const [seleccion, setSeleccion] = useState<Set<string> | null>(null);
  const asignados = seleccion ?? new Set(yaAsignados ?? []);

  const [precios, setPrecios] = useState<Record<string, string> | null>(null);
  const preciosVisibles =
    precios ??
    Object.fromEntries(Object.entries(preciosGuardados ?? {}).map(([id, p]) => [id, String(p)]));

  /**
   * Guardar antes de que carguen los grupos o los precios los borraria todos:
   * `sincronizar*` deja la base exactamente como dice el formulario, y el
   * formulario todavia estaria vacio.
   */
  const datosListos = !cargandoGrupos && !cargandoPrecios;

  // Un producto exclusivo de una sucursal no puede cobrar distinto en otra.
  const puedeVariarPrecio = permiteIndependiente && sucursalId === null && sucursales.length > 0;

  function alternarGrupo(id: string) {
    const copia = new Set(asignados);
    if (copia.has(id)) copia.delete(id);
    else copia.add(id);
    setSeleccion(copia);
  }

  async function alElegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError(null);
    setSubiendo(true);
    try {
      setImagenUrl(await subirFotoProducto(tenantId, archivo));
    } catch {
      setError(ESTADOS.errorImagen);
    } finally {
      setSubiendo(false);
    }
  }

  async function alGuardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const datos: BorradorProducto = {
      categoria_id: categoria.id,
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      precio: Number(precio) || 0,
      imagen_url: imagenUrl || null,
      video_url: videoUrl.trim() || null,
      sucursal_id: sucursalId,
    };

    /**
     * Un campo vacío significa "cobra el precio base", y eso es borrar su fila.
     * Si el producto pasó a ser exclusivo de una sucursal, `deseados` queda vacío
     * a propósito: se le borran todos los precios sobrescritos, porque ya solo se
     * vende en un local y su precio es el suyo.
     */
    const deseados: PreciosPorSucursal = {};
    if (puedeVariarPrecio) {
      for (const s of sucursales) {
        const texto = (preciosVisibles[s.id] ?? "").trim();
        if (texto === "") continue;
        const monto = Number(texto);
        if (Number.isFinite(monto) && monto >= 0) deseados[s.id] = monto;
      }
    }

    try {
      // Devuelve el id: si el producto es nuevo, no existe hasta este momento
      // y sin él no se pueden escribir las filas de producto_modificadores.
      const productoId = await guardar.mutateAsync({ id: producto?.id, datos });
      await sincronizarModificadores(productoId, [...asignados]);
      if (permiteIndependiente) await sincronizarPreciosSucursal(productoId, deseados);

      // Ya nadie apunta a la foto anterior: fuera del bucket.
      if (imagenOriginal.current && imagenOriginal.current !== imagenUrl) {
        await borrarImagen(imagenOriginal.current);
      }

      avisarGuardado();
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

  const nombreDe = (id: string) => sucursales.find((s) => s.id === id)?.nombre ?? "esa sucursal";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={alCerrar} aria-hidden />

      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white"
        role="dialog"
        aria-modal="true"
        aria-label={esNuevo ? "Añadir producto" : `Editar ${producto.nombre}`}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
          <h2 className="text-lg">{esNuevo ? "Añadir producto" : "Editar producto"}</h2>
          <button type="button" onClick={alCerrar} aria-label="Cerrar" className="text-vm-body">
            <X className="size-5" />
          </button>
        </header>

        <form onSubmit={alGuardar} className="flex-1 space-y-5 p-5">
          <div>
            <label htmlFor="p-nombre" className="text-sm font-medium text-vm-ink">
              Nombre
            </label>
            <input
              id="p-nombre"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Flat White Especial"
              className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
            />
          </div>

          <div>
            <label htmlFor="p-desc" className="text-sm font-medium text-vm-ink">
              Descripción
            </label>
            <textarea
              id="p-desc"
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="mt-2 w-full resize-none rounded-lg border p-3 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
            />
          </div>

          <div>
            <label htmlFor="p-precio" className="text-sm font-medium text-vm-ink">
              Precio
            </label>
            <input
              id="p-precio"
              required
              type="number"
              min="0"
              step="0.01"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="vm-data mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
            />
            {puedeVariarPrecio && (
              <p className="mt-1.5 text-xs text-vm-body">
                El que cobran todas las sucursales, salvo las que ajustes abajo.
              </p>
            )}
          </div>

          {/* Dónde se vende. Solo tiene sentido si el negocio tiene sucursales. */}
          {sucursales.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-vm-ink">
                <Store className="size-3.5 text-vm-body" aria-hidden />
                Dónde se vende
                {!permiteIndependiente && !forzada && (
                  <Lock className="size-3 text-vm-body" aria-hidden />
                )}
              </p>

              {forzada ? (
                <p className="mt-2 rounded-lg bg-vm-bg-soft px-3.5 py-3 text-xs text-vm-body">
                  Solo en <strong className="text-vm-ink">{nombreDe(forzada)}</strong>, porque la
                  categoría «{categoria.nombre}» es exclusiva de esa sucursal.
                </p>
              ) : (
                <>
                  <select
                    value={sucursalId ?? ""}
                    disabled={!permiteIndependiente}
                    onChange={(e) => setSucursalId(e.target.value || null)}
                    className="mt-2 h-12 w-full rounded-lg border bg-white px-3.5 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20 disabled:cursor-not-allowed disabled:bg-vm-bg-soft disabled:text-vm-body"
                  >
                    <option value="">En todas las sucursales</option>
                    {sucursales.map((s) => (
                      <option key={s.id} value={s.id}>
                        Solo en {s.nombre}
                      </option>
                    ))}
                  </select>
                  {!permiteIndependiente && (
                    <p className="mt-1.5 text-xs text-vm-body">
                      Tu plan solo admite un menú compartido entre sucursales.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Precios sobrescritos: un producto, un precio por local. */}
          {puedeVariarPrecio && (
            <div>
              <p className="text-sm font-medium text-vm-ink">Precio por sucursal</p>
              <p className="text-xs text-vm-body">
                Déjalo vacío y esa sucursal cobra {precioMenu(Number(precio) || 0)}.
              </p>

              <ul className="mt-3 space-y-2">
                {sucursales.map((s) => (
                  <li key={s.id} className="flex items-center gap-3">
                    <label htmlFor={`ps-${s.id}`} className="min-w-0 flex-1 truncate text-sm">
                      {s.nombre}
                    </label>
                    <input
                      id={`ps-${s.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      disabled={!datosListos}
                      value={preciosVisibles[s.id] ?? ""}
                      onChange={(e) => setPrecios({ ...preciosVisibles, [s.id]: e.target.value })}
                      placeholder={String(Number(precio) || 0)}
                      className="vm-data h-11 w-32 rounded-lg border px-3 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20 disabled:bg-vm-bg-soft"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-vm-ink">Foto</p>
            <p className="text-xs text-vm-body">Una por producto. Se guarda comprimida en WebP.</p>

            <input
              ref={inputFoto}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={alElegirFoto}
              className="sr-only"
            />

            {imagenUrl ? (
              <div className="mt-3 flex items-center gap-3">
                <img src={imagenUrl} alt="" className="size-20 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setImagenUrl("")}
                  className="text-sm text-vm-danger hover:underline"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputFoto.current?.click()}
                disabled={subiendo}
                className="mt-3 flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-sm text-vm-body hover:bg-vm-bg-soft"
              >
                {subiendo ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : (
                  <ImagePlus className="size-5" aria-hidden />
                )}
                {subiendo ? "Subiendo…" : "Arrastra o elige una foto"}
              </button>
            )}
          </div>

          <div>
            <label htmlFor="p-video" className="text-sm font-medium text-vm-ink">
              Video <span className="font-normal text-vm-body">(opcional)</span>
            </label>
            <input
              id="p-video"
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
            />
            <p className="mt-1.5 text-xs text-vm-body">
              Pega el enlace de YouTube o de un Reel. Se usa en el formato TikTok; si no hay video,
              se muestra la foto.
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-vm-ink">Modificadores</p>
            <p className="text-xs text-vm-body">
              Los grupos que apliquen a este producto. Se administran en Modificadores.
            </p>

            {!grupos?.length ? (
              <p className="mt-3 rounded-lg border border-dashed px-3.5 py-3 text-xs text-vm-body">
                Todavía no tienes grupos de modificadores.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {grupos.map((g) => {
                  const activo = asignados.has(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      disabled={!datosListos}
                      onClick={() => alternarGrupo(g.id)}
                      aria-pressed={activo}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                        activo
                          ? "border-vm-primary bg-vm-primary text-white"
                          : "text-vm-body hover:bg-vm-bg-soft",
                        !datosListos && "opacity-50",
                      )}
                    >
                      {g.nombre}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-vm-danger-soft px-3.5 py-2.5 text-sm text-vm-danger">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={guardar.isPending || subiendo || !datosListos}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white hover:bg-vm-primary-hover disabled:opacity-50"
            >
              {(guardar.isPending || !datosListos) && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              {BOTONES.guardarCambios}
            </button>

            {!esNuevo && (
              <button
                type="button"
                onClick={async () => {
                  await borrar.mutateAsync(producto.id);
                  await borrarImagen(producto.imagen_url);
                  alCerrar();
                }}
                aria-label="Eliminar producto"
                className="inline-flex size-12 items-center justify-center rounded-lg border text-vm-danger hover:bg-vm-danger-soft"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        </form>
      </motion.aside>
    </div>
  );
}
