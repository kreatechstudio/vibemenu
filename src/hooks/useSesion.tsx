import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type EstadoSesion = {
  session: Session | null;
  user: User | null;
  /** true mientras se resuelve la sesion inicial. Evita parpadeos de "no autenticado". */
  cargando: boolean;
};

const SesionContext = createContext<EstadoSesion | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>({
    session: null,
    user: null,
    cargando: true,
  });

  useEffect(() => {
    let vigente = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!vigente) return;
      setEstado({ session: data.session, user: data.session?.user ?? null, cargando: false });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, session) => {
      setEstado({ session, user: session?.user ?? null, cargando: false });
    });

    return () => {
      vigente = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <SesionContext.Provider value={estado}>{children}</SesionContext.Provider>;
}

export function useSesion(): EstadoSesion {
  const ctx = useContext(SesionContext);
  if (!ctx) throw new Error("useSesion debe usarse dentro de <SesionProvider>");
  return ctx;
}

export async function cerrarSesion() {
  await supabase.auth.signOut();
}
