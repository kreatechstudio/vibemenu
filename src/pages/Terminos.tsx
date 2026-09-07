import { Link } from "@tanstack/react-router";
import PaginaLegal, { type SeccionLegal } from "@/components/legal/PaginaLegal";
import { EMPRESA } from "@/lib/legal";

const SECCIONES: SeccionLegal[] = [
  {
    id: "quien-presta-el-servicio",
    titulo: "1. Quién presta el servicio",
    contenido: (
      <p>
        {EMPRESA.razonSocial}, responsable {EMPRESA.responsable}, domicilio en {EMPRESA.domicilio}.
        Contacto: <a href={`mailto:${EMPRESA.correoContacto}`}>{EMPRESA.correoContacto}</a>.
        «Vibemenu» es la plataforma; «tú» / «el negocio» es quien contrata.
      </p>
    ),
  },
  {
    id: "que-es-vibemenu",
    titulo: "2. Qué es Vibemenu",
    contenido: (
      <p>
        Una herramienta para crear y mostrar un menú digital con QR.{" "}
        <strong>No es un punto de venta ni un procesador de pagos</strong>: no cobramos a tus
        comensales ni intermediamos esas transacciones. Las funciones de «pedir por WhatsApp»,
        reservaciones y tarjeta de lealtad son ayudas de contacto y fidelización; el trato con el
        comensal es tuyo.
      </p>
    ),
  },
  {
    id: "tu-cuenta",
    titulo: "3. Tu cuenta",
    contenido: (
      <p>
        Una cuenta administra un negocio. Eres responsable de la actividad bajo tus credenciales y
        de mantener tus datos de contacto al día. Puedes invitar miembros de tu equipo según tu
        plan.
      </p>
    ),
  },
  {
    id: "planes-y-cobro",
    titulo: "4. Planes y cobro",
    contenido: (
      <p>
        Los precios vigentes están en <Link to="/precios">/precios</Link>. El cobro es recurrente
        (mensual o anual) por medio de Stripe; nunca recibimos ni guardamos el número completo de tu
        tarjeta. <strong>Tu precio queda congelado</strong> mientras tu suscripción siga activa,
        aunque cambiemos las tarifas de lista. El plan anual se paga por adelantado por el año
        completo.
      </p>
    ),
  },
  {
    id: "periodo-de-prueba",
    titulo: "5. Periodo de prueba",
    contenido: (
      <p>
        Si ofrecemos una prueba (hoy: 14 días de Pro), al terminar baja automáticamente a Free si no
        te suscribes. No se te cobra por la prueba.
      </p>
    ),
  },
  {
    id: "cambios-cancelacion-reembolsos",
    titulo: "6. Cambios de plan, cancelación y reembolsos",
    contenido: (
      <p>
        Puedes subir, bajar o cancelar tu plan desde el portal de cliente de Stripe. La cancelación
        aplica <strong>al final del periodo que ya pagaste</strong>; conservas el plan hasta esa
        fecha y luego pasas a Free. <strong>No hay reembolso del tiempo ya pagado</strong>, salvo
        que la ley aplicable obligue a otra cosa.
      </p>
    ),
  },
  {
    id: "falta-de-pago",
    titulo: "7. Falta de pago",
    contenido: (
      <p>
        Si un cobro falla, te avisamos y abrimos un periodo de gracia. Si no se resuelve, el panel
        se suspende temporalmente (tu menú público sigue en línea con los límites de Free).
        Regularizado el pago, se restablece.
      </p>
    ),
  },
  {
    id: "tu-contenido",
    titulo: "8. Tu contenido",
    contenido: (
      <p>
        El menú, textos, fotos y datos que subes son tuyos. Nos das una licencia limitada para
        alojarlos y mostrarlos en tu menú público y donde tú lo compartas.{" "}
        <strong>Tú respondes por que la información sea veraz</strong> — precios, ingredientes,
        alérgenos, promociones, disponibilidad. Vibemenu no verifica ni garantiza ese contenido.
      </p>
    ),
  },
  {
    id: "uso-aceptable",
    titulo: "9. Uso aceptable",
    contenido: (
      <p>
        No uses Vibemenu para nada ilegal, engañoso, para suplantar a otro negocio, para enviar
        spam, ni para subir contenido que no tengas derecho a usar. Podemos suspender una cuenta que
        incumpla.
      </p>
    ),
  },
  {
    id: "disponibilidad",
    titulo: "10. Disponibilidad",
    contenido: (
      <p>
        Ponemos nuestro mejor esfuerzo por mantener el servicio en línea, pero se presta «tal cual»,
        sin un nivel de servicio (SLA) garantizado en los planes actuales. Puede haber ventanas de
        mantenimiento.
      </p>
    ),
  },
  {
    id: "limite-de-responsabilidad",
    titulo: "11. Límite de responsabilidad",
    contenido: (
      <p>
        En la medida que la ley lo permita, la responsabilidad total de Vibemenu frente a ti por
        cualquier reclamo se limita a lo que hayas pagado en los 3 meses anteriores al hecho. No
        respondemos por lucro cesante, pérdida de clientes o daños indirectos.
      </p>
    ),
  },
  {
    id: "comprobantes-y-facturacion-fiscal",
    titulo: "12. Comprobantes y facturación fiscal",
    contenido: (
      <p>
        Hoy el comprobante de tu pago es el recibo que emite Stripe. Aún no emitimos factura fiscal
        (CFDI); cuando esté disponible te avisaremos y podrás solicitarla con los datos fiscales que
        cargues en tu panel.
      </p>
    ),
  },
  {
    id: "datos-personales",
    titulo: "13. Datos personales",
    contenido: (
      <p>
        El tratamiento de datos se rige por nuestro{" "}
        <Link to="/privacidad">Aviso de privacidad</Link>.
      </p>
    ),
  },
  {
    id: "cambios-a-estos-terminos",
    titulo: "14. Cambios a estos términos",
    contenido: (
      <p>
        Si hacemos cambios importantes, actualizamos esta página y avisamos por correo a los dueños
        de cuenta. El uso continuado después del aviso significa que los aceptas.
      </p>
    ),
  },
  {
    id: "terminacion",
    titulo: "15. Terminación",
    contenido: (
      <p>
        Puedes dejar de usar Vibemenu cuando quieras. Podemos terminar el servicio de una cuenta por
        incumplimiento grave de estos términos, avisando por correo salvo casos urgentes.
      </p>
    ),
  },
  {
    id: "ley-aplicable",
    titulo: "16. Ley aplicable",
    contenido: (
      <p>
        Estos términos se rigen por las leyes federales de los Estados Unidos Mexicanos. Cualquier
        controversia se somete a los tribunales competentes del domicilio del responsable (
        {EMPRESA.domicilio}), renunciando a cualquier otro fuero.
      </p>
    ),
  },
  {
    id: "contacto",
    titulo: "17. Contacto",
    contenido: (
      <p>
        Dudas sobre estos términos:{" "}
        <a href={`mailto:${EMPRESA.correoContacto}`}>{EMPRESA.correoContacto}</a>.
      </p>
    ),
  },
];

export default function Terminos() {
  return (
    <PaginaLegal
      titulo="Términos y Condiciones"
      resumen="Las reglas de uso de Vibemenu: qué te damos, qué esperamos de ti, cómo funciona el cobro y qué pasa si algo sale mal."
      secciones={SECCIONES}
    />
  );
}
