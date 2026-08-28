import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import ContactoMenu from "@/components/menu/ContactoMenu";
import HeaderMenu from "@/components/menu/HeaderMenu";
import Clasico from "@/components/formatos/Clasico";
import Pinterest from "@/components/formatos/Pinterest";
import Instagram from "@/components/formatos/Instagram";
import TikTok from "@/components/formatos/TikTok";
import { CATEGORIAS_DEMO, SUCURSAL_DEMO, TENANT_DEMO } from "@/lib/demo";
import { resolverTema, variablesDeTema } from "@/lib/tema";
import { FORMATOS, NOMBRE_FORMATO, type FormatoMenu } from "@/types/database";
import { cn } from "@/lib/utils";

const COMPONENTES = {
  clasico: Clasico,
  pinterest: Pinterest,
  instagram: Instagram,
  tiktok: TikTok,
};

/**
 * `/demo` — los 4 formatos navegables con datos ficticios, sin controles de edicion.
 *
 * No consulta la base: usa las fixtures de lib/demo.ts. Asi la demo funciona
 * aunque todavia no exista ningun tenant registrado.
 *
 * El switcher NO es parte del menu: es andamiaje de la demo y va flotando encima.
 */
export default function Demo() {
  const [formato, setFormato] = useState<FormatoMenu>("pinterest");
  const tema = resolverTema(TENANT_DEMO.tema, formato);
  const Formato = COMPONENTES[formato];

  return (
    <div className="relative min-h-dvh">
      {/* Andamiaje de la demo */}
      <div className="fixed inset-x-0 top-0 z-[60] flex items-center gap-3 border-b bg-white/90 px-4 py-2.5 backdrop-blur">
        <Link
          to="/"
          aria-label="Volver a Vibemenu"
          className="shrink-0 rounded-lg p-1.5 text-vm-body hover:bg-vm-bg-soft"
        >
          <ArrowLeft className="size-4" />
        </Link>

        <div className="flex flex-1 gap-1.5 overflow-x-auto">
          {FORMATOS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormato(f)}
              aria-pressed={formato === f}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                formato === f ? "bg-vm-primary text-white" : "text-vm-body hover:bg-vm-bg-soft",
              )}
            >
              {NOMBRE_FORMATO[f]}
            </button>
          ))}
        </div>

        <Link
          to="/registro"
          className="hidden shrink-0 rounded-lg bg-vm-ink px-3.5 py-1.5 text-xs font-medium text-white sm:block"
        >
          Crear el mío
        </Link>
      </div>

      {/* Crossfade entre formatos, como pide el prompt de diseño */}
      <AnimatePresence mode="wait">
        <motion.div
          key={formato}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="pt-12"
        >
          {formato === "tiktok" ? (
            <div
              className="relative h-[calc(100dvh-3rem)] overflow-hidden"
              style={variablesDeTema(tema)}
            >
              <Formato categorias={CATEGORIAS_DEMO} />
            </div>
          ) : (
            <div
              className="min-h-[calc(100dvh-3rem)]"
              style={{ ...variablesDeTema(tema), background: "var(--menu-fondo)" }}
            >
              <HeaderMenu
                tenant={TENANT_DEMO}
                sucursales={[SUCURSAL_DEMO]}
                sucursalActiva={SUCURSAL_DEMO}
                menuIndependiente={false}
                compacta={formato === "instagram"}
                abiertaFija
              />
              <Formato
                categorias={CATEGORIAS_DEMO}
                logoUrl={TENANT_DEMO.logo_url}
                inicial={TENANT_DEMO.nombre_negocio.slice(0, 1)}
              />
              <ContactoMenu tenant={TENANT_DEMO} sucursal={SUCURSAL_DEMO} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
