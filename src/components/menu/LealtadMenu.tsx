import { useNavigate } from "@tanstack/react-router";
import { Loader2, Stamp } from "lucide-react";
import { useCrearTarjeta, useTarjeta, useTarjetaLocal } from "@/hooks/useLealtad";
import { progresoLealtad } from "@/lib/lealtad";

/**
 * Banner "Junta sellos" en el menú público. Solo aparece si el plan trae
 * lealtad y el negocio la tiene activa (`lealtad` no nulo). Sin tarjeta local
 * ofrece crearla; con tarjeta muestra el avance y lleva a la tarjeta.
 */
export default function LealtadMenu({
  tenantId,
  slug,
  lealtad,
}: {
  tenantId: string;
  slug: string;
  lealtad: { meta: number; premio: string } | null;
}) {
  const navigate = useNavigate();
  const { uuid, olvidar } = useTarjetaLocal(slug);
  const tarjeta = useTarjeta(slug, uuid);
  const crear = useCrearTarjeta(tenantId, slug);

  if (!lealtad) return null;

  // La tarjeta local existe pero el servidor ya no la tiene (purga de tarjetas
  // sin uso a los 14 días): no es un callejón sin salida, se ofrece crear una
  // nueva y se limpia la clave vieja al hacerlo.
  const tarjetaViva = Boolean(uuid) && Boolean(tarjeta.data);
  const cargandoTarjeta = Boolean(uuid) && tarjeta.isLoading;

  const borde = "color-mix(in srgb, var(--menu-texto) 12%, transparent)";

  const irATarjeta = (u: string) =>
    void navigate({ to: "/$slug/lealtad/$tarjetaId", params: { slug, tarjetaId: u } });

  const prog =
    uuid && tarjeta.data ? progresoLealtad(tarjeta.data.sellos, tarjeta.data.sellosMeta) : null;

  return (
    <section className="mx-auto max-w-2xl px-4 pb-8">
      <div className="rounded-2xl border p-5" style={{ borderColor: borde }}>
        <div className="flex items-center gap-3">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-full"
            style={{
              background: "color-mix(in srgb, var(--menu-primario) 10%, transparent)",
              color: "var(--menu-primario)",
            }}
          >
            <Stamp className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium" style={{ color: "var(--menu-texto)" }}>
              {prog ? `Tu tarjeta · ${prog.hechos}/${lealtad.meta}` : "Junta sellos"}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--menu-texto-suave)" }}>
              {prog
                ? prog.completa
                  ? `¡Listo! Enseña tu tarjeta para tu ${lealtad.premio}.`
                  : `Te faltan ${prog.faltan} para tu ${lealtad.premio}.`
                : `${lealtad.meta} sellos = ${lealtad.premio}.`}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={crear.isPending || cargandoTarjeta}
          onClick={() => {
            if (tarjetaViva && uuid) {
              irATarjeta(uuid);
              return;
            }
            if (uuid) olvidar();
            crear.mutate(undefined, { onSuccess: (u) => irATarjeta(u) });
          }}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--menu-primario)", color: "var(--menu-fondo)" }}
        >
          {crear.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {tarjetaViva ? "Ver mi tarjeta" : "Crear mi tarjeta"}
        </button>

        {crear.isError && (
          <p className="mt-2 text-xs" style={{ color: "#b91c1c" }}>
            {(crear.error as Error).message}
          </p>
        )}
      </div>
    </section>
  );
}
