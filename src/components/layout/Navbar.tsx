import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Logo from "@/components/marca/Logo";
import { NAVBAR } from "@/lib/copy";
import { useSesion } from "@/hooks/useSesion";
import { cn } from "@/lib/utils";

const DESTINOS: Record<string, string> = {
  Producto: "/#producto",
  Formatos: "/#formatos",
  Precios: "/precios",
  Demo: "/demo",
};

export default function Navbar() {
  const [abierto, setAbierto] = useState(false);
  const [conScroll, setConScroll] = useState(false);

  // En SSR no hay sesion y `cargando` arranca en true, asi que el primer render del
  // cliente coincide con el del servidor: no hay hydration mismatch. Una vez resuelta
  // la sesion, los botones cambian a "Mi panel".
  const { user, cargando } = useSesion();
  const conSesion = !cargando && Boolean(user);

  useEffect(() => {
    const alScrollear = () => setConScroll(window.scrollY > 8);
    alScrollear();
    window.addEventListener("scroll", alScrollear, { passive: true });
    return () => window.removeEventListener("scroll", alScrollear);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b bg-white/95 backdrop-blur transition-shadow",
        conScroll ? "shadow-vm-1" : "shadow-none",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-10">
        <Link to="/" aria-label="Vibemenu, inicio">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {NAVBAR.links.map((link) => (
            <li key={link}>
              <a
                href={DESTINOS[link]}
                className="text-sm text-vm-body transition-colors hover:text-vm-ink"
              >
                {link}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          {conSesion ? (
            <Link
              to="/admin"
              className="inline-flex h-11 items-center rounded-lg bg-vm-primary px-5 text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover"
            >
              Mi panel
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex h-11 items-center rounded-lg border px-5 text-sm font-medium text-vm-ink transition-colors hover:bg-vm-bg-soft"
              >
                Entrar
              </Link>
              <Link
                to="/registro"
                className="inline-flex h-11 items-center rounded-lg bg-vm-primary px-5 text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover"
              >
                {NAVBAR.cta}
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="md:hidden"
          aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={abierto}
        >
          {abierto ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </nav>

      {abierto && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="overflow-hidden border-t md:hidden"
        >
          <ul className="space-y-1 px-4 py-4">
            {NAVBAR.links.map((link) => (
              <li key={link}>
                <a
                  href={DESTINOS[link]}
                  onClick={() => setAbierto(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm text-vm-body hover:bg-vm-bg-soft"
                >
                  {link}
                </a>
              </li>
            ))}
            {conSesion ? (
              <li className="pt-2">
                <Link
                  to="/admin"
                  onClick={() => setAbierto(false)}
                  className="flex h-12 items-center justify-center rounded-lg bg-vm-primary text-sm font-medium text-white"
                >
                  Mi panel
                </Link>
              </li>
            ) : (
              <>
                <li className="pt-2">
                  <Link
                    to="/login"
                    onClick={() => setAbierto(false)}
                    className="flex h-12 items-center justify-center rounded-lg border text-sm font-medium text-vm-ink"
                  >
                    Entrar
                  </Link>
                </li>
                <li>
                  <Link
                    to="/registro"
                    onClick={() => setAbierto(false)}
                    className="flex h-12 items-center justify-center rounded-lg bg-vm-primary text-sm font-medium text-white"
                  >
                    {NAVBAR.cta}
                  </Link>
                </li>
              </>
            )}
          </ul>
        </motion.div>
      )}
    </header>
  );
}
