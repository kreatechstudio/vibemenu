import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Lock, Trash2, UserPlus } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useTenantActual } from "@/hooks/useTenantActual";
import { useEquipo, useInvitarEncargado, useQuitarDelEquipo } from "@/hooks/useEquipo";
import { useSesion } from "@/hooks/useSesion";
import { traducirError } from "@/lib/errores";
import { alcanzoLimite } from "@/lib/plan";
import type { MiembroEquipo } from "@/hooks/useEquipo";

export default function Equipo() {
  return (
    <AdminLayout>
      <Contenido />
    </AdminLayout>
  );
}

const FECHA = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });

/** Tabla de ejemplo, difuminada detrás del muro. Nunca son datos reales. */
const EJEMPLO: MiembroEquipo[] = [
  { user_id: "1", email: "dueño@cafeaurora.mx", rol: "owner", created_at: "2026-01-10" },
  { user_id: "2", email: "gerente@cafeaurora.mx", rol: "encargado", created_at: "2026-03-02" },
];

function Tabla({
  miembros,
  userIdActual,
  puedeQuitar,
  alQuitar,
}: {
  miembros: MiembroEquipo[];
  userIdActual?: string;
  puedeQuitar: boolean;
  alQuitar?: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-vm-bg-soft text-left text-xs text-vm-body">
          <tr>
            <th className="px-5 py-3 font-medium">Correo</th>
            <th className="px-5 py-3 font-medium">Rol</th>
            <th className="px-5 py-3 font-medium">Desde</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {miembros.map((m) => {
            const esOwner = m.rol === "owner";
            return (
              <tr key={m.user_id} className="border-t">
                <td className="px-5 py-3.5 text-vm-ink">
                  {m.email}
                  {m.user_id === userIdActual && (
                    <span className="ml-2 rounded-full bg-vm-bg-soft px-2 py-0.5 text-[11px] text-vm-body">
                      Tú
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={
                      esOwner
                        ? "rounded-full bg-vm-primary/10 px-2.5 py-1 text-xs font-medium text-vm-primary"
                        : "rounded-full bg-vm-bg-soft px-2.5 py-1 text-xs font-medium text-vm-body"
                    }
                  >
                    {esOwner ? "Dueño" : "Encargado"}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-vm-body">{FECHA.format(new Date(m.created_at))}</td>
                <td className="px-5 py-3.5 text-right">
                  {/* Al dueño no se le puede quitar: lo impide el índice uniq_owner_por_tenant. */}
                  {puedeQuitar && !esOwner && (
                    <button
                      type="button"
                      onClick={() => alQuitar?.(m.user_id)}
                      aria-label={`Quitar a ${m.email}`}
                      className="text-vm-danger"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Bloqueado() {
  return (
    <div className="relative mt-8">
      <div className="pointer-events-none select-none blur-sm" aria-hidden>
        <Tabla miembros={EJEMPLO} puedeQuitar={false} />
      </div>

      <div className="absolute inset-0 grid place-items-center">
        <div className="max-w-sm rounded-xl border bg-white p-7 text-center shadow-vm-3">
          <Lock className="mx-auto size-8 text-vm-primary" aria-hidden />
          <h2 className="mt-4 text-xl">El trabajo en equipo es parte de Pro.</h2>
          <p className="mt-2 text-sm text-vm-body">
            Da acceso a tus encargados para que actualicen la carta sin tocar tu facturación.
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
  const { user } = useSesion();
  const { data: equipo, isLoading, isError } = useEquipo(ctx?.tenant.id);
  const quitar = useQuitarDelEquipo(ctx?.tenant.id);
  const invitar = useInvitarEncargado(ctx?.tenant.id);

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  if (!ctx) return null;

  const { plan, esOwner } = ctx;

  if (!plan.permite_multiusuario) {
    return (
      <>
        <h1 className="text-2xl">Equipo</h1>
        <p className="mt-1 text-sm text-vm-body">Quién puede entrar a administrar tu menú.</p>
        <Bloqueado />
      </>
    );
  }

  const total = equipo?.length ?? 0;
  const topado = alcanzoLimite(plan.limite_usuarios, total);

  async function alInvitar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    try {
      await invitar.mutateAsync(email.trim());
      setAviso(`Le enviamos una invitación a ${email.trim()}.`);
      setEmail("");
    } catch (err) {
      const mensaje = (err as Error).message ?? "";
      // "No existe" y "no la pude contactar" son cosas distintas. Un fallo de CORS
      // llega como error de red y decir "falta desplegar" manda a depurar mal.
      setError(
        /404|not found/i.test(mensaje)
          ? "La función `invitar-encargado` no está desplegada."
          : /failed to send|failed to fetch/i.test(mensaje)
            ? "No pudimos contactar el servidor. Revisa tu conexión y vuelve a intentar."
            : traducirError(err as Error).mensaje,
      );
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">Equipo</h1>
          <p className="mt-1 text-sm text-vm-body">
            {plan.limite_usuarios === null
              ? `${total} usuarios`
              : `${total} de ${plan.limite_usuarios} usuarios`}
            . Los encargados administran la carta, pero no la facturación.
          </p>
        </div>
      </div>

      {isLoading && <div className="mt-8 h-40 animate-pulse rounded-xl bg-vm-bg-soft" />}

      {isError && (
        <p className="mt-8 rounded-lg bg-vm-danger-soft px-4 py-3 text-sm text-vm-danger">
          No pudimos leer tu equipo. Falta correr la migración{" "}
          <code>vibemenu_migracion_equipo.sql</code>.
        </p>
      )}

      {equipo && (
        <>
          <div className="mt-8">
            <Tabla
              miembros={equipo}
              userIdActual={user?.id}
              puedeQuitar={esOwner}
              alQuitar={(id) => void quitar.mutateAsync(id)}
            />
          </div>

          {esOwner && (
            <form onSubmit={alInvitar} className="mt-8 max-w-lg rounded-xl border p-5">
              <label htmlFor="invitado" className="text-sm font-medium text-vm-ink">
                Invitar encargado
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="invitado"
                  type="email"
                  required
                  disabled={topado}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="gerente@tunegocio.mx"
                  className="h-12 flex-1 rounded-lg border px-4 text-sm outline-none focus:border-vm-primary disabled:bg-vm-bg-soft"
                />
                <button
                  type="submit"
                  disabled={topado || invitar.isPending}
                  className="inline-flex h-12 items-center gap-2 rounded-lg bg-vm-primary px-5 text-sm font-medium text-white hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {invitar.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <UserPlus className="size-4" aria-hidden />
                  )}
                  Invitar
                </button>
              </div>

              {topado && plan.limite_usuarios !== null && (
                <p className="mt-3 text-sm text-vm-warning">
                  Tu plan permite hasta {plan.limite_usuarios} usuarios.{" "}
                  <Link to="/admin/suscripcion" className="font-medium underline">
                    Actualiza tu plan
                  </Link>{" "}
                  para agregar más.
                </p>
              )}
              {error && <p className="mt-3 text-sm text-vm-danger">{error}</p>}
              {aviso && <p className="mt-3 text-sm text-vm-success">{aviso}</p>}
            </form>
          )}
        </>
      )}
    </>
  );
}
