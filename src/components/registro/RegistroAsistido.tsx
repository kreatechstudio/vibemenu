import { useEffect, useState } from "react";
import { Link, Navigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { MailCheck } from "lucide-react";
import { useSesion } from "@/hooks/useSesion";
import { useTenantActual } from "@/hooks/useTenantActual";
import PasoCuenta from "@/components/registro/pasos/PasoCuenta";
import PasoBienvenida from "@/components/registro/pasos/PasoBienvenida";
import PasoNegocio from "@/components/registro/pasos/PasoNegocio";
import PasoContacto from "@/components/registro/pasos/PasoContacto";
import PasoLogo from "@/components/registro/pasos/PasoLogo";
import PasoMetricas from "@/components/registro/pasos/PasoMetricas";
import PasoFelicidades from "@/components/registro/pasos/PasoFelicidades";

type Paso = "cuenta" | "bienvenida" | "negocio" | "contacto" | "logo" | "metricas" | "felicidades";

const PROGRESO: Partial<Record<Paso, number>> = {
  negocio: 1,
  contacto: 2,
  logo: 3,
  metricas: 4,
};

export default function RegistroAsistido() {
  const { user, cargando: cargandoSesion } = useSesion();
  const { data: ctx, isLoading: cargandoTenant } = useTenantActual();

  const [paso, setPaso] = useState<Paso | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [correoConfirmacion, setCorreoConfirmacion] = useState<string | null>(null);

  // Con sesión ya puesta (OAuth, o una recarga después de crear la cuenta) el
  // wizard arranca en Bienvenida — el copy de ahí ("Tu cuenta ya está lista")
  // solo tiene sentido si ya hay sesión. Sin sesión, arranca en Cuenta.
  useEffect(() => {
    if (cargandoSesion || paso !== null) return;
    setPaso(user ? "bienvenida" : "cuenta");
  }, [cargandoSesion, user, paso]);

  // Solo redirige si el tenant ya existía ANTES de esta sesión del wizard
  // (p.ej. OAuth con tenant previo). Una vez que PasoNegocio crea el tenant
  // localmente (tenantId), cualquier tenant que aparezca en la cache es obra
  // de este mismo wizard — no debe expulsar al usuario a mitad de flujo.
  if (!tenantId && !cargandoTenant && ctx) return <Navigate to="/admin" />;

  if (correoConfirmacion) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center shadow-vm-1">
        <MailCheck className="mx-auto size-10 text-vm-primary" aria-hidden />
        <h1 className="mt-5 text-2xl">Confirma tu correo</h1>
        <p className="mt-3 text-sm leading-relaxed text-vm-body">
          Te enviamos un enlace a{" "}
          <span className="font-medium text-vm-ink">{correoConfirmacion}</span>. Ábrelo desde
          este dispositivo para seguir armando tu negocio.
        </p>
        <Link
          to="/login"
          className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-lg border text-sm font-medium text-vm-ink hover:bg-vm-bg-soft"
        >
          Ir a entrar
        </Link>
      </div>
    );
  }

  if (cargandoSesion || cargandoTenant || paso === null) return null;

  const progreso = PROGRESO[paso];

  return (
    <div className="w-full">
      {progreso && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-medium text-vm-body">
            <span>Vibemenu</span>
            <span>Paso {progreso} de 4</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-vm-bg-soft">
            <div
              className="h-full rounded-full bg-vm-primary transition-all duration-300"
              style={{ width: `${(progreso / 4) * 100}%` }}
            />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={paso}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="rounded-xl border bg-white p-7 shadow-vm-1"
        >
          {paso === "cuenta" && (
            <PasoCuenta
              onListo={() => setPaso("bienvenida")}
              onConfirmarCorreo={setCorreoConfirmacion}
            />
          )}

          {paso === "bienvenida" && <PasoBienvenida onContinuar={() => setPaso("negocio")} />}

          {paso === "negocio" && (
            <PasoNegocio
              onCreado={(tenant) => {
                setTenantId(tenant.id);
                setNombreNegocio(tenant.nombreNegocio);
                setPaso("contacto");
              }}
              onAtras={() => setPaso("bienvenida")}
            />
          )}

          {paso === "contacto" && tenantId && (
            <PasoContacto tenantId={tenantId} onContinuar={() => setPaso("logo")} />
          )}

          {paso === "logo" && tenantId && (
            <PasoLogo tenantId={tenantId} onContinuar={() => setPaso("metricas")} />
          )}

          {paso === "metricas" && tenantId && (
            <PasoMetricas tenantId={tenantId} onContinuar={() => setPaso("felicidades")} />
          )}

          {paso === "felicidades" && <PasoFelicidades nombreNegocio={nombreNegocio} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
