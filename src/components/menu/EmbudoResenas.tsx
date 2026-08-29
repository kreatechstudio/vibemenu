import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Frown, Meh, Smile, X } from "lucide-react";
import { useCarritoWhatsApp } from "@/hooks/useCarritoWhatsApp";
import { contactoSucursal } from "@/lib/contacto";
import { marcarEmbudoRespondido, yaRespondioEmbudo } from "@/lib/embudo";
import { supabase } from "@/lib/supabase";
import type { Sucursal, Tenant } from "@/types/database";

const ESPERA_MS = 20_000;
const GRACIAS_MS = 3_000;

type Fase = "oculto" | "pregunta" | "comentario" | "gracias";

const storage = () => (typeof window !== "undefined" ? window.localStorage : undefined);

/**
 * Aviso "¿cómo estuvo tu visita?" al pie del menú público.
 *
 * 🙂 → abre el enlace de reseñas de Google (sucursal → empresa, vía
 * contactoSucursal). 😐/🙁 → comentario opcional que se guarda en
 * feedback_privado por el RPC registrar_feedback (fire-and-forget, el menú
 * nunca se rompe por esto). Una vez por navegador y por tenant; cerrar cuenta.
 *
 * Gateado por plan (habilitado) y por que exista un enlace de reseñas.
 * No se monta en TikTok ni en /demo (lo decide MenuPublico.tsx).
 */
export default function EmbudoResenas({
  tenant,
  sucursal,
  habilitado,
}: {
  tenant: Tenant;
  sucursal: Sucursal | null;
  habilitado: boolean;
}) {
  const resenasUrl = contactoSucursal(sucursal, tenant).googleReviewsUrl;

  // Lectura única: si ya respondió/cerró en este navegador, el embudo no existe.
  const [yaRespondio] = useState(() => yaRespondioEmbudo(tenant.id, storage()));

  const carrito = useCarritoWhatsApp();

  const puedeMostrar =
    habilitado && resenasUrl !== null && !yaRespondio && carrito.cantidadTotal === 0;

  const [fase, setFase] = useState<Fase>("oculto");
  const [sentimiento, setSentimiento] = useState<"regular" | "mal">("regular");
  const [comentario, setComentario] = useState("");

  useEffect(() => {
    if (!puedeMostrar) return;
    const t = setTimeout(() => setFase("pregunta"), ESPERA_MS);
    return () => clearTimeout(t);
  }, [puedeMostrar]);

  useEffect(() => {
    if (fase !== "gracias") return;
    const t = setTimeout(() => setFase("oculto"), GRACIAS_MS);
    return () => clearTimeout(t);
  }, [fase]);

  function cerrar() {
    marcarEmbudoRespondido(tenant.id, storage());
    setFase("oculto");
  }

  function elegirBien() {
    if (resenasUrl) window.open(resenasUrl, "_blank", "noopener,noreferrer");
    cerrar();
  }

  function elegirMalo(s: "regular" | "mal") {
    setSentimiento(s);
    setFase("comentario");
  }

  function enviar() {
    void supabase.rpc("registrar_feedback", {
      p_tenant_id: tenant.id,
      p_sentimiento: sentimiento,
      p_sucursal_id: sucursal?.id,
      p_comentario: comentario.trim() || undefined,
    });
    marcarEmbudoRespondido(tenant.id, storage());
    setFase("gracias");
  }

  if (!puedeMostrar || fase === "oculto") return null;

  const borde = "color-mix(in srgb, var(--menu-texto) 12%, transparent)";

  return (
    <motion.div
      role="dialog"
      aria-label="¿Cómo estuvo tu visita?"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md p-3"
    >
      <div
        className="relative rounded-2xl border p-4 shadow-lg"
        style={{ background: "var(--menu-fondo)", borderColor: borde, color: "var(--menu-texto)" }}
      >
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar"
          className="absolute right-3 top-3 opacity-60 transition-opacity hover:opacity-100"
        >
          <X className="size-4" />
        </button>

        {fase === "pregunta" && (
          <>
            <p className="pr-6 text-sm font-medium">¿Cómo estuvo tu visita?</p>
            <div className="mt-3 flex gap-2">
              {(
                [
                  { k: "bien", Icono: Smile, txt: "Bien", fn: elegirBien },
                  { k: "regular", Icono: Meh, txt: "Regular", fn: () => elegirMalo("regular") },
                  { k: "mal", Icono: Frown, txt: "Mal", fn: () => elegirMalo("mal") },
                ] as const
              ).map(({ k, Icono, txt, fn }) => (
                <button
                  key={k}
                  type="button"
                  onClick={fn}
                  className="flex flex-1 flex-col items-center gap-1 rounded-xl border py-2.5 text-xs transition-opacity hover:opacity-80"
                  style={{ borderColor: borde }}
                >
                  <Icono className="size-6" style={{ color: "var(--menu-primario)" }} aria-hidden />
                  {txt}
                </button>
              ))}
            </div>
          </>
        )}

        {fase === "comentario" && (
          <>
            <p className="pr-6 text-sm font-medium">¿Qué podríamos mejorar?</p>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Opcional — solo lo verá el negocio."
              className="mt-2 w-full resize-none rounded-lg border bg-transparent p-2.5 text-sm outline-none"
              style={{ borderColor: borde }}
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={enviar}
                className="h-10 flex-1 rounded-lg text-sm font-medium text-white"
                style={{ background: "var(--menu-primario)" }}
              >
                Enviar
              </button>
              <button
                type="button"
                onClick={cerrar}
                className="h-10 rounded-lg px-3 text-sm opacity-70 transition-opacity hover:opacity-100"
              >
                Ahora no
              </button>
            </div>
          </>
        )}

        {fase === "gracias" && <p className="py-2 pr-6 text-sm">Gracias, lo tomamos en cuenta.</p>}
      </div>
    </motion.div>
  );
}
