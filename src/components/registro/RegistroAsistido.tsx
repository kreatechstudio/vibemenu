import { useEffect, useState } from "react";
import { Link, Navigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { MailCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSesion } from "@/hooks/useSesion";
import { useTenantActual } from "@/hooks/useTenantActual";
import {
  guardarProgresoWizard,
  leerProgresoWizard,
  limpiarProgresoWizard,
} from "@/lib/registro";
import PasoCuenta from "@/components/registro/pasos/PasoCuenta";
import PasoBienvenida from "@/components/registro/pasos/PasoBienvenida";
import PasoNegocio from "@/components/registro/pasos/PasoNegocio";
import PasoContacto from "@/components/registro/pasos/PasoContacto";
import PasoSucursal from "@/components/registro/pasos/PasoSucursal";
import PasoLogo from "@/components/registro/pasos/PasoLogo";
import PasoMetricas from "@/components/registro/pasos/PasoMetricas";
import PasoFelicidades from "@/components/registro/pasos/PasoFelicidades";

type Paso =
  | "cuenta"
  | "bienvenida"
  | "negocio"
  | "contacto"
  | "sucursal"
  | "logo"
  | "metricas"
  | "felicidades";

const PASOS_CON_TENANT: Paso[] = ["contacto", "sucursal", "logo", "metricas"];

const TOTAL_PASOS = 5;
const PROGRESO: Partial<Record<Paso, number>> = {
  negocio: 1,
  contacto: 2,
  sucursal: 3,
  logo: 4,
  metricas: 5,
};

function Cargando() {
  return <div className="min-h-screen animate-pulse bg-vm-bg-soft" aria-busy="true" />;
}

export default function RegistroAsistido() {
  const { user, cargando: cargandoSesion } = useSesion();
  const { data: ctx, isLoading: cargandoTenant } = useTenantActual();

  const [paso, setPaso] = useState<Paso | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [correoConfirmacion, setCorreoConfirmacion] = useState<string | null>(null);
  const [reenviado, setReenviado] = useState(false);

  // Decide dónde arranca, UNA vez que sabemos si hay sesión y si el tenant
  // actual ya existe. Va antes que el guard de abajo a propósito: mientras
  // `paso` siga null, `Cargando` se muestra y el guard nunca llega a evaluar
  // con datos a medias.
  useEffect(() => {
    if (cargandoSesion || cargandoTenant || paso !== null) return;

    if (!user) {
      setPaso("cuenta");
      return;
    }

    // Progreso guardado de una sesión anterior del wizard (mismo usuario, el
    // tenant que se estaba armando sigue coincidiendo con el que ve el server,
    // o el server todavía no lo ve porque el trigger que crea tenant_usuarios
    // corrió pero la consulta no había refrescado). Sin esto, refrescar en
    // Contacto/Sucursal/Logo/Métricas expulsaba a /admin a medio armar.
    const guardado = leerProgresoWizard();
    if (
      guardado &&
      guardado.userId === user.id &&
      guardado.paso !== "felicidades" &&
      (!ctx || ctx.tenant.id === guardado.tenantId)
    ) {
      setTenantId(guardado.tenantId);
      setNombreNegocio(guardado.nombreNegocio);
      setPaso(guardado.paso as Paso);
      return;
    }

    setPaso("bienvenida");
  }, [cargandoSesion, cargandoTenant, user, ctx, paso]);

  // Mantiene el progreso al día en cada paso, para que un refresh a medio
  // camino retome justo aquí en vez de mandar a /admin (ver efecto de arriba).
  useEffect(() => {
    if (!tenantId || !paso || !user) return;
    if (paso === "felicidades") {
      limpiarProgresoWizard();
      return;
    }
    if (PASOS_CON_TENANT.includes(paso)) {
      guardarProgresoWizard({ userId: user.id, tenantId, paso, nombreNegocio });
    }
  }, [tenantId, paso, nombreNegocio, user]);

  // Solo redirige si el tenant ya existía ANTES de esta sesión del wizard
  // (p.ej. OAuth con tenant previo, o esta pestaña nunca lo creó ni lo retomó).
  // Al llegar aquí, `paso` ya no es null: el efecto de arriba ya tuvo su
  // oportunidad de restaurar `tenantId` desde el progreso guardado.
  if (!tenantId && ctx) return <Navigate to="/admin" />;

  if (correoConfirmacion) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center shadow-vm-1">
        <MailCheck className="mx-auto size-10 text-vm-primary" aria-hidden />
        <h1 className="mt-5 text-2xl">Confirma tu correo</h1>
        <p className="mt-3 text-sm leading-relaxed text-vm-body">
          Te enviamos un enlace a{" "}
          <span className="font-medium text-vm-ink">{correoConfirmacion}</span>. Ábrelo desde este
          dispositivo para seguir armando tu negocio.
        </p>
        <Link
          to="/login"
          className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-lg border text-sm font-medium text-vm-ink hover:bg-vm-bg-soft"
        >
          Ir a entrar
        </Link>
        {reenviado ? (
          <p className="mt-3 text-xs text-vm-body">Listo, te reenviamos el enlace.</p>
        ) : (
          <button
            type="button"
            onClick={() => {
              setReenviado(true);
              void supabase.auth
                .resend({ type: "signup", email: correoConfirmacion })
                .catch(() => setReenviado(false));
            }}
            className="mt-3 text-xs font-medium text-vm-primary hover:underline"
          >
            No me llegó — reenviar
          </button>
        )}
      </div>
    );
  }

  if (cargandoSesion || cargandoTenant || paso === null) return <Cargando />;

  const progreso = PROGRESO[paso];

  return (
    <div className="w-full">
      {progreso && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-medium text-vm-body">
            <span>Vibemenu</span>
            <span>
              Paso {progreso} de {TOTAL_PASOS}
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-vm-bg-soft">
            <div
              className="h-full rounded-full bg-vm-primary transition-all duration-300"
              style={{ width: `${(progreso / TOTAL_PASOS) * 100}%` }}
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
            <PasoContacto tenantId={tenantId} onContinuar={() => setPaso("sucursal")} />
          )}

          {paso === "sucursal" && tenantId && (
            <PasoSucursal tenantId={tenantId} onContinuar={() => setPaso("logo")} />
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
