import { Link } from "@tanstack/react-router";
import PaginaLegal, { type SeccionLegal } from "@/components/legal/PaginaLegal";
import { EMPRESA, PROVEEDORES } from "@/lib/legal";

function TablaProveedores() {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-vm-border">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="bg-vm-bg-soft text-left">
            <th className="px-4 py-3 font-medium text-vm-ink">Proveedor</th>
            <th className="px-4 py-3 font-medium text-vm-ink">Para qué lo usamos</th>
            <th className="px-4 py-3 font-medium text-vm-ink">Datos que recibe</th>
          </tr>
        </thead>
        <tbody>
          {PROVEEDORES.map((p) => (
            <tr key={p.nombre} className="border-t border-vm-border align-top">
              <td className="px-4 py-3 font-medium text-vm-ink">
                {p.nombre}
                {p.estado === "en migración" && (
                  <span className="vm-data ml-2 rounded-full bg-vm-warning-soft px-2 py-0.5 text-[10px] text-vm-warning">
                    en migración
                  </span>
                )}
              </td>
              <td className="px-4 py-3">{p.rol}</td>
              <td className="px-4 py-3">{p.datos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SECCIONES: SeccionLegal[] = [
  {
    id: "responsable",
    titulo: "1. Quién es responsable de tus datos",
    contenido: (
      <p>
        <strong>{EMPRESA.razonSocial}</strong>, con domicilio en {EMPRESA.domicilio}, es responsable
        del tratamiento de tus datos personales conforme a la Ley Federal de Protección de Datos
        Personales en Posesión de los Particulares (LFPDPPP). Puedes contactarnos en{" "}
        <a href={`mailto:${EMPRESA.correoPrivacidad}`}>{EMPRESA.correoPrivacidad}</a>.
      </p>
    ),
  },
  {
    id: "datos-que-recabamos",
    titulo: "2. Qué datos recabamos",
    contenido: (
      <>
        <p>
          <strong>Si tienes una cuenta (dueño de negocio o encargado):</strong> tu correo, tu
          nombre, el nombre y giro de tu negocio, dirección y teléfono de tus sucursales, y los
          datos de facturación que procesa Stripe (nunca vemos tu número de tarjeta completo).
        </p>
        <p>
          <strong>Si escaneas un menú público:</strong> no creamos una cuenta ni un perfil tuyo.
          Registramos únicamente un conteo agregado de visitas por sucursal y por día — nunca una
          fila por persona, ni tu ubicación, ni tu identidad. Si dejas un comentario en el aviso de
          «¿cómo estuvo tu visita?», se guarda ese texto tal cual, sin ligarlo a tu identidad ni a
          tu dispositivo.
        </p>
      </>
    ),
  },
  {
    id: "finalidades",
    titulo: "3. Para qué usamos tus datos",
    contenido: (
      <>
        <p>
          <strong>Finalidades necesarias para el servicio:</strong> crear y operar tu cuenta,
          mostrar tu menú, procesar tus pagos, darte soporte, y cumplir obligaciones legales y
          fiscales.
        </p>
        <p>
          <strong>Finalidades secundarias (opcionales):</strong> enviarte novedades del producto por
          correo. Puedes darte de baja de estos correos en cualquier momento sin que afecte tu
          servicio.
        </p>
      </>
    ),
  },
  {
    id: "con-quien-los-compartimos",
    titulo: "4. Con quién compartimos tus datos",
    contenido: (
      <>
        <p>
          No vendemos tus datos. Los compartimos únicamente con los proveedores que necesitamos para
          operar el servicio, cada uno con acceso limitado a lo que su función requiere:
        </p>
        <TablaProveedores />
        <p className="text-sm">
          Cloudflare aparece como "en migración": estamos por activar Cloudflare Turnstile como
          verificación anti-bots en el registro. Las imágenes de producto se quedan en Supabase
          Storage — con la compresión que ya aplicamos antes de subir cada foto, no hay necesidad de
          moverlas a otro proveedor. Este aviso se actualiza cuando Turnstile esté en producción.
        </p>
      </>
    ),
  },
  {
    id: "seguridad",
    titulo: "5. Cómo protegemos tus datos",
    contenido: (
      <p>
        Tu contraseña nunca se guarda en texto plano. El acceso a los datos de cada negocio está
        aislado por reglas de seguridad a nivel de base de datos (Row Level Security): un tenant no
        puede leer ni escribir los datos de otro, aunque intente forzarlo desde el navegador. Las
        llaves privadas de Stripe y de administración de la base de datos solo existen en funciones
        de servidor, nunca en el código que se descarga al navegador.
      </p>
    ),
  },
  {
    id: "derechos-arco",
    titulo: "6. Tus derechos (acceso, rectificación, cancelación y oposición)",
    contenido: (
      <>
        <p>
          Puedes acceder, corregir o eliminar la mayoría de tus datos directamente desde tu panel en{" "}
          <span className="vm-data">/admin</span>. Para ejercer tus derechos ARCO de forma formal —
          incluida la eliminación completa de tu cuenta — escríbenos a{" "}
          <a href={`mailto:${EMPRESA.correoPrivacidad}`}>{EMPRESA.correoPrivacidad}</a> desde el
          correo registrado en tu cuenta. Responderemos dentro de los plazos que marca la LFPDPPP.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    titulo: "7. Cookies y almacenamiento local",
    contenido: (
      <p>
        Usamos cookies y almacenamiento local solo para que el servicio funcione — por ejemplo, para
        mantener tu sesión iniciada. El detalle completo está en nuestra{" "}
        <Link to="/cookies">Política de Cookies</Link>.
      </p>
    ),
  },
  {
    id: "menores",
    titulo: "8. Menores de edad",
    contenido: (
      <p>
        Vibemenu está dirigido a dueños de negocio y sus clientes, no a menores de edad. No
        solicitamos deliberadamente datos de menores de edad en el registro de cuentas.
      </p>
    ),
  },
  {
    id: "cambios-aviso",
    titulo: "9. Cambios a este aviso",
    contenido: (
      <p>
        Si cambiamos de manera importante qué datos recabamos o con quién los compartimos —como al
        activar Cloudflare Turnstile— actualizaremos este aviso y avisaremos a los dueños de cuenta
        por correo.
      </p>
    ),
  },
];

export default function Privacidad() {
  return (
    <PaginaLegal
      titulo="Aviso de privacidad"
      resumen="Qué datos recabamos, para qué los usamos y con qué proveedores los compartimos — sin letra chiquita."
      secciones={SECCIONES}
    />
  );
}
