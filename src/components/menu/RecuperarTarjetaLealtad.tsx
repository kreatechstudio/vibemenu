import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useRecuperarTarjetaPublica } from "@/hooks/useLealtad";

/**
 * "¿Ya tenías una tarjeta?" — para el cliente que borró su navegador o cambió
 * de teléfono. Pide el mismo contacto que guardó en la tarjeta y, si hay
 * coincidencia exacta, la recupera (ver RPC `recuperar_tarjeta_publica`,
 * que depende del índice único tenant+contacto para devolver como mucho una).
 */
export default function RecuperarTarjetaLealtad({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const recuperar = useRecuperarTarjetaPublica(slug);
  const [abierto, setAbierto] = useState(false);
  const [contacto, setContacto] = useState("");
  const [sinCoincidencia, setSinCoincidencia] = useState(false);

  const borde = "color-mix(in srgb, var(--menu-texto) 15%, transparent)";

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-3 text-xs font-medium underline"
        style={{ color: "var(--menu-texto-suave)" }}
      >
        ¿Ya tenías una tarjeta? Recupérala
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSinCoincidencia(false);
        recuperar.mutate(contacto.trim(), {
          onSuccess: (uuid) => {
            if (uuid) {
              void navigate({ to: "/$slug/lealtad/$tarjetaId", params: { slug, tarjetaId: uuid } });
            } else {
              setSinCoincidencia(true);
            }
          },
        });
      }}
      className="mt-3 rounded-xl border p-3"
      style={{ borderColor: borde }}
    >
      <label className="block text-xs" style={{ color: "var(--menu-texto-suave)" }}>
        ¿La guardaste con tu teléfono o correo? Escríbelo igual:
      </label>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={contacto}
          onChange={(e) => setContacto(e.target.value)}
          placeholder="55 1234 5678 o tu@correo.com"
          className="h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none"
          style={{ borderColor: borde, color: "var(--menu-texto)", background: "transparent" }}
        />
        <button
          type="submit"
          disabled={!contacto.trim() || recuperar.isPending}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-50"
          style={{ background: "var(--menu-primario)", color: "var(--menu-fondo)" }}
        >
          {recuperar.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          Buscar
        </button>
      </div>
      {sinCoincidencia && (
        <p className="mt-2 text-xs" style={{ color: "#b91c1c" }}>
          No encontramos una tarjeta con ese dato. Revisa que esté escrito igual a como lo
          guardaste.
        </p>
      )}
      {recuperar.isError && (
        <p className="mt-2 text-xs" style={{ color: "#b91c1c" }}>
          {(recuperar.error as Error).message}
        </p>
      )}
    </form>
  );
}
