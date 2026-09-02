import { createContext, useCallback, useContext, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { claveDedup, yaRegistrada, type TipoInteraccion } from "@/lib/analitica";

type Analitica = {
  registrarVista: (productoId: string) => void;
  registrarAgregado: (productoId: string) => void;
};

const NOOP: Analitica = { registrarVista: () => {}, registrarAgregado: () => {} };

const Ctx = createContext<Analitica | null>(null);

/**
 * Cuenta interacciones por platillo del menú público (sub-proyecto #5).
 *
 * `habilitado` = `planes.permite_analitica_platillo` (Enterprise). Cuando es
 * `false` no hay tenant, o ya se contó esta hora, las funciones son no-ops.
 * Fire-and-forget: un menú público jamás se rompe por una métrica. La RPC
 * `SECURITY DEFINER` revalida plan + pertenencia y nunca lanza.
 */
export function AnaliticaProvider({
  tenantId,
  sucursalId,
  habilitado,
  children,
}: {
  tenantId: string;
  sucursalId: string | null;
  habilitado: boolean;
  children: React.ReactNode;
}) {
  const registrar = useCallback(
    (productoId: string, tipo: TipoInteraccion) => {
      if (!habilitado || !tenantId || !productoId) return;
      if (yaRegistrada(claveDedup(tenantId, sucursalId, productoId, tipo, new Date()))) return;
      void supabase.rpc("registrar_interaccion_producto", {
        p_tenant_id: tenantId,
        p_producto_id: productoId,
        p_tipo: tipo,
        p_sucursal_id: sucursalId ?? undefined,
      });
    },
    [habilitado, tenantId, sucursalId],
  );

  const valor = useMemo<Analitica>(
    () => ({
      registrarVista: (id) => registrar(id, "vista"),
      registrarAgregado: (id) => registrar(id, "agregado"),
    }),
    [registrar],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAnalitica(): Analitica {
  return useContext(Ctx) ?? NOOP;
}
