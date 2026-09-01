import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, Lock, MessageCircle, Phone } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import PillTabs, { PESTANAS_NEGOCIO } from "@/components/layout/PillTabs";
import { useTenantActual } from "@/hooks/useTenantActual";
import { useSucursales } from "@/hooks/useSucursales";
import {
  useReservaciones,
  useCambiarEstadoReservacion,
  type EstadoReservacion,
  type Reservacion,
} from "@/hooks/useReservaciones";
import { telefonoParaWaMe } from "@/lib/whatsapp";
import { formateadorFechaHora } from "@/lib/reservaciones";
import { cn } from "@/lib/utils";

export default function Reservaciones() {
  return (
    <AdminLayout>
      <Contenido />
    </AdminLayout>
  );
}

/** Detrás del muro, difuminadas. Nunca son datos reales. */
const EJEMPLO: Reservacion[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    sucursal_id: "00000000-0000-0000-0000-0000000000a1",
    nombre: "Marisol Vega",
    personas: 4,
    fecha_hora: "2026-09-12T02:00:00Z",
    telefono: "+52 55 1234 5678",
    email: null,
    nota: "Festejo de cumpleaños",
    estado: "nueva",
    creada_en: "2026-09-01",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    sucursal_id: "00000000-0000-0000-0000-0000000000a1",
    nombre: "Jorge Ramos",
    personas: 2,
    fecha_hora: "2026-09-10T20:00:00Z",
    telefono: "+52 55 8765 4321",
    email: null,
    nota: null,
    estado: "atendida",
    creada_en: "2026-08-30",
  },
];

