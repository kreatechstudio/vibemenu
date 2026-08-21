import { useState } from "react";
import { Link, Navigate } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Loader2, LogOut } from "lucide-react";
import Logo from "@/components/marca/Logo";
import AvatarUsuario from "@/components/ui/avatar-usuario";
import { useSesion, cerrarSesion } from "@/hooks/useSesion";
import {
  useCambiarEstadoTenant,
  useCrearNotaInterna,
  useDetalleTenantSuperAdmin,
  useEsSuperAdmin,
  useNotasInternas,
} from "@/hooks/useSuperAdmin";
import { useUsoDelTenant } from "@/hooks/useTenantActual";
import { useVisitas } from "@/hooks/useVisitas";
import { formatearPrecio } from "@/lib/plan";
import { avisarError, avisarExito } from "@/lib/avisos";
import { COLOR_ESTADO, FECHA, FECHA_HORA, NOMBRE_ESTADO } from "@/lib/superadmin";
import { EMPRESA } from "@/lib/legal";
import {
  NOMBRE_PLAN,
  type EstadoTenant,
  type MonedaCobro,
  type NombrePlan,
} from "@/types/database";
import { cn } from "@/lib/utils";

const ESTADOS_TENANT: EstadoTenant[] = ["trial", "activo", "suspendido", "cancelado"];

function Cargando() {
  return <div className="min-h-screen animate-pulse bg-vm-bg-soft" aria-busy="true" />;
}

