import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Frown, Lock, Meh, MessageSquare } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import PillTabs, { PESTANAS_NEGOCIO } from "@/components/layout/PillTabs";
import { useTenantActual } from "@/hooks/useTenantActual";
import { useSucursales } from "@/hooks/useSucursales";
import { useOpiniones, useMarcarOpinionResuelta, type Opinion } from "@/hooks/useOpiniones";
import { cn } from "@/lib/utils";

export default function Opiniones() {
  return (
    <AdminLayout>
      <Contenido />
    </AdminLayout>
  );
}

const FECHA = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });

/** Detrás del muro, difuminada. Nunca son datos reales. */
const EJEMPLO: Opinion[] = [
  {
    id: 1,
    sucursal_id: null,
    sentimiento: "mal",
    comentario: "Esperé mucho para que me tomaran la orden.",
    resuelto: false,
    creado_at: "2026-03-01",
  },
  {
    id: 2,
    sucursal_id: null,
    sentimiento: "regular",
    comentario: "La música estaba muy fuerte.",
    resuelto: true,
    creado_at: "2026-02-18",
  },
];

function IconoSentimiento({ s }: { s: Opinion["sentimiento"] }) {
  return s === "mal" ? (
    <Frown className="size-5 shrink-0 text-vm-danger" aria-label="Mal" />
  ) : (
    <Meh className="size-5 shrink-0 text-vm-warning" aria-label="Regular" />
  );
}

function Fila({
  o,
  sucursal,
  onResolver,
  resolviendo,
}: {
  o: Opinion;
  sucursal: string | null;
  onResolver?: () => void;
  resolviendo?: boolean;
}) {
  return (
    <li className="flex gap-3 rounded-xl border p-4">
      <IconoSentimiento s={o.sentimiento} />
      <div className="min-w-0 flex-1">
        {o.comentario ? (
          <p className="text-sm text-vm-ink">{o.comentario}</p>
        ) : (
          <p className="text-sm italic text-vm-body">Sin comentario</p>
        )}
        <p className="mt-1 text-xs text-vm-body">
          {(sucursal ?? "Menú general") + " · " + FECHA.format(new Date(o.creado_at))}
        </p>
      </div>
      {o.resuelto ? (
        <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-vm-success-soft px-3 text-xs font-medium text-vm-success">
          <Check className="size-3.5" aria-hidden />
          Resuelto
        </span>
      ) : (
        onResolver && (
          <button
            type="button"
            onClick={onResolver}
            disabled={resolviendo}
            className="h-8 shrink-0 rounded-full border px-3 text-xs font-medium text-vm-body hover:bg-vm-bg-soft disabled:opacity-50"
          >
            Marcar resuelto
          </button>
        )
      )}
    </li>
  );
}

function Bloqueado() {
  return (
    <div className="relative mt-8">
      <ul className="pointer-events-none space-y-3 select-none blur-sm" aria-hidden>
        {EJEMPLO.map((o) => (
          <Fila key={o.id} o={o} sucursal={null} />
        ))}
      </ul>
      <div className="absolute inset-0 grid place-items-center">
        <div className="max-w-sm rounded-xl border bg-white p-7 text-center shadow-vm-3">
          <Lock className="mx-auto size-8 text-vm-primary" aria-hidden />
          <h2 className="mt-4 text-xl">
            Las opiniones de tus clientes son parte de los planes de pago.
          </h2>
          <p className="mt-2 text-sm text-vm-body">
            El aviso «¿cómo estuvo tu visita?» lleva a los contentos a dejarte reseña en Google, y
            te guarda aquí lo que hay que mejorar.
          </p>
          <Link
            to="/admin/suscripcion"
            className="mt-6 inline-flex h-12 items-center rounded-lg bg-vm-primary px-6 text-sm font-medium text-white hover:bg-vm-primary-hover"
          >
            Actualizar plan
          </Link>
        </div>
      </div>
    </div>
  );
}

function Contenido() {
  const { data: ctx } = useTenantActual();
  const tenantId = ctx?.tenant.id;

  const { data: sucursales } = useSucursales(tenantId);
  const { data: opiniones, isLoading, isError } = useOpiniones(tenantId);
  const resolver = useMarcarOpinionResuelta(tenantId);

  const [filtro, setFiltro] = useState<string | "todas">("todas");
  const [verResueltas, setVerResueltas] = useState(false);

  const nombreSucursal = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sucursales ?? []) m.set(s.id, s.nombre);
    return m;
  }, [sucursales]);

  if (!ctx) return null;

  if (!ctx.plan.permite_embudo_resenas) {
    return (
      <>
        <PillTabs pestanas={PESTANAS_NEGOCIO} />
        <h1 className="text-2xl">Opiniones</h1>
        <p className="mt-1 text-sm text-vm-body">Lo que tus clientes te dicen al salir del menú.</p>
        <Bloqueado />
      </>
    );
  }

  const visibles = (opiniones ?? [])
    .filter((o) => verResueltas || !o.resuelto)
    .filter((o) =>
      filtro === "todas"
        ? true
        : filtro === "general"
          ? o.sucursal_id === null
          : o.sucursal_id === filtro,
    );

  const hayGeneral = (opiniones ?? []).some((o) => o.sucursal_id === null);

  return (
    <>
      <PillTabs pestanas={PESTANAS_NEGOCIO} />
      <h1 className="text-2xl">Opiniones</h1>
      <p className="mt-1 text-sm text-vm-body">Lo que tus clientes te dicen al salir del menú.</p>

      {isError && (
        <p className="mt-8 rounded-lg bg-vm-danger-soft px-4 py-3 text-sm text-vm-danger">
          No pudimos leer tus opiniones. Falta correr la migración{" "}
          <code>vibemenu_migracion_embudo_resenas.sql</code>.
        </p>
      )}

      {isLoading && <div className="mt-8 h-40 animate-pulse rounded-xl bg-vm-bg-soft" />}

      {opiniones && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {(
              [
                { k: "todas", txt: "Todas" },
                ...(hayGeneral ? [{ k: "general", txt: "Menú general" }] : []),
                ...(sucursales ?? []).map((s) => ({ k: s.id, txt: s.nombre })),
              ] as { k: string; txt: string }[]
            ).map(({ k, txt }) => (
              <button
                key={k}
                type="button"
                onClick={() => setFiltro(k)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  filtro === k ? "bg-vm-primary text-white" : "bg-vm-bg-soft text-vm-body",
                )}
              >
                {txt}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-1.5 text-xs text-vm-body">
              <input
                type="checkbox"
                checked={verResueltas}
                onChange={(e) => setVerResueltas(e.target.checked)}
                className="size-3.5 accent-vm-primary"
              />
              Ver resueltas
            </label>
          </div>

          {visibles.length === 0 ? (
            <div className="mt-8 grid place-items-center gap-2 rounded-xl border border-dashed py-16 text-center">
              <MessageSquare className="size-8 text-vm-body" aria-hidden />
              <p className="text-sm text-vm-body">
                {opiniones.length === 0 ? "Todavía no hay opiniones." : "Nada con este filtro."}
              </p>
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {visibles.map((o) => (
                <Fila
                  key={o.id}
                  o={o}
                  sucursal={o.sucursal_id ? (nombreSucursal.get(o.sucursal_id) ?? null) : null}
                  onResolver={() => void resolver.mutateAsync(o.id)}
                  resolviendo={resolver.isPending}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
