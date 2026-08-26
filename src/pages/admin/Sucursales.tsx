import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ExternalLink, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import PillTabs, { PESTANAS_NEGOCIO } from "@/components/layout/PillTabs";
import EditorSucursal from "@/components/admin/EditorSucursal";
import ModalLimite from "@/components/admin/ModalLimite";
import { DialogoConfirmar } from "@/components/ui/dialogo";
import { useTenantActual } from "@/hooks/useTenantActual";
import { useBorrarSucursal, useSucursales } from "@/hooks/useSucursales";
import { alcanzoLimite } from "@/lib/plan";
import { ESTADOS } from "@/lib/copy";
import type { ErrorTraducido } from "@/lib/errores";
import type { Sucursal } from "@/types/database";

export default function SucursalesPage() {
  return (
    <AdminLayout>
      <Contenido />
    </AdminLayout>
  );
}

function Contenido() {
  const { data: ctx } = useTenantActual();
  const tenantId = ctx?.tenant.id;
  const { data: sucursales } = useSucursales(tenantId);
  const borrar = useBorrarSucursal(tenantId);

  const [editando, setEditando] = useState<{ sucursal: Sucursal | null } | null>(null);
  const [limite, setLimite] = useState<ErrorTraducido | null>(null);
  const [aBorrar, setABorrar] = useState<Sucursal | null>(null);

  if (!ctx) return null;

  const total = sucursales?.length ?? 0;
  const tope = ctx.plan.limite_sucursales;
  const topado = alcanzoLimite(tope, total);

  return (
    <>
      <PillTabs pestanas={PESTANAS_NEGOCIO} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">Sucursales</h1>
          <p className="mt-1 text-sm text-vm-body">
            {tope === null ? `${total} sucursales` : `${total} de ${tope} sucursales`}
          </p>
        </div>

        <button
          type="button"
          disabled={topado}
          onClick={() => setEditando({ sucursal: null })}
          className="inline-flex h-12 items-center gap-2 rounded-lg bg-vm-primary px-5 text-sm font-medium text-white hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden />
          Añadir sucursal
        </button>
      </div>

      {topado && tope !== null && (
        <p className="mt-5 rounded-lg bg-vm-warning-soft px-4 py-3 text-sm text-vm-warning">
          {ESTADOS.limiteSucursales(tope)}
        </p>
      )}

      {total === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm text-vm-body">{ESTADOS.sinSucursales}</p>
          <button
            type="button"
            onClick={() => setEditando({ sucursal: null })}
            className="mt-5 inline-flex h-12 items-center gap-2 rounded-lg bg-vm-primary px-5 text-sm font-medium text-white"
          >
            <Plus className="size-4" aria-hidden />
            Añadir sucursal
          </button>
        </div>
      ) : (
        <ul className="mt-7 grid gap-3 md:grid-cols-2">
          {sucursales!.map((s) => (
            <li key={s.id} className="flex flex-col rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-vm-ink">{s.nombre}</p>
                  {s.direccion && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-vm-body">
                      <MapPin className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">{s.direccion}</span>
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-vm-body">
                    <span className="rounded-full bg-vm-bg-soft px-2 py-0.5">{s.timezone}</span>
                  </p>
                </div>

                <button
                  type="button"
                  aria-label={`Eliminar ${s.nombre}`}
                  onClick={() => setABorrar(s)}
                  className="shrink-0 text-vm-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <p className="vm-data mt-3 truncate text-xs text-vm-body">
                /{ctx.tenant.slug}/sucursal/{s.slug}
              </p>

              {/* Antes el único modo de editar era adivinar que el nombre era un botón. */}
              <div className="mt-4 flex flex-1 items-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditando({ sucursal: s })}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border text-sm font-medium text-vm-ink hover:bg-vm-bg-soft"
                >
                  <Pencil className="size-3.5" aria-hidden />
                  Editar sucursal
                </button>

                <a
                  href={`/${ctx.tenant.slug}/sucursal/${s.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Ver el menú de ${s.nombre}`}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border text-vm-body hover:bg-vm-bg-soft"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {editando && (
          <EditorSucursal
            tenantId={ctx.tenant.id}
            sucursal={editando.sucursal}
            alCerrar={() => setEditando(null)}
            alTopar={setLimite}
          />
        )}
      </AnimatePresence>

      <ModalLimite error={limite} alCerrar={() => setLimite(null)} />

      <DialogoConfirmar
        abierto={aBorrar !== null}
        titulo={`¿Eliminar "${aBorrar?.nombre ?? ""}"?`}
        mensaje="Se eliminan sus horarios, y los productos exclusivos de esta sucursal. Esto no se puede deshacer."
        alConfirmar={() => {
          void borrar.mutateAsync(aBorrar!.id);
          setABorrar(null);
        }}
        alCancelar={() => setABorrar(null)}
      />
    </>
  );
}
