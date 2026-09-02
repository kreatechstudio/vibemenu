import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Copy, Gift, Lock, QrCode, Stamp } from "lucide-react";
import QRCode from "react-qr-code";
import AdminLayout from "@/components/layout/AdminLayout";
import PillTabs, { PESTANAS_NEGOCIO } from "@/components/layout/PillTabs";
import EscanerCodigo from "@/components/admin/EscanerCodigo";
import { useTenantActual, type ContextoTenant } from "@/hooks/useTenantActual";
import { useSucursales } from "@/hooks/useSucursales";
import {
  useBuscarTarjeta,
  useCanjear,
  useGuardarConfigLealtad,
  useMovimientosLealtad,
  useRecuperarTarjetas,
  useSellar,
  type VistaTarjeta,
} from "@/hooks/useAdminLealtad";
import { codigoValido, normalizarCodigo } from "@/lib/lealtad";

export default function Lealtad() {
  return (
    <AdminLayout>
      <Contenido />
    </AdminLayout>
  );
}

/** Detrás del muro, difuminadas. Nunca son datos reales. */
const EJEMPLO = [
  { codigo: "K7P2QM", sellos: 4, sellos_meta: 6, contacto: "55 •• •• 12" },
  { codigo: "R3XT9A", sellos: 6, sellos_meta: 6, contacto: "55 •• •• 88" },
  { codigo: "H8MW24", sellos: 1, sellos_meta: 6, contacto: "cli•••@gmail.com" },
];

function FilaEjemplo({ r }: { r: (typeof EJEMPLO)[number] }) {
  return (
    <li className="flex items-center justify-between rounded-xl border p-4">
      <div>
        <p className="font-mono text-sm font-medium text-vm-ink">{r.codigo}</p>
        <p className="mt-0.5 text-xs text-vm-body">{r.contacto}</p>
      </div>
      <span className="rounded-full bg-vm-primary/10 px-2.5 py-1 text-[11px] font-medium text-vm-primary">
        {r.sellos}/{r.sellos_meta}
      </span>
    </li>
  );
}

