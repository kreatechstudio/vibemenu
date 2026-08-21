import { Link } from "@tanstack/react-router";
import Logo from "@/components/marca/Logo";
import { FOOTER } from "@/lib/copy";

export default function Footer() {
  return (
    <footer className="mt-auto border-t bg-vm-bg-soft">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-[2fr_1fr_1fr_1fr] md:px-10">
        <div className="max-w-sm">
          <Link to="/" aria-label="Vibemenu, inicio">
            <Logo />
          </Link>
          <p className="mt-3 font-display text-base font-bold text-vm-ink">{FOOTER.tagline}</p>
          <p className="mt-2 text-sm leading-relaxed text-vm-body">{FOOTER.descripcion}</p>
        </div>

        <nav aria-label="Producto">
          <p className="text-sm font-medium text-vm-ink">Producto</p>
          <ul className="mt-4 space-y-3 text-sm text-vm-body">
            <li>
              <a href="/#formatos" className="hover:text-vm-ink">
                Formatos
              </a>
            </li>
            <li>
              <Link to="/precios" className="hover:text-vm-ink">
                Precios
              </Link>
            </li>
            <li>
              <Link to="/demo" className="hover:text-vm-ink">
                Demo
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Cuenta">
          <p className="text-sm font-medium text-vm-ink">Cuenta</p>
          <ul className="mt-4 space-y-3 text-sm text-vm-body">
            <li>
              <Link to="/registro" className="hover:text-vm-ink">
                Crear mi menú
              </Link>
            </li>
            <li>
              <Link to="/login" className="hover:text-vm-ink">
                Entrar
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Legal">
          <p className="text-sm font-medium text-vm-ink">Legal</p>
          <ul className="mt-4 space-y-3 text-sm text-vm-body">
            <li>
              <Link to="/privacidad" className="hover:text-vm-ink">
                Privacidad
              </Link>
            </li>
            <li>
              <Link to="/cookies" className="hover:text-vm-ink">
                Cookies
              </Link>
            </li>
            <li>
              <a
                href={FOOTER.estadoUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-vm-ink"
              >
                {FOOTER.estadoLabel}
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t">
        <p className="mx-auto max-w-7xl px-4 py-6 text-sm text-vm-body md:px-10">
          © {new Date().getFullYear()} Vibemenu. {FOOTER.tagline}
        </p>
      </div>
    </footer>
  );
}
