import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { useSesion } from "@/hooks/useSesion";
import { useTenantActual } from "@/hooks/useTenantActual";

/**
 * Aterrizaje de Google (y de cualquier otro proveedor OAuth que se agregue
 * despues). supabase-js procesa el token de la URL solo al cargar y dispara
 * el cambio de sesion que useSesion ya escucha; aqui solo esperamos ese
 * cambio y decidimos: con tenant -> admin, sin tenant -> onboarding, sin
 * sesion tras unos segundos (canceló el OAuth) -> login.
 */
export default function CompletarAcceso() {
  const navigate = useNavigate();
  const { user, cargando: cargandoSesion } = useSesion();
  const { data: ctx, isLoading: cargandoTenant } = useTenantActual();
  const [vencido, setVencido] = useState(false);

  useEffect(() => {
    const espera = setTimeout(() => setVencido(true), 6000);
    return () => clearTimeout(espera);
  }, []);

  useEffect(() => {
    if (cargandoSesion) return;

    if (!user) {
      if (vencido) void navigate({ to: "/login" });
      return;
    }

    if (cargandoTenant) return;
    void navigate({ to: ctx ? "/admin" : "/onboarding" });
  }, [cargandoSesion, user, cargandoTenant, ctx, vencido, navigate]);

  return (
    <Layout>
      <section className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
        <Loader2 className="size-6 animate-spin text-vm-primary" aria-hidden />
        <p className="mt-4 text-sm text-vm-body">Entrando…</p>
      </section>
    </Layout>
  );
}
