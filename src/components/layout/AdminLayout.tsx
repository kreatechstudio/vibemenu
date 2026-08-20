import { useState, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "@tanstack/react-router";
import {
  Building2,
  ExternalLink,
  LayoutDashboard,
  Link2,
  Lock,
  LogOut,
  Menu as MenuIcon,
  Palette,
  QrCode,
  SlidersHorizontal,
  Store,
  UtensilsCrossed,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Logo from "@/components/marca/Logo";
import { useSesion, cerrarSesion } from "@/hooks/useSesion";
import { useTenantActual, type ContextoTenant } from "@/hooks/useTenantActual";
import { NOMBRE_FORMATO, NOMBRE_PLAN, type FormatoMenu, type NombrePlan } from "@/types/database";
import { cn } from "@/lib/utils";

type ItemNav = {
  a: string;
  etiqueta: string;
  icono: typeof LayoutDashboard;
  /** Devuelve el motivo del candado, o null si esta disponible. */
  bloqueado?: (ctx: ContextoTenant) => string | null;
};

const NAV: ItemNav[] = [
  { a: "/admin", etiqueta: "Resumen", icono: LayoutDashboard },
  { a: "/admin/menu", etiqueta: "Mi carta", icono: UtensilsCrossed },
  { a: "/admin/modificadores", etiqueta: "Modificadores", icono: SlidersHorizontal },
  { a: "/admin/sucursales", etiqueta: "Sucursales", icono: Store },
  { a: "/admin/empresa", etiqueta: "Mi negocio", icono: Building2 },
  { a: "/admin/diseno", etiqueta: "Diseño", icono: Palette },
  { a: "/admin/qr", etiqueta: "QR", icono: QrCode },
  {
    a: "/admin/equipo",
    etiqueta: "Equipo",
    icono: Users,
    // El candado sale de la tabla `planes`, no de una lista de planes en el codigo.
    bloqueado: (ctx) =>
      ctx.plan.permite_multiusuario ? null : "El trabajo en equipo es parte de Pro.",
  },
  {
    a: "/admin/suscripcion",
    etiqueta: "Suscripción",
    icono: Wallet,
    bloqueado: (ctx) => (ctx.esOwner ? null : "Solo el dueño administra la facturación."),
  },
];

const COLOR_ESTADO: Record<string, string> = {
  trial: "bg-vm-warning-soft text-vm-warning",
  activo: "bg-vm-success-soft text-vm-success",
  suspendido: "bg-vm-danger-soft text-vm-danger",
  cancelado: "bg-vm-danger-soft text-vm-danger",
};

function Sidebar({ ctx, alNavegar }: { ctx: ContextoTenant; alNavegar?: () => void }) {
  const { pathname } = useLocation();

  return (
    <div className="flex h-full flex-col bg-vm-bg-soft">
      <div className="px-5 py-5">
        <Logo tamano="sm" />
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ a, etiqueta, icono: Icono, bloqueado }) => {
          const motivo = bloqueado?.(ctx) ?? null;
          const activo = pathname === a;

          if (motivo) {
            return (
              <span
                key={a}
                title={motivo}
                aria-disabled="true"
                className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-vm-body/50"
              >
                <Icono className="size-4" aria-hidden />
                <span className="flex-1">{etiqueta}</span>
                <Lock className="size-3.5" aria-hidden />
              </span>
            );
          }

          return (
            <Link
              key={a}
              to={a}
              onClick={alNavegar}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                activo
                  ? "bg-white font-medium text-vm-primary shadow-vm-1"
                  : "text-vm-body hover:bg-white/60 hover:text-vm-ink",
              )}
            >
              <Icono className="size-4" aria-hidden />
              {etiqueta}
            </Link>
          );
        })}
      </nav>

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

function Cargando() {
  return <div className="min-h-screen animate-pulse bg-vm-bg-soft" aria-busy="true" />;
}

/**
 * Cascaron del panel. Es tambien el guard: sin sesion manda a /login.
 *
 * Un usuario autenticado sin tenant solo ocurre si se registro con confirmacion de
 * correo y perdio el borrador de localStorage antes de entrar. Se le explica en vez
 * de dejarlo en una pantalla rota.
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
  const [menuAbierto, setMenuAbierto] = useState(false);
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
            Tu cuenta existe, pero falta crear tu negocio. Vuelve a registrarlo con el mismo correo.
          </p>
          <Link
            to="/registro"
            className="mt-6 inline-flex h-12 items-center rounded-lg bg-vm-primary px-6 text-sm font-medium text-white"
          >
            Crear mi menú
          </Link>
        </div>
      </main>
    );
  }

  const urlMenu = `/${ctx.tenant.slug}`;

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden border-r lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar ctx={ctx} />
        </div>
      </aside>

      {menuAbierto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuAbierto(false)} />
          <div className="absolute inset-y-0 left-0 w-64 border-r">
            <Sidebar ctx={ctx} alNavegar={() => setMenuAbierto(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="flex h-16 items-center gap-3 border-b px-4 md:px-6">
          <button
            type="button"
            onClick={() => setMenuAbierto((v) => !v)}
            className="lg:hidden"
            aria-label="Abrir menú"
          >
            {menuAbierto ? <X className="size-5" /> : <MenuIcon className="size-5" />}
          </button>

          <div className="flex-1" />

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

        <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

interface AdminLayoutProps {
  children: ReactNode;
}

/** Nombre legible del formato activo, para el resumen. */
export const nombreFormato = (f: string) => NOMBRE_FORMATO[f as FormatoMenu] ?? f;