/** Una tarjeta blanca por bloque, igual que las tarjetas de totales de /superadmin. */
function Bloque({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border p-5 sm:p-6">
      <h2 className="text-sm font-medium text-vm-ink">{titulo}</h2>
      {nota && <p className="mt-1 text-xs text-vm-body">{nota}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FilaUso({
  etiqueta,
  usados,
  limite,
}: {
  etiqueta: string;
  usados: number;
  limite: number | null;
}) {
  return (
    <div className="flex items-center justify-between border-t py-2.5 text-sm first:border-t-0 first:pt-0">
      <span className="text-vm-body">{etiqueta}</span>
      <span className="vm-data text-vm-ink">
        {limite === null ? `${usados}` : `${usados} de ${limite}`}
      </span>
    </div>
  );
}

export default function SuperAdminDetalle({ tenantId }: { tenantId: string }) {
  const { user, cargando: cargandoSesion } = useSesion();
  const { data: esAdmin, isLoading: cargandoAdmin } = useEsSuperAdmin();
  const { data: detalle, isLoading, isError } = useDetalleTenantSuperAdmin(tenantId);
  const { data: uso } = useUsoDelTenant(esAdmin ? tenantId : undefined);
  const { data: visitas } = useVisitas(esAdmin ? tenantId : undefined);
  const notas = useNotasInternas(esAdmin ? tenantId : undefined);
  const cambiarEstado = useCambiarEstadoTenant();
  const crearNota = useCrearNotaInterna(tenantId);

  const [estadoElegido, setEstadoElegido] = useState<EstadoTenant | null>(null);
  const [textoNota, setTextoNota] = useState("");

  if (cargandoSesion || cargandoAdmin) return <Cargando />;
  if (!user) return <Navigate to="/login" />;
  if (!esAdmin) return <Navigate to="/admin" />;

  async function alGuardarEstado() {
    if (!estadoElegido || !detalle) return;
    try {
      await cambiarEstado.mutateAsync({ tenantId, estado: estadoElegido });
      avisarExito(`Estado cambiado a ${NOMBRE_ESTADO[estadoElegido]}.`);
      setEstadoElegido(null);
    } catch {
      avisarError("No pudimos cambiar el estado. Intenta de nuevo.");
    }
  }

  async function alMandarNota(e: React.FormEvent) {
    e.preventDefault();
    const texto = textoNota.trim();
    if (!texto) return;
    try {
      await crearNota.mutateAsync(texto);
      setTextoNota("");
    } catch {
      avisarError("No pudimos guardar la nota.");
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="flex h-16 items-center gap-3 border-b px-4 md:px-6">
        <Logo tamano="sm" />
        <span className="rounded-full bg-vm-primary/10 px-2.5 py-1 text-xs font-medium text-vm-primary">
          Super-admin
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => void cerrarSesion()}
          className="flex items-center gap-2 text-xs text-vm-body hover:text-vm-ink"
        >
          <LogOut className="size-3.5" aria-hidden />
          Cerrar sesión
        </button>
      </header>

      <main className="mx-auto max-w-4xl p-4 md:p-8">
        <Link
          to="/superadmin"
          className="inline-flex items-center gap-1.5 text-xs text-vm-body hover:text-vm-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Todos los negocios
        </Link>

        {isLoading && <div className="mt-6 h-64 animate-pulse rounded-xl bg-vm-bg-soft" />}

        {isError && (
          <p className="mt-6 rounded-lg bg-vm-danger-soft px-4 py-3 text-sm text-vm-danger">
            No pudimos leer este negocio. Falta correr{" "}
            <code>vibemenu_migracion_superadmin_v1.sql</code>.
          </p>
        )}

        {detalle && (
          <>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl">{detalle.tenant.nombre_negocio}</h1>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                      COLOR_ESTADO[detalle.tenant.estado] ?? "bg-vm-bg-soft text-vm-body",
                    )}
                  >
                    {detalle.tenant.estado}
                  </span>
                </div>
                <p className="mt-1 text-sm text-vm-body">
                  {NOMBRE_PLAN[(detalle.plan?.nombre as NombrePlan) ?? "free"]} · Alta el{" "}
                  {FECHA.format(new Date(detalle.tenant.created_at))}
                </p>
              </div>
              <a
                href={`https://${EMPRESA.dominio}/${detalle.tenant.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium text-vm-ink hover:bg-vm-bg-soft"
              >
                Ver su menú
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <Bloque titulo="Contacto y enlace">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-vm-body">Slug</dt>
                  <dd className="vm-data text-vm-ink">{detalle.tenant.slug}</dd>
                  <dt className="text-vm-body">Dominio propio</dt>
                  <dd className="vm-data text-vm-ink">
                    {detalle.tenant.dominio_personalizado ?? "—"}
                  </dd>
                  <dt className="text-vm-body">Giro</dt>
                  <dd className="text-vm-ink">{detalle.tenant.giro ?? "—"}</dd>
                  <dt className="text-vm-body">Teléfono</dt>
                  <dd className="vm-data text-vm-ink">{detalle.tenant.telefono ?? "—"}</dd>
                  <dt className="text-vm-body">WhatsApp</dt>
                  <dd className="vm-data text-vm-ink">{detalle.tenant.whatsapp ?? "—"}</dd>
                </dl>
              </Bloque>

              <Bloque
                titulo="Cambiar estado"
                nota="Fuera del webhook de Stripe — para desbloquear o suspender a mano."
              >
                <div className="flex items-center gap-2">
                  <select
                    value={estadoElegido ?? detalle.tenant.estado}
                    onChange={(e) => setEstadoElegido(e.target.value as EstadoTenant)}
                    className="h-11 flex-1 rounded-lg border px-3 text-sm outline-none focus:border-vm-primary"
                  >
                    {ESTADOS_TENANT.map((e) => (
                      <option key={e} value={e}>
                        {NOMBRE_ESTADO[e]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={
                      !estadoElegido ||
                      estadoElegido === detalle.tenant.estado ||
                      cambiarEstado.isPending
                    }
                    onClick={() => void alGuardarEstado()}
                    className="inline-flex h-11 items-center gap-2 rounded-lg bg-vm-primary px-4 text-sm font-medium text-white hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {cambiarEstado.isPending && (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    )}
                    Guardar
                  </button>
                </div>
              </Bloque>

              <Bloque titulo="Uso contra su plan">
                {uso ? (
                  <div>
                    <FilaUso
                      etiqueta="Productos"
                      usados={uso.productos}
                      limite={detalle.plan?.limite_productos ?? null}
                    />
                    <FilaUso
                      etiqueta="Sucursales"
                      usados={uso.sucursales}
                      limite={detalle.plan?.limite_sucursales ?? null}
                    />
                    <FilaUso
                      etiqueta="Usuarios"
                      usados={uso.usuarios}
                      limite={detalle.plan?.limite_usuarios ?? null}
                    />
                    <FilaUso
                      etiqueta="Grupos de modificadores"
                      usados={uso.gruposModificadores}
                      limite={detalle.plan?.limite_grupos_modificadores ?? null}
                    />
                  </div>
                ) : (
                  <div className="h-24 animate-pulse rounded-lg bg-vm-bg-soft" />
                )}
              </Bloque>

              <Bloque titulo="Visitas al menú">
                {visitas ? (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="vm-data text-xl text-vm-ink">{visitas.hoy}</p>
                      <p className="text-xs text-vm-body">Hoy</p>
                    </div>
                    <div>
                      <p className="vm-data text-xl text-vm-ink">{visitas.ultimos7}</p>
                      <p className="text-xs text-vm-body">7 días</p>
                    </div>
                    <div>
                      <p className="vm-data text-xl text-vm-ink">{visitas.ultimos30}</p>
                      <p className="text-xs text-vm-body">30 días</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-16 animate-pulse rounded-lg bg-vm-bg-soft" />
                )}
              </Bloque>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <Bloque titulo="Equipo">
                {detalle.equipo.length === 0 ? (
                  <p className="text-sm text-vm-body">Sin equipo todavía.</p>
                ) : (
                  <ul className="space-y-3">
                    {detalle.equipo.map((m) => (
                      <li key={m.user_id} className="flex items-center gap-2.5">
                        <AvatarUsuario nombre={m.nombre || m.email} avatarUrl={m.avatar_url} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-vm-ink">{m.nombre || m.email}</p>
                          <p className="truncate text-xs text-vm-body">{m.email}</p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                            m.rol === "owner"
                              ? "bg-vm-primary/10 text-vm-primary"
                              : "bg-vm-bg-soft text-vm-body",
                          )}
                        >
                          {m.rol === "owner" ? "Dueño" : "Encargado"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {detalle.invitaciones.filter((i) => i.estado === "pendiente").length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <p className="text-xs font-medium text-vm-body">Invitaciones pendientes</p>
                    <ul className="mt-2 space-y-1.5">
                      {detalle.invitaciones
                        .filter((i) => i.estado === "pendiente")
                        .map((i) => (
                          <li key={i.id} className="flex items-center justify-between text-xs">
                            <span className="text-vm-ink">{i.email}</span>
                            <span className="text-vm-body">
                              {new Date(i.expira_at) < new Date()
                                ? "Vencida"
                                : `Vence ${FECHA.format(new Date(i.expira_at))}`}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </Bloque>

              <Bloque titulo="Pagos">
                {detalle.pagos.length === 0 ? (
                  <p className="text-sm text-vm-body">Sin pagos registrados.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {detalle.pagos.slice(0, 8).map((p) => (
                      <li key={p.id} className="flex items-center justify-between text-sm">
                        <span className="text-vm-body">{FECHA.format(new Date(p.fecha_pago))}</span>
                        <div className="flex items-center gap-2">
                          <span className="vm-data text-vm-ink">
                            {formatearPrecio(p.monto, p.moneda as MonedaCobro)}
                          </span>
                          {p.stripe_hosted_invoice_url && (
                            <a
                              href={p.stripe_hosted_invoice_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-vm-primary hover:underline"
                            >
                              Recibo
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Bloque>
            </div>

            <div className="mt-5">
              <Bloque titulo="Notas internas" nota="Bitácora de soporte. No se edita ni se borra.">
                <form onSubmit={alMandarNota} className="flex gap-2">
                  <input
                    value={textoNota}
                    onChange={(e) => setTextoNota(e.target.value)}
                    placeholder="Qué se habló, qué se prometió, qué falta seguir…"
                    className="h-11 flex-1 rounded-lg border px-3.5 text-sm outline-none focus:border-vm-primary"
                  />
                  <button
                    type="submit"
                    disabled={!textoNota.trim() || crearNota.isPending}
                    className="inline-flex h-11 items-center gap-2 rounded-lg bg-vm-primary px-4 text-sm font-medium text-white hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {crearNota.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                    Agregar
                  </button>
                </form>

                {notas.data && notas.data.length > 0 && (
                  <ul className="mt-4 space-y-3 border-t pt-4">
                    {notas.data.map((n) => (
                      <li key={n.id} className="text-sm">
                        <p className="text-vm-ink">{n.texto}</p>
                        <p className="mt-0.5 text-xs text-vm-body">
                          {n.autor_id === user.id ? "Tú" : "Equipo"} ·{" "}
                          {FECHA_HORA.format(new Date(n.created_at))}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Bloque>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