function Bloqueado() {
  return (
    <div className="relative mt-8">
      <ul className="pointer-events-none space-y-3 select-none blur-sm" aria-hidden>
        {EJEMPLO.map((r) => (
          <FilaEjemplo key={r.codigo} r={r} />
        ))}
      </ul>
      <div className="absolute inset-0 grid place-items-center">
        <div className="max-w-sm rounded-xl border bg-white p-7 text-center shadow-vm-3">
          <Lock className="mx-auto size-8 text-vm-primary" aria-hidden />
          <h2 className="mt-4 text-xl">
            La tarjeta de lealtad es parte de los planes Pro y Enterprise.
          </h2>
          <p className="mt-2 text-sm text-vm-body">
            Tus clientes juntan sellos desde el menú y tú los validas aquí.
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
  if (!ctx) return null;

  if (!ctx.plan.permite_lealtad) {
    return (
      <>
        <PillTabs pestanas={PESTANAS_NEGOCIO} />
        <h1 className="text-2xl">Lealtad</h1>
        <p className="mt-1 text-sm text-vm-body">
          Sellos que tus clientes juntan desde el menú y canjean contigo.
        </p>
        <Bloqueado />
      </>
    );
  }

  return <Panel ctx={ctx} />;
}

const SECCION = "mt-8 rounded-xl border p-5";
const INPUT = "h-10 rounded-lg border px-3 text-sm";
const BOTON_PRIMARIO =
  "h-10 rounded-lg bg-vm-primary px-5 text-sm font-medium text-white hover:bg-vm-primary-hover disabled:opacity-50";

function Panel({ ctx }: { ctx: ContextoTenant }) {
  const tenantId = ctx.tenant.id;
  const { data: sucursales } = useSucursales(tenantId);
  const guardarConfig = useGuardarConfigLealtad(tenantId);
  const buscar = useBuscarTarjeta();
  const sellar = useSellar(tenantId);
  const canjear = useCanjear(tenantId);
  const recuperar = useRecuperarTarjetas();
  const movimientos = useMovimientosLealtad(tenantId);

  const [activa, setActiva] = useState(ctx.tenant.lealtad_activa);
  const [meta, setMeta] = useState<number>(ctx.tenant.lealtad_sellos_meta ?? 6);
  const [premio, setPremio] = useState(ctx.tenant.lealtad_premio ?? "");

  const [codigo, setCodigo] = useState("");
  const [sucursalSel, setSucursalSel] = useState<string | null>(null);
  const [escanerAbierto, setEscanerAbierto] = useState(false);
  const [tarjetaActiva, setTarjetaActiva] = useState<VistaTarjeta | null>(null);
  const [contactoBuscar, setContactoBuscar] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);

  const multi = (sucursales?.length ?? 0) > 1;
  const sucursalEfectiva = multi ? (sucursalSel ?? sucursales?.[0]?.id ?? null) : null;
  const premioListo = Boolean(meta && premio.trim());
  const errorAccion = buscar.error ?? sellar.error ?? canjear.error;

  return (
    <>
      <PillTabs pestanas={PESTANAS_NEGOCIO} />
      <h1 className="text-2xl">Lealtad</h1>
      <p className="mt-1 text-sm text-vm-body">
        Sellos que tus clientes juntan desde el menú y canjean contigo.
      </p>

      {/* 1. Configuración */}
      <section className={SECCION}>
        <h2 className="text-lg">Configuración</h2>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            guardarConfig.mutate({
              lealtad_activa: activa,
              lealtad_sellos_meta: meta,
              lealtad_premio: premio.trim(),
            });
          }}
        >
          <label className="block text-sm">
            <span className="text-vm-body">Sellos para el premio</span>
            <input
              type="number"
              min={2}
              max={50}
              value={meta}
              onChange={(e) => setMeta(Number(e.target.value))}
              className={`mt-1 block w-24 ${INPUT}`}
            />
          </label>

          <label className="block text-sm">
            <span className="text-vm-body">Premio</span>
            <input
              type="text"
              maxLength={80}
              value={premio}
              onChange={(e) => setPremio(e.target.value)}
              placeholder="Un café gratis"
              className={`mt-1 block w-full max-w-sm ${INPUT}`}
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={activa}
              disabled={!premioListo}
              onChange={(e) => setActiva(e.target.checked)}
              className="size-4"
            />
            <span>Programa de lealtad activo</span>
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={guardarConfig.isPending || !premioListo}
              className={BOTON_PRIMARIO}
            >
              {guardarConfig.isPending ? "Guardando…" : "Guardar"}
            </button>
            {guardarConfig.isSuccess && (
              <span className="text-xs text-vm-success">Cambios guardados.</span>
            )}
          </div>

          {guardarConfig.isError && (
            <p className="rounded-lg bg-vm-danger-soft px-3 py-2 text-xs text-vm-danger">
              No pudimos guardar los cambios. Intenta de nuevo.
            </p>
          )}

          <p className="text-xs text-vm-body">
            Actívalo cuando el premio esté listo. Si lo apagas, las tarjetas se conservan.
          </p>
        </form>
      </section>

      {/* 2. Sellar / canjear */}
      <section className={SECCION}>
        <h2 className="text-lg">Sellar o canjear</h2>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="block text-sm">
            <span className="text-vm-body">Código de la tarjeta</span>
            <input
              value={codigo}
              onChange={(e) => setCodigo(normalizarCodigo(e.target.value))}
              maxLength={6}
              autoCapitalize="characters"
              placeholder="K7P2QM"
              className={`mt-1 block w-40 font-mono uppercase ${INPUT}`}
            />
          </label>
          <button
            type="button"
            onClick={() => setEscanerAbierto(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm text-vm-ink hover:bg-vm-bg-soft"
          >
            <QrCode className="size-4" aria-hidden /> Escanear
          </button>
          {multi && (
            <select
              value={sucursalEfectiva ?? ""}
              onChange={(e) => setSucursalSel(e.target.value)}
              className={INPUT}
            >
              {(sucursales ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            disabled={!codigoValido(codigo) || buscar.isPending}
            onClick={() => buscar.mutate(codigo, { onSuccess: setTarjetaActiva })}
            className={BOTON_PRIMARIO}
          >
            Buscar
          </button>
        </div>

        {errorAccion && (
          <p className="mt-3 rounded-lg bg-vm-danger-soft px-3 py-2 text-sm text-vm-danger">
            {errorAccion.message}
          </p>
        )}

        {tarjetaActiva && (
          <div className="mt-4 rounded-xl border p-4">
            <p className="font-mono text-sm font-medium text-vm-ink">{tarjetaActiva.codigo}</p>
            <p className="mt-1 text-sm text-vm-body">
              {tarjetaActiva.sellos}/{tarjetaActiva.sellosMeta} sellos ·{" "}
              {tarjetaActiva.premiosCanjeados}{" "}
              {tarjetaActiva.premiosCanjeados === 1 ? "premio canjeado" : "premios canjeados"}
            </p>
            <p className="mt-0.5 text-xs text-vm-body">Premio: {tarjetaActiva.premio}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={tarjetaActiva.selloRepetidoHoy || sellar.isPending}
                onClick={() =>
                  sellar.mutate(
                    { codigo: tarjetaActiva.codigo, sucursalId: sucursalEfectiva },
                    { onSuccess: setTarjetaActiva },
                  )
                }
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-vm-primary px-4 text-sm font-medium text-white hover:bg-vm-primary-hover disabled:opacity-50"
              >
                <Stamp className="size-4" aria-hidden />
                {tarjetaActiva.selloRepetidoHoy ? "Ya recibió su sello de hoy" : "Sellar"}
              </button>
              <button
                type="button"
                disabled={!tarjetaActiva.listoParaCanje || canjear.isPending}
                onClick={() =>
                  canjear.mutate(
                    { codigo: tarjetaActiva.codigo, sucursalId: sucursalEfectiva },
                    { onSuccess: setTarjetaActiva },
                  )
                }
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-4 text-sm font-medium text-vm-ink disabled:opacity-50"
              >
                <Gift className="size-4" aria-hidden /> Canjear premio
              </button>
            </div>
          </div>
        )}

        {escanerAbierto && (
          <EscanerCodigo
            onCodigo={(t) => {
              setCodigo(normalizarCodigo(t));
              setEscanerAbierto(false);
            }}
            onCerrar={() => setEscanerAbierto(false)}
          />
        )}
      </section>

      {/* 3. Recuperar tarjeta */}
      <section className={SECCION}>
        <h2 className="text-lg">Recuperar tarjeta</h2>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="block text-sm">
            <span className="text-vm-body">Teléfono o correo del cliente</span>
            <input
              value={contactoBuscar}
              onChange={(e) => setContactoBuscar(e.target.value)}
              placeholder="55 1234 5678"
              className={`mt-1 block w-64 ${INPUT}`}
            />
          </label>
          <button
            type="button"
            disabled={!contactoBuscar.trim() || recuperar.isPending}
            onClick={() => recuperar.mutate(contactoBuscar.trim())}
            className={BOTON_PRIMARIO}
          >
            Buscar
          </button>
        </div>

        {recuperar.isError && (
          <p className="mt-3 rounded-lg bg-vm-danger-soft px-3 py-2 text-sm text-vm-danger">
            {recuperar.error?.message}
          </p>
        )}

        {recuperar.data && recuperar.data.length === 0 && (
          <p className="mt-3 text-sm text-vm-body">No encontramos tarjetas con ese contacto.</p>
        )}

        {recuperar.data && recuperar.data.length > 0 && (
          <ul className="mt-4 space-y-3">
            {recuperar.data.map((item) => {
              const url = `${window.location.origin}/${ctx.tenant.slug}/lealtad/${item.id}`;
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-4 rounded-xl border p-4"
                >
                  <div className="rounded-lg bg-white p-2">
                    <QRCode value={item.codigo} size={90} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-medium text-vm-ink">{item.codigo}</p>
                    <p className="mt-0.5 text-xs text-vm-body">
                      {item.sellos}/{item.sellos_meta} · {item.contacto_enmascarado}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(url);
                        setCopiado(item.id);
                      }}
                      className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs text-vm-ink hover:bg-vm-bg-soft"
                    >
                      {copiado === item.id ? (
                        <Check className="size-3.5" aria-hidden />
                      ) : (
                        <Copy className="size-3.5" aria-hidden />
                      )}
                      {copiado === item.id ? "Enlace copiado" : "Copiar enlace"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-3 text-xs text-vm-body">
          Muéstrale el QR o pásale el enlace para que abra su tarjeta en su teléfono.
        </p>
      </section>

      {/* 4. Actividad */}
      <section className={SECCION}>
        <h2 className="text-lg">Actividad</h2>

        {movimientos.isError && (
          <p className="mt-3 rounded-lg bg-vm-danger-soft px-3 py-2 text-sm text-vm-danger">
            No pudimos leer la actividad reciente.
          </p>
        )}

        {movimientos.data && movimientos.data.length === 0 && (
          <p className="mt-3 text-sm text-vm-body">Aún no has sellado ninguna tarjeta.</p>
        )}

        {movimientos.data && movimientos.data.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-vm-body">
                  <th className="pb-2 pr-4 font-medium">Fecha</th>
                  <th className="pb-2 pr-4 font-medium">Tipo</th>
                  <th className="pb-2 pr-4 font-medium">Código</th>
                  <th className="pb-2 font-medium">Sucursal</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.data.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="py-2 pr-4 text-vm-body">
                      {new Date(m.creado_at).toLocaleString("es-MX")}
                    </td>
                    <td className="py-2 pr-4">{m.tipo === "canje" ? "Canje" : "Sello"}</td>
                    <td className="py-2 pr-4 font-mono">{m.tarjeta?.codigo ?? "—"}</td>
                    <td className="py-2">{m.sucursal?.nombre ?? "General"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
