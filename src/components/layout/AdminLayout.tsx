import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "@tanstack/react-router";
import {
  Building2,
  ExternalLink,
  LayoutDashboard,
  Link2,
  LogOut,
  Palette,
  QrCode,
  UtensilsCrossed,
} from "lucide-react";
import BannerFacturacion from "@/components/layout/BannerFacturacion";
import PanelBloqueado from "@/components/layout/PanelBloqueado";
import TutorialAyuda from "@/components/layout/TutorialAyuda";
import Logo from "@/components/marca/Logo";
import AvatarUsuario from "@/components/ui/avatar-usuario";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSesion, cerrarSesion } from "@/hooks/useSesion";
import { useTenantActual, type ContextoTenant } from "@/hooks/useTenantActual";
import { NOMBRE_FORMATO, NOMBRE_PLAN, type FormatoMenu, type NombrePlan } from "@/types/database";
import { nombreDeUsuario, avatarDeUsuario } from "@/lib/perfil";
import { cn } from "@/lib/utils";

type ItemNav = {
  a: string;
  etiqueta: string;
  icono: typeof LayoutDashboard;
  /** Otras rutas que cuelgan de esta sección (sus propias pestañas), para que sigan marcando el item activo. */
  cubre?: string[];
};

/**
 * Cinco secciones, no nueve: Modificadores vive dentro de Mi carta y
 * Sucursales/Equipo/Suscripción dentro de Mi negocio, cada una accesible ahí
 * con pills (ver `PillTabs`). Menos entradas también es lo que permite que la
 * barra inferior de móvil quepa todo de una vez, estilo app.
 */
const NAV: ItemNav[] = [
  { a: "/admin", etiqueta: "Resumen", icono: LayoutDashboard },
  {
    a: "/admin/menu",
    etiqueta: "Mi carta",
    icono: UtensilsCrossed,
    cubre: ["/admin/modificadores"],
  },
  {
    a: "/admin/empresa",
    etiqueta: "Mi negocio",
    icono: Building2,
    cubre: ["/admin/sucursales", "/admin/equipo", "/admin/suscripcion"],
  },
  { a: "/admin/diseno", etiqueta: "Diseño", icono: Palette },
  { a: "/admin/qr", etiqueta: "QR", icono: QrCode },
];

const esActivo = (item: ItemNav, pathname: string) =>
  pathname === item.a || (item.cubre?.includes(pathname) ?? false);

const COLOR_ESTADO: Record<string, string> = {
  trial: "bg-vm-warning-soft text-vm-warning",
  activo: "bg-vm-success-soft text-vm-success",
  suspendido: "bg-vm-danger-soft text-vm-danger",
  cancelado: "bg-vm-danger-soft text-vm-danger",
};

function Sidebar({ ctx }: { ctx: ContextoTenant }) {
  const { pathname } = useLocation();
  const { user } = useSesion();

  return (
    <div className="flex h-full flex-col bg-vm-bg-soft">
      <div className="px-5 py-5">
        <Logo tamano="sm" />
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const activo = esActivo(item, pathname);
          const Icono = item.icono;

          return (
            <Link
              key={item.a}
              to={item.a}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                activo
                  ? "bg-white font-medium text-vm-primary shadow-vm-1"
                  : "text-vm-body hover:bg-white/60 hover:text-vm-ink",
              )}
            >
              <Icono className="size-4" aria-hidden />
              {item.etiqueta}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2.5 border-t p-4">
        <AvatarUsuario nombre={nombreDeUsuario(user)} avatarUrl={avatarDeUsuario(user)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-vm-ink">{nombreDeUsuario(user)}</p>
          {user?.email && <p className="truncate text-xs text-vm-body">{user.email}</p>}
        </div>
      </div>

      <div className="border-t p-4">
        <p className="truncate text-sm font-medium text-vm-ink">{ctx.tenant.nombre_negocio}</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="rounded-full bg-vm-primary/10 px-2 py-0.5 text-[11px] font-medium text-vm-primary">
            {NOMBRE_PLAN[ctx.plan.nombre as NombrePlan]}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
              COLOR_ESTADO[ctx.tenant.estado] ?? "bg-vm-bg-soft text-vm-body",
            )}
          >
            {ctx.tenant.estado}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void cerrarSesion()}
          className="mt-3 flex items-center gap-2 text-xs text-vm-body hover:text-vm-ink"
        >
          <LogOut className="size-3.5" aria-hidden />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

