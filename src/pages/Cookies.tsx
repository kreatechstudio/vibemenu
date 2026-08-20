import { Link } from "@tanstack/react-router";
import PaginaLegal, { type SeccionLegal } from "@/components/legal/PaginaLegal";
import { EMPRESA } from "@/lib/legal";

type FilaCookie = { nombre: string; proveedor: string; proposito: string; duracion: string };

const COOKIES_ACTUALES: FilaCookie[] = [
  {
    nombre: "sb-<proyecto>-auth-token",
    proveedor: "Supabase (esencial, almacenamiento local — no es una cookie)",
    proposito: "Mantener tu sesión iniciada en el panel de administración",
    duracion: "Hasta que cierres sesión; se renueva sola mientras la uses",
  },
];

function TablaCookies({ filas }: { filas: FilaCookie[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-vm-border">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="bg-vm-bg-soft text-left">
            <th className="px-4 py-3 font-medium text-vm-ink">Nombre</th>
            <th className="px-4 py-3 font-medium text-vm-ink">Proveedor</th>
            <th className="px-4 py-3 font-medium text-vm-ink">Propósito</th>
            <th className="px-4 py-3 font-medium text-vm-ink">Duración</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.nombre} className="border-t border-vm-border align-top">
              <td className="vm-data px-4 py-3 text-xs text-vm-ink">{f.nombre}</td>
              <td className="px-4 py-3">{f.proveedor}</td>
              <td className="px-4 py-3">{f.proposito}</td>
              <td className="px-4 py-3">{f.duracion}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SECCIONES: SeccionLegal[] = [
  {
    id: "que-son",
    titulo: "1. Qué son las cookies",
    contenido: (
      <p>
        Una cookie es un archivo pequeño que un sitio guarda en tu navegador para recordar algo
        entre visitas — por ejemplo, que ya iniciaste sesión. Vibemenu hoy no usa cookies
        propiamente dichas: usa <strong>almacenamiento local</strong> del navegador, que cumple la
        misma función. Lo explicamos aquí junto porque el efecto práctico para ti es el mismo.
      </p>
    ),
  },
  {
    id: "las-que-usamos",
    titulo: "2. Lo que guardamos hoy en tu navegador",
    contenido: (
      <>
        <p>
          Es <strong>esencial</strong>: sin esto no podrías mantener tu sesión iniciada en el panel
          de administración. No pedimos consentimiento para esto porque la ley no lo exige cuando es
          indispensable para el servicio que pediste.
        </p>
        <TablaCookies filas={COOKIES_ACTUALES} />
      </>
    ),
  },
  {
    id: "menu-publico",
    titulo: "3. El menú público no usa cookies de rastreo",
    contenido: (
      <p>
        Si escaneas el QR de un negocio y ves su menú, no se coloca ninguna cookie de rastreo ni de
        identidad. El contador de visitas que ve el dueño del negocio es un conteo agregado por
        sucursal y por día — no sabe quién eres ni te sigue entre sitios.
      </p>
    ),
  },
  {
    id: "turnstile",
    titulo: "4. Verificación anti-bots (Cloudflare Turnstile)",
    contenido: (
      <p>
        En formularios públicos como el registro usamos, o estamos por activar, Cloudflare Turnstile
        para confirmar que quien lo llena es una persona y no un bot. A diferencia de otros sistemas
        de este tipo, Turnstile está diseñado para funcionar sin cookies de rastreo publicitario ni
        perfilado — solo evalúa señales técnicas del navegador en el momento.
      </p>
    ),
  },
  {
    id: "las-que-no-usamos",
    titulo: "5. Lo que no usamos todavía",
    contenido: (
      <p>
        Hoy no tenemos activa ninguna herramienta de analítica de terceros (como Google Analytics)
        ni cookies de publicidad. Si en el futuro activamos alguna, te lo pediremos con un aviso de
        consentimiento antes de colocarla, y actualizaremos esta página.
      </p>
    ),
  },
  {
    id: "controlar-cookies",
    titulo: "6. Cómo controlar o borrar cookies",
    contenido: (
      <p>
        Puedes borrar o bloquear cookies desde la configuración de tu navegador. Si bloqueas las
        cookies esenciales de Supabase, no podrás mantener tu sesión iniciada en el panel de
        administración — el menú público de tus clientes seguirá funcionando igual, ya que no
        depende de ellas.
      </p>
    ),
  },
  {
    id: "cambios-cookies",
    titulo: "7. Cambios a esta política",
    contenido: (
      <p>
        Actualizaremos esta página cuando cambie qué cookies usamos — por ejemplo, al terminar de
        activar Cloudflare Turnstile. Para el resto del tratamiento de tus datos, consulta el{" "}
        <Link to="/privacidad">Aviso de Privacidad</Link>.
      </p>
    ),
  },
  {
    id: "contacto-cookies",
    titulo: "8. Contacto",
    contenido: (
      <p>
        ¿Preguntas sobre esta política? Escríbenos a{" "}
        <a href={`mailto:${EMPRESA.correoPrivacidad}`}>{EMPRESA.correoPrivacidad}</a>.
      </p>
    ),
  },
];

export default function Cookies() {
  return (
    <PaginaLegal
      titulo="Política de cookies"
      resumen="Qué guardamos en tu navegador, por qué, y qué pasa si lo bloqueas."
      secciones={SECCIONES}
    />
  );
}
