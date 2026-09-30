import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import PhoneInput from "@/components/ui/phone-input";
import { useGuardarSucursal } from "@/hooks/useSucursales";
import { useTenantActual } from "@/hooks/useTenantActual";
import { traducirError } from "@/lib/errores";
import { normalizarSlug } from "@/lib/slug";

/** Igual al default de EditorSucursal: 9 a 6, todos los días, editable después. */
const HORARIO_DEFAULT = Array.from({ length: 7 }, (_, dia) => ({
  dia_semana: dia,
  cerrado: false,
  hora_apertura: "09:00",
  hora_cierre: "18:00",
}));

type PasoSucursalProps = {
  tenantId: string;
  onContinuar: () => void;
};

/**
 * Paso obligatorio del wizard: crea la primera sucursal del negocio. Solo
 * nombre + dirección web son requeridos (lo mínimo para poder compartir el
 * menú bajo esa sucursal); dirección, horarios, reservaciones y links quedan
 * para después en "Mi negocio → Sucursales" — ahí ya existe el editor completo.
 */
export default function PasoSucursal({ tenantId, onContinuar }: PasoSucursalProps) {
  const { data: ctx } = useTenantActual();
  const guardar = useGuardarSucursal(tenantId);

  const [nombre, setNombre] = useState("Sucursal principal");
  const [slug, setSlug] = useState("principal");
  const [slugTocado, setSlugTocado] = useState(false);
  const [telefono, setTelefono] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El de Contacto ya guardó estos en el tenant; los usamos como default para
  // no volver a pedirlos, pero siguen siendo editables por si esta sucursal
  // usa otro número.
  useEffect(() => {
    if (ctx?.tenant.telefono && !telefono) setTelefono(ctx.tenant.telefono);
    if (ctx?.tenant.whatsapp && !whatsapp) setWhatsapp(ctx.tenant.whatsapp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  function alCambiarNombre(v: string) {
    setNombre(v);
    if (!slugTocado) setSlug(normalizarSlug(v) || "principal");
  }

  const puedeEnviar = nombre.trim().length > 0 && slug.trim().length > 0 && !enviando;

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await guardar.mutateAsync({
        datos: {
          nombre: nombre.trim(),
          slug: slug.trim(),
          direccion: null,
          maps_url: null,
          google_reviews_url: null,
          telefono: telefono.trim() || null,
          whatsapp: whatsapp.trim() || null,
          timezone: "America/Mexico_City",
          acepta_reservaciones: false,
          reservaciones_email: null,
        },
        horarios: HORARIO_DEFAULT,
      });
      onContinuar();
    } catch (err) {
      setError(traducirError(err as Error).mensaje);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl text-vm-ink">Crea tu primera sucursal</h1>
      <p className="mt-2 text-sm text-vm-body">
        Es donde va a vivir tu menú. Dirección, horarios y reservaciones los agregas después desde
        "Mi negocio".
      </p>

      <form onSubmit={alEnviar} className="mt-6 space-y-5">
        <div>
          <label htmlFor="sucursal-nombre" className="text-sm font-medium text-vm-ink">
            Nombre
          </label>
          <input
            id="sucursal-nombre"
            required
            value={nombre}
            onChange={(e) => alCambiarNombre(e.target.value)}
            placeholder="Sucursal principal"
            className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
          />
        </div>

        <div>
          <label htmlFor="sucursal-slug" className="text-sm font-medium text-vm-ink">
            Dirección web de esta sucursal
          </label>
          <input
            id="sucursal-slug"
            required
            value={slug}
            onChange={(e) => {
              setSlugTocado(true);
              setSlug(normalizarSlug(e.target.value));
            }}
            className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
          />
        </div>

        <div>
          <label htmlFor="sucursal-telefono" className="text-sm font-medium text-vm-ink">
            Teléfono
          </label>
          <PhoneInput
            id="sucursal-telefono"
            value={telefono}
            onChange={setTelefono}
            placeholder="55 1234 5678"
          />
        </div>

        <div>
          <label htmlFor="sucursal-whatsapp" className="text-sm font-medium text-vm-ink">
            WhatsApp para pedidos
          </label>
          <PhoneInput
            id="sucursal-whatsapp"
            value={whatsapp}
            onChange={setWhatsapp}
            placeholder="55 1234 5678"
          />
          <p className="mt-1.5 text-xs text-vm-body">
            Ya los prellenamos con los que registraste antes — cámbialos si esta sucursal usa otros.
            Si los dejas vacíos, esta sucursal no mostrará la opción de pedir por WhatsApp.
          </p>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 rounded-lg bg-vm-danger-soft px-3.5 py-2.5 text-sm text-vm-danger">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!puedeEnviar}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Continuar
        </button>
      </form>
    </div>
  );
}
