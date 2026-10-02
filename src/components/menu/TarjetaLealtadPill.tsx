import { useNavigate } from "@tanstack/react-router";
import { Loader2, Stamp } from "lucide-react";
import { CLASE_PILL_ACCION, ESTILO_PILL_ACCION } from "@/components/menu/ContactoMenu";
import { useCrearTarjeta, useTarjeta, useTarjetaLocal } from "@/hooks/useLealtad";

/**
 * Pill "Mi tarjeta" en `BarraInferior`, junto a Reseñas y Reservar — acceso
 * rápido sin tener que bajar hasta la tarjeta de `LealtadMenu`. Misma lógica
 * de crear-o-ver que esa tarjeta: con uuid local y vivo, navega directo; si no,
 * crea una nueva (y limpia el uuid viejo si el servidor ya la purgó).
 */
export default function TarjetaLealtadPill({ tenantId, slug }: { tenantId: string; slug: string }) {
  const navigate = useNavigate();
  const { uuid, olvidar } = useTarjetaLocal(slug);
  const tarjeta = useTarjeta(slug, uuid);
  const crear = useCrearTarjeta(tenantId, slug);

  const tarjetaViva = Boolean(uuid) && Boolean(tarjeta.data);
  const cargando = Boolean(uuid) && tarjeta.isLoading;

  const irATarjeta = (u: string) =>
    void navigate({ to: "/$slug/lealtad/$tarjetaId", params: { slug, tarjetaId: u } });

  function alHacerClic() {
    if (tarjetaViva && uuid) {
      irATarjeta(uuid);
      return;
    }
    if (uuid) olvidar();
    crear.mutate(undefined, { onSuccess: irATarjeta });
  }

  return (
    <button
      type="button"
      onClick={alHacerClic}
      disabled={crear.isPending || cargando}
      className={CLASE_PILL_ACCION}
      style={ESTILO_PILL_ACCION}
    >
      {crear.isPending || cargando ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Stamp className="size-4" aria-hidden />
      )}
      Mi tarjeta
    </button>
  );
}