/**
 * En escritorio la cuenta vive al pie de la barra lateral. En móvil, sin esa
 * barra, el avatar del header abre esto: mismos datos, en un menú chico.
 */
function MenuCuenta({ ctx }: { ctx: ContextoTenant }) {
  const { user } = useSesion();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="lg:hidden" aria-label="Tu cuenta">
        <AvatarUsuario nombre={nombreDeUsuario(user)} avatarUrl={avatarDeUsuario(user)} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-vm-ink">{nombreDeUsuario(user)}</p>
          {user?.email && <p className="truncate text-xs text-vm-body">{user.email}</p>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm text-vm-ink">{ctx.tenant.nombre_negocio}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="rounded-full bg-vm-primary/10 px-2 py-0.5 text-[11px] font-medium text-vm-primary">
              {NOMBRE_PLAN[ctx.plan.nombre as NombrePlan]}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                COLOR_ESTADO[ctx.tenant.estado] ?? "bg-vm-bg-soft text-vm-body",
              )}
            >
              {ctx.tenant.estado}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void cerrarSesion()} className="gap-2 text-vm-danger">
          <LogOut className="size-3.5" aria-hidden />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Barra de navegación estilo app, fija abajo. Solo en móvil: en escritorio manda la barra lateral. */
function BarraInferior() {
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-white/95 backdrop-blur-sm lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {NAV.map((item) => {
        const activo = esActivo(item, pathname);
        const Icono = item.icono;

        return (
          <Link
            key={item.a}
            to={item.a}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
              activo ? "text-vm-primary" : "text-vm-body",
            )}
          >
            <Icono className="size-5" aria-hidden />
            {item.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}

function Cargando() {
  return <div className="min-h-screen animate-pulse bg-vm-bg-soft" aria-busy="true" />;
}

/**
 * Cascaron del panel. Es tambien el guard: sin sesion manda a /login.
 *
 * Un usuario autenticado sin tenant pasa por /onboarding: ocurre con Google (no hay
 * paso previo donde llenar los datos del negocio) o con email si perdio el borrador
 * de localStorage antes de confirmar su correo.
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, cargando } = useSesion();
  const { data: ctx, isLoading } = useTenantActual();

  if (cargando || isLoading) return <Cargando />;
  if (!user) return <Navigate to="/login" />;

  if (!ctx) {
    return (
      <main className="grid min-h-screen place-items-center bg-white px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl text-vm-ink">Aún no tienes un menú</h1>
          <p className="mt-3 text-sm text-vm-body">
            Tu cuenta existe, pero falta crear tu negocio.
          </p>
          <Link
            to="/onboarding"
            className="mt-6 inline-flex h-12 items-center rounded-lg bg-vm-primary px-6 text-sm font-medium text-white"
          >
            Terminar de configurar
          </Link>
        </div>
      </main>
    );
  }

  if (ctx.tenant.estado === "suspendido") {
    return <PanelBloqueado tenantId={ctx.tenant.id} />;
  }

  const urlMenu = `/${ctx.tenant.slug}`;

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden border-r lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar ctx={ctx} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-16 items-center gap-3 border-b px-4 md:px-6">
          <MenuCuenta ctx={ctx} />

          <div className="flex-1" />

          <TutorialAyuda />

          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(window.location.origin + urlMenu)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm text-vm-ink hover:bg-vm-bg-soft"
          >
            <Link2 className="size-4" aria-hidden />
            <span className="hidden sm:inline">Copiar enlace</span>
          </button>

          <a
            href={urlMenu}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-vm-ink px-3 text-sm font-medium text-white"
          >
            <ExternalLink className="size-4" aria-hidden />
            <span className="hidden sm:inline">Ver mi menú</span>
          </a>
        </header>

        <BannerFacturacion ctx={ctx} />

        <main className="min-w-0 flex-1 p-4 pb-24 md:p-8 md:pb-24 lg:pb-8">{children}</main>
      </div>

      <BarraInferior />
    </div>
  );
}

interface AdminLayoutProps {
  children: ReactNode;
}

/** Nombre legible del formato activo, para el resumen. */
export const nombreFormato = (f: string) => NOMBRE_FORMATO[f as FormatoMenu] ?? f;