function Fila({
  r,
  sucursal,
  tz,
  onEstado,
  ocupado,
}: {
  r: Reservacion;
  sucursal: string;
  tz: string;
  onEstado?: (e: EstadoReservacion) => void;
  ocupado?: boolean;
}) {
  const wa = telefonoParaWaMe(r.telefono);
  return (
    <li className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-vm-ink">
            {r.nombre} · {r.personas} {r.personas === 1 ? "persona" : "personas"}
          </p>
          <p className="mt-0.5 text-xs text-vm-body">
            {formateadorFechaHora(tz).format(new Date(r.fecha_hora))} · {sucursal}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium capitalize",
            r.estado === "nueva" && "bg-vm-primary/10 text-vm-primary",
            r.estado === "atendida" && "bg-vm-success-soft text-vm-success",
            r.estado === "cancelada" && "bg-vm-bg-soft text-vm-body",
          )}
        >
          {r.estado}
        </span>
      </div>

      {r.nota && <p className="mt-2 text-sm text-vm-body">{r.nota}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={`tel:${r.telefono.replace(/[^\d+]/g, "")}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs text-vm-ink hover:bg-vm-bg-soft"
        >
          <Phone className="size-3.5" aria-hidden /> Llamar
        </a>
        {wa && (
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs text-vm-ink hover:bg-vm-bg-soft"
          >
            <MessageCircle className="size-3.5" aria-hidden /> WhatsApp
          </a>
        )}
        <span className="flex-1" />
        {onEstado && r.estado === "nueva" && (
          <>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => onEstado("atendida")}
              className="h-8 rounded-full bg-vm-primary px-3 text-xs font-medium text-white disabled:opacity-50"
            >
              Marcar atendida
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => onEstado("cancelada")}
              className="h-8 rounded-full border px-3 text-xs font-medium text-vm-body disabled:opacity-50"
            >
              Cancelar
            </button>
          </>
        )}
        {onEstado && r.estado !== "nueva" && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => onEstado("nueva")}
            className="h-8 rounded-full border px-3 text-xs font-medium text-vm-body disabled:opacity-50"
          >
            Reabrir
          </button>
        )}
      </div>
    </li>
  );
}

function Bloqueado() {
  return (
    <div className="relative mt-8">
      <ul className="pointer-events-none space-y-3 select-none blur-sm" aria-hidden>
        {EJEMPLO.map((r) => (
          <Fila key={r.id} r={r} sucursal="Centro" tz="America/Mexico_City" />
        ))}
      </ul>
      <div className="absolute inset-0 grid place-items-center">
        <div className="max-w-sm rounded-xl border bg-white p-7 text-center shadow-vm-3">
          <Lock className="mx-auto size-8 text-vm-primary" aria-hidden />
          <h2 className="mt-4 text-xl">
            Las reservaciones son parte de los planes Pro y Enterprise.
          </h2>
          <p className="mt-2 text-sm text-vm-body">
            Tus clientes piden mesa desde el menú y tú las gestionas aquí.
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
  const { data: reservas, isLoading, isError } = useReservaciones(tenantId);
  const cambiar = useCambiarEstadoReservacion(tenantId);

  const [filtroSuc, setFiltroSuc] = useState<string | "todas">("todas");
  const [cuando, setCuando] = useState<"proximas" | "pasadas" | "todas">("proximas");

  const nombreSuc = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sucursales ?? []) m.set(s.id, s.nombre);
    return m;
  }, [sucursales]);
  const tzSuc = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sucursales ?? []) m.set(s.id, s.timezone);
    return m;
  }, [sucursales]);

  if (!ctx) return null;

  if (!ctx.plan.permite_reservaciones) {
    // Downgrade Pro→Basic: si quedaron solicitudes guardadas, se muestran en
    // solo-lectura (sin botones de estado) para que el negocio pueda al menos
    // leer nombre y teléfono del comensal. Sin filas: el muro de siempre.
    const guardadas = [...(reservas ?? [])].sort(
      (a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime(),
    );
    return (
      <>
        <PillTabs pestanas={PESTANAS_NEGOCIO} />
        <h1 className="text-2xl">Reservaciones</h1>
        <p className="mt-1 text-sm text-vm-body">Lo que tus clientes piden desde el menú.</p>
        {guardadas.length > 0 ? (
          <div className="mt-8">
            <div className="rounded-xl border border-vm-primary/30 bg-vm-primary/5 p-4 text-sm text-vm-body">
              <p>
                Tu plan ya no incluye reservaciones. Estas son las solicitudes que quedaron
                guardadas — vuelve a Pro para gestionarlas.
              </p>
              <Link
                to="/admin/suscripcion"
                className="mt-3 inline-flex h-10 items-center rounded-lg bg-vm-primary px-4 text-xs font-medium text-white hover:bg-vm-primary-hover"
              >
                Actualizar plan
              </Link>
            </div>
            <ul className="mt-6 space-y-3">
              {guardadas.map((r) => (
                <Fila
                  key={r.id}
                  r={r}
                  sucursal={nombreSuc.get(r.sucursal_id) ?? "Sucursal"}
                  tz={tzSuc.get(r.sucursal_id) ?? "America/Mexico_City"}
                />
              ))}
            </ul>
          </div>
        ) : (
          <Bloqueado />
        )}
      </>
    );
  }

  const ahora = Date.now();
  const visibles = (reservas ?? [])
    .filter((r) => (filtroSuc === "todas" ? true : r.sucursal_id === filtroSuc))
    .filter((r) => {
      const t = new Date(r.fecha_hora).getTime();
      if (cuando === "proximas") return t >= ahora;
      if (cuando === "pasadas") return t < ahora;
      return true;
    })
    // El hook trae las filas descendentes (para que el `limit` recorte las más
    // viejas). "Próximas" se lee mejor ascendente: la más cercana primero.
    .sort((a, b) => {
      const ta = new Date(a.fecha_hora).getTime();
      const tb = new Date(b.fecha_hora).getTime();
      return cuando === "proximas" ? ta - tb : tb - ta;
    });

  return (
    <>
      <PillTabs pestanas={PESTANAS_NEGOCIO} />
      <h1 className="text-2xl">Reservaciones</h1>
      <p className="mt-1 text-sm text-vm-body">Lo que tus clientes piden desde el menú.</p>

      {isError && (
        <div className="mt-8 rounded-lg bg-vm-danger-soft px-4 py-3 text-sm text-vm-danger">
          <p>No pudimos leer tus reservaciones. Intenta recargar.</p>
          <p className="mt-1 text-xs opacity-80">
            Si acabas de instalar la función, quizá falte correr la migración{" "}
            <code>vibemenu_migracion_reservaciones.sql</code>.
          </p>
        </div>
      )}
      {isLoading && <div className="mt-8 h-40 animate-pulse rounded-xl bg-vm-bg-soft" />}

      {reservas && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {(["proximas", "pasadas", "todas"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setCuando(k)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  cuando === k ? "bg-vm-primary text-white" : "bg-vm-bg-soft text-vm-body",
                )}
              >
                {k}
              </button>
            ))}
            {(sucursales?.length ?? 0) > 1 && (
              <select
                value={filtroSuc}
                onChange={(e) => setFiltroSuc(e.target.value)}
                className="ml-auto h-8 rounded-full border px-3 text-xs"
              >
                <option value="todas">Todas las sucursales</option>
                {(sucursales ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>

          {visibles.length === 0 ? (
            <div className="mt-8 grid place-items-center gap-2 rounded-xl border border-dashed py-16 text-center">
              <CalendarClock className="size-8 text-vm-body" aria-hidden />
              <p className="text-sm text-vm-body">
                {reservas.length === 0
                  ? "Aún no tienes reservaciones. Actívalas por sucursal en Sucursales."
                  : "Nada con este filtro."}
              </p>
            </div>
          ) : (
            <>
              {cambiar.isError && (
                <p className="mt-6 rounded-lg bg-vm-danger-soft px-4 py-3 text-sm text-vm-danger">
                  No pudimos actualizar la reservación. Intenta de nuevo.
                </p>
              )}
              <ul className="mt-6 space-y-3">
                {visibles.map((r) => (
                  <Fila
                    key={r.id}
                    r={r}
                    sucursal={nombreSuc.get(r.sucursal_id) ?? "Sucursal"}
                    tz={tzSuc.get(r.sucursal_id) ?? "America/Mexico_City"}
                    ocupado={cambiar.isPending}
                    onEstado={(estado) => cambiar.mutate({ id: r.id, estado })}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </>
  );
}
