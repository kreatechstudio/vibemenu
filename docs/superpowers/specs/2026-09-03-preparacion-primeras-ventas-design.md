# Preparación para las primeras ventas — Diseño

**Fecha:** 2026-09-03
**Estado:** aprobado en brainstorm (alcance "lo esencial para vender" + 3 ayudas de pre-cobro)

## Contexto

Vibemenu está desplegado y funcional, con P0/P1/P2 completos. **La base tiene 0
clientes reales** (1 tenant de prueba, 0 pagos, 0 respuestas de onboarding, 0 de
todo lo demás). No es momento de un dashboard de BI — es momento de:

1. Cerrar los huecos del super-admin que hacen falta para acompañar al cliente #1.
2. Dejar listas 3 cosas de pre-cobro: canal de contacto, Términos y Condiciones,
   y un guion de prueba de Stripe.

Todo esto sin tocar gating, precios, ni el webhook de Stripe.

## Datos disponibles (verificado en prod 2026-09-03)

- `suscripciones` — **historial completo**, una fila por cambio de plan. Columnas
  clave: `estado` (`activa` | `reemplazada` | `cancelada`), `motivo_cambio`
  (`alta` | `upgrade` | `downgrade` | `reactivacion` | `cancelacion`),
  `fecha_inicio`, `fecha_fin`, `fecha_renovacion`, `precio_congelado_{usd,mxn}`,
  `moneda_cobro`. RLS: `suscripciones_select_super_admin` (`es_super_admin()`) ya existe.
- `tenants.cancela_al_terminar` (boolean) — ya existe, lectura pública.
- `onboarding_respuestas` — `respuestas` jsonb, `created_at`. **RLS: solo tiene
  policy de INSERT. Nadie puede leerla hoy.** → única migración de este trabajo.
- `visitas_menu` — RLS super-admin ya existe. `productos` — lectura pública.
- `sucursales.acepta_reservaciones`, `tenants.lealtad_activa`, `tenants.formato_activo`,
  `tenants.tema`, `tenants.logo_url` — lectura pública.

### Ciclo de vida de una fila de `suscripciones` (del webhook `stripe-webhook`)

- **Alta / cambio de plan** (`checkout.session.completed`): `abrirPeriodo()` cierra
  la fila `activa` vigente (→ `estado='reemplazada'`, `fecha_fin=now`) e inserta una
  nueva `activa` con `motivo_cambio` deducido por precio (`alta`/`upgrade`/`downgrade`/`reactivacion`).
- **Baja a Free** (`customer.subscription.deleted`): `bajarAFree()` pone la fila
  `activa` en `estado='cancelada'`, `fecha_fin=now`, `motivo_cambio='cancelacion'`,
  y el tenant vuelve al plan free con `estado='activo'`, `cancela_al_terminar=false`.
- **Un tenant que nunca pagó no tiene ninguna fila en `suscripciones`.**
- Corolario: **una fila `estado='activa'` ⟺ el tenant está pagando ahora.**

## Migración

`src/docs/vibemenu_migracion_onboarding_lectura.sql` — aditiva, un solo `create policy`:

```sql
-- Deja que el super-admin lea las respuestas de onboarding en la ficha del tenant.
-- Mismo patrón que suscripciones_select_super_admin y visitas_menu_select_super_admin.
create policy onboarding_respuestas_select_super_admin
  on public.onboarding_respuestas
  for select
  to public
  using (public.es_super_admin());
```

## A. Super-admin v2

### A0 · `src/lib/superadmin.ts` — helpers puros (+ pruebas)

Añadir al módulo existente (hoy solo tiene `FECHA`, `FECHA_HORA`, `COLOR_ESTADO`,
`NOMBRE_ESTADO`):

```ts
export type SituacionComercial =
  | { tipo: "pagando" }
  | { tipo: "cancela_al_terminar"; hasta: string | null } // fecha_renovacion ISO
  | { tipo: "bajo"; desde: string | null }                // max fecha_fin de filas canceladas
  | { tipo: "trial" }
  | { tipo: "nunca_pago" };

/** Resumen mínimo de una fila de `suscripciones` que estas funciones necesitan. */
export type SuscripcionMin = {
  estado: string;
  motivo_cambio: string | null;
  fecha_fin: string | null;
  fecha_renovacion: string | null;
};

export function situacionComercial(
  tenant: { estado: string; cancela_al_terminar: boolean | null },
  suscripciones: readonly SuscripcionMin[],
): SituacionComercial {
  const activa = suscripciones.find((s) => s.estado === "activa");
  if (activa) {
    return tenant.cancela_al_terminar
      ? { tipo: "cancela_al_terminar", hasta: activa.fecha_renovacion }
      : { tipo: "pagando" };
  }
  const canceladas = suscripciones.filter((s) => s.estado === "cancelada");
  if (canceladas.length > 0) {
    const desde = canceladas
      .map((s) => s.fecha_fin)
      .filter((f): f is string => Boolean(f))
      .sort()
      .at(-1) ?? null;
    return { tipo: "bajo", desde };
  }
  if (tenant.estado === "trial") return { tipo: "trial" };
  return { tipo: "nunca_pago" };
}

/** ¿Se dio de baja dentro de los últimos `dias` días? Para el total "Bajas (30 d)". */
export function bajoEnUltimosDias(s: SituacionComercial, dias: number, ahora = new Date()): boolean {
  if (s.tipo !== "bajo" || !s.desde) return false;
  const ms = ahora.getTime() - new Date(s.desde).getTime();
  return ms >= 0 && ms <= dias * 86_400_000;
}

export const ETIQUETA_SITUACION: Record<SituacionComercial["tipo"], string> = {
  pagando: "Pagando",
  cancela_al_terminar: "Cancela al terminar",
  bajo: "Bajó",
  trial: "En prueba",
  nunca_pago: "Nunca pagó",
};
```

Pruebas `src/lib/superadmin.test.ts` (nuevo, `bun:test`):
- `activa` presente + `cancela_al_terminar=false` → `pagando`.
- `activa` presente + `cancela_al_terminar=true` → `cancela_al_terminar` con `hasta`.
- sin `activa`, con 2 `cancelada` → `bajo`, `desde` = la `fecha_fin` más reciente.
- sin filas, `tenant.estado='trial'` → `trial`.
- sin filas, `tenant.estado='activo'` → `nunca_pago`.
- `bajoEnUltimosDias`: dentro de ventana → true; hace 40 días con ventana 30 → false;
  `desde` en el futuro → false; situación ≠ `bajo` → false.

### A1 · Lista `/superadmin` — churn

`useTenantsSuperAdmin` (`src/hooks/useSuperAdmin.ts`): extender el `select` para traer
`cancela_al_terminar` del tenant y `motivo_cambio, fecha_fin, fecha_renovacion` de
`suscripciones` (ya trae `estado`). Añadir `situacion: SituacionComercial` al objeto
`TenantSuperAdmin` calculándolo con `situacionComercial` en el `.map`.

`src/pages/SuperAdmin.tsx`:
- **Columna "Estado"**: cuando `situacion.tipo` es `cancela_al_terminar` o `bajo`,
  el badge muestra la etiqueta de `ETIQUETA_SITUACION` (ámbar para `cancela_al_terminar`
  con `· {FECHA.format(hasta)}`, gris/rojo para `bajo` con `· {FECHA.format(desde)}`),
  además del `estado` crudo del tenant. El badge de estado crudo se mantiene.
- **Filtros**: añadir chip **"Bajas"** que filtra `situacion.tipo === "bajo"`.
  Los chips actuales (`trial`/`activo`/`suspendido`/`cancelado`) no cambian; "Bajas"
  es un chip aparte que cruza el filtro de `estado`.
- **Tarjeta de total**: sexta tarjeta **"Bajas (30 d)"** = cuántos tenants con
  `bajoEnUltimosDias(t.situacion, 30)`.

### A2 · Cancelación programada — lista y ficha

Ya cubierto en la lista por A1 (`cancela_al_terminar`). En la ficha
`src/pages/SuperAdminDetalle.tsx`: junto al badge de estado del encabezado, si
`detalle.tenant.cancela_al_terminar` → badge ámbar
`Cancela el {FECHA.format(suscripcionActiva.fecha_renovacion)}`. La fecha sale de
`historialSuscripciones.find(s => s.estado === "activa")?.fecha_renovacion`.

### A3 · Respuestas de onboarding en la ficha

`useDetalleTenantSuperAdmin`: añadir una 6ª consulta en el `Promise.all`:

```ts
supabase
  .from("onboarding_respuestas")
  .select("respuestas, created_at")
  .eq("tenant_id", tenantId!)
  .maybeSingle(),
```

Añadir `onboarding: { respuestas: Record<string, string>; created_at: string } | null`
al tipo `DetalleTenantSuperAdmin` (si `error` → tratar como `null`, no romper la ficha;
igual que hace hoy con otras consultas… en realidad hoy sí lanza — para esta, capturar:
si `onboardingRes.error` y su `code` es de RLS/relación faltante, devolver `null`).

`src/lib/superadmin.ts` — mapa de claves a etiqueta legible (las 3 preguntas del
registro, de `src/components/registro/pasos/PasoMetricas.tsx`):

```ts
export const PREGUNTAS_ONBOARDING: { clave: string; etiqueta: string }[] = [
  { clave: "como_manejas_menu", etiqueta: "¿Cómo manejaba su menú?" },
  { clave: "dolor_principal", etiqueta: "Su mayor dolor de cabeza" },
  { clave: "como_nos_conociste", etiqueta: "Cómo nos conoció" },
];
// Las respuestas "Otro" traen texto en `${clave}_otro`; se muestra entre paréntesis.
```

`SuperAdminDetalle.tsx` — nuevo `<Bloque titulo="Qué nos dijo al registrarse">`:
- Si `detalle.onboarding === null` → "No respondió el cuestionario."
- Si no, las 3 filas: etiqueta + respuesta (+ `(texto)` si hay `_otro`).

### A4 · Señales de salud en la ficha

`useDetalleTenantSuperAdmin`: dos consultas más en el `Promise.all`:

```ts
supabase.from("productos").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!),
supabase.from("sucursales").select("acepta_reservaciones").eq("tenant_id", tenantId!),
```

`useVisitas` ya está montado en la ficha (`visitas.ultimos30`). Reusar ese valor;
no volver a consultar.

Nuevo tipo en `DetalleTenantSuperAdmin`:
`salud: { productos: number; algunaSucursalConReservas: boolean } | null`.

`src/lib/superadmin.ts` — función pura que arma la lista de señales a partir de lo
que ya hay en la ficha (tenant + plan + salud + visitas):

```ts
export type Senal = { etiqueta: string; ok: boolean; detalle?: string };

export function senalesDeSalud(input: {
  tenant: { created_at: string; lealtad_activa: boolean | null; formato_activo: string | null;
            logo_url: string | null; tema: unknown };
  productos: number;
  algunaSucursalConReservas: boolean;
  visitas30: number | null;
  ahora?: Date;
}): Senal[] {
  const dias = Math.floor(
    ((input.ahora ?? new Date()).getTime() - new Date(input.tenant.created_at).getTime()) / 86_400_000,
  );
  const temaTocado = !!input.tenant.tema && Object.keys(input.tenant.tema as object).length > 0;
  return [
    { etiqueta: "Publicó menú", ok: input.productos > 0, detalle: `${input.productos} productos` },
    { etiqueta: "Su menú recibe visitas", ok: (input.visitas30 ?? 0) > 0, detalle: `${input.visitas30 ?? 0} en 30 d` },
    { etiqueta: "Personalizó diseño", ok: temaTocado || !!input.tenant.logo_url },
    { etiqueta: "Activó tarjeta de lealtad", ok: !!input.tenant.lealtad_activa },
    { etiqueta: "Activó reservaciones", ok: input.algunaSucursalConReservas },
    { etiqueta: "Días desde el alta", ok: true, detalle: String(dias) },
  ];
}
```

Pruebas: tenant recién creado sin nada → todas `ok:false` salvo "Días desde el alta";
tenant con productos + visitas + lealtad → esas tres `ok:true`.

`SuperAdminDetalle.tsx` — nuevo `<Bloque titulo="Señales">` con las filas (✓ verde /
✗ gris + `detalle` a la derecha), patrón visual de `FilaUso`.

## B. Canal de soporte / ventas

`src/lib/legal.ts` — añadir a `EMPRESA` (o un export nuevo `CONTACTO`):

```ts
export const CONTACTO = {
  whatsapp: "+528671268563",
  whatsappTexto: "Hola, me interesa Vibemenu para mi negocio.",
  correo: "clopez@kreatechstudio.com.mx",
} as const;
```

- `src/pages/Precios.tsx` — la tarjeta Enterprise: el CTA "Contactar ventas"
  (hoy `<Link to="/registro">`) pasa a `<a href={enlaceWhatsApp(CONTACTO.whatsapp, CONTACTO.whatsappTexto)}>`
  (reusar `enlaceWhatsApp` de `src/lib/whatsapp.ts`). Los CTA de free/basic/pro no cambian.
- `src/components/layout/Footer.tsx` — nueva `<nav aria-label="Contacto">` (o añadir a
  "Cuenta"): "WhatsApp" → `enlaceWhatsApp(...)`, "Correo" → `mailto:${CONTACTO.correo}`.
- No hay panel de ayuda in-app que cambiar (el `TUTORIAL` de `/admin` es un modal de
  contenido, no de soporte) — fuera de alcance tocarlo.

## C. Términos y Condiciones — `/terminos`

`src/pages/Terminos.tsx` usando `<PaginaLegal>` (mismo componente que Privacidad y
Cookies). Ruta `src/routes/terminos.tsx`. Enlaces: Footer (nav "Legal", después de
Privacidad) y el paso final del registro (`src/components/registro/` — donde ya se
menciona privacidad, si aplica; si no, añadir una línea "Al crear tu cuenta aceptas
los [Términos] y el [Aviso de privacidad]").

`VIGENCIA_LEGAL` en `legal.ts` ya existe ("20 de agosto de 2026") — **actualizarla a
la fecha de este cambio** (afecta los 3 documentos, es el patrón declarado en el
comentario del archivo). Usar la fecha real del merge.

### Contenido (secciones de `PaginaLegal`)

Resumen: "Las reglas de uso de Vibemenu: qué te damos, qué esperamos de ti, cómo
funciona el cobro y qué pasa si algo sale mal."

1. **Quién presta el servicio.** {EMPRESA.razonSocial}, responsable {EMPRESA.responsable},
   domicilio en {EMPRESA.domicilio}. Contacto: {EMPRESA.correoContacto}. "Vibemenu" es
   la plataforma; "tú" / "el negocio" es quien contrata.
2. **Qué es Vibemenu.** Una herramienta para crear y mostrar un menú digital con QR.
   **No es un punto de venta ni un procesador de pagos**: no cobramos a tus comensales
   ni intermediamos esas transacciones. Las funciones de "pedir por WhatsApp",
   reservaciones y tarjeta de lealtad son ayudas de contacto y fidelización; el trato
   con el comensal es tuyo.
3. **Tu cuenta.** Una cuenta administra un negocio. Eres responsable de la actividad
   bajo tus credenciales y de mantener tus datos de contacto al día. Puedes invitar
   miembros de tu equipo según tu plan.
4. **Planes y cobro.** Los precios vigentes están en /precios. El cobro es recurrente
   (mensual o anual) por medio de Stripe; nunca recibimos ni guardamos el número
   completo de tu tarjeta. **Tu precio queda congelado** mientras tu suscripción siga
   activa, aunque cambiemos las tarifas de lista. El plan anual se paga por adelantado
   por el año completo.
5. **Periodo de prueba.** Si ofrecemos una prueba (hoy: 14 días de Pro), al terminar
   baja automáticamente a Free si no te suscribes. No se te cobra por la prueba.
6. **Cambios de plan, cancelación y reembolsos.** Puedes subir, bajar o cancelar tu
   plan desde el portal de cliente de Stripe. La cancelación aplica **al final del
   periodo que ya pagaste**; conservas el plan hasta esa fecha y luego pasas a Free.
   **No hay reembolso del tiempo ya pagado**, salvo que la ley aplicable obligue a
   otra cosa.
7. **Falta de pago.** Si un cobro falla, te avisamos y abrimos un periodo de gracia.
   Si no se resuelve, el panel se suspende temporalmente (tu menú público sigue en
   línea con los límites de Free). Regularizado el pago, se restablece.
8. **Tu contenido.** El menú, textos, fotos y datos que subes son tuyos. Nos das una
   licencia limitada para alojarlos y mostrarlos en tu menú público y donde tú lo
   compartas. **Tú respondes por que la información sea veraz** — precios, ingredientes,
   alérgenos, promociones, disponibilidad. Vibemenu no verifica ni garantiza ese
   contenido.
9. **Uso aceptable.** No uses Vibemenu para nada ilegal, engañoso, para suplantar a
   otro negocio, para enviar spam, ni para subir contenido que no tengas derecho a
   usar. Podemos suspender una cuenta que incumpla.
10. **Disponibilidad.** Ponemos nuestro mejor esfuerzo por mantener el servicio en
    línea, pero se presta "tal cual", sin un nivel de servicio (SLA) garantizado en
    los planes actuales. Puede haber ventanas de mantenimiento.
11. **Límite de responsabilidad.** En la medida que la ley lo permita, la
    responsabilidad total de Vibemenu frente a ti por cualquier reclamo se limita a
    lo que hayas pagado en los 3 meses anteriores al hecho. No respondemos por lucro
    cesante, pérdida de clientes o daños indirectos.
12. **Comprobantes y facturación fiscal.** Hoy el comprobante de tu pago es el recibo
    que emite Stripe. Aún no emitimos factura fiscal (CFDI); cuando esté disponible te
    avisaremos y podrás solicitarla con los datos fiscales que cargues en tu panel.
13. **Datos personales.** El tratamiento de datos se rige por nuestro
    [Aviso de privacidad](/privacidad).
14. **Cambios a estos términos.** Si hacemos cambios importantes, actualizamos esta
    página y avisamos por correo a los dueños de cuenta. El uso continuado después del
    aviso significa que los aceptas.
15. **Terminación.** Puedes dejar de usar Vibemenu cuando quieras. Podemos terminar el
    servicio de una cuenta por incumplimiento grave de estos términos, avisando por
    correo salvo casos urgentes.
16. **Ley aplicable.** Estos términos se rigen por las leyes federales de los Estados
    Unidos Mexicanos. Cualquier controversia se somete a los tribunales competentes
    del domicilio del responsable ({EMPRESA.domicilio}), renunciando a cualquier otro
    fuero.
17. **Contacto.** Dudas sobre estos términos: {EMPRESA.correoContacto}.

**Aviso al implementador y al usuario:** este es un borrador de trabajo, no asesoría
legal. Carlos debe revisarlo (idealmente con un abogado) antes de considerarlo
definitivo. No bloquea el merge del resto.

## D. Guion de prueba de Stripe — `docs/pruebas-stripe-test.md`

Documento (no código) con:
- Prerrequisitos: modo test en Stripe, `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` de
  test en la Edge Function, un tenant de prueba, tarjetas de test de Stripe
  (`4242…` éxito, `4000 0000 0000 0341` falla al cobrar recurrente, `4000…9995`
  fondos insuficientes).
- Paso a paso, con "qué revisar" en cada uno:
  1. **Alta**: checkout con `4242` → `tenants.estado='activo'`, plan correcto, fila
     `suscripciones` `activa` con `motivo_cambio='alta'`, precio congelado, correo de
     bienvenida.
  2. **Upgrade / downgrade**: cambiar de plan en el portal → fila vieja `reemplazada`
     con `fecha_fin`, fila nueva `activa` con `motivo_cambio` correcto, formatos/tema
     recortados si bajó.
  3. **Fallo de pago**: forzar `invoice.payment_failed` (tarjeta que falla en la
     renovación, o "Advance clock" de Stripe) → `tenants.pago_fallido_desde` puesto,
     correo de aviso, **estado sigue `activo`** (gracia).
  4. **Gracia vencida**: adelantar el reloj más allá de la ventana de gracia y correr
     el cron `procesar-trials`/dunning → `tenants.estado='suspendido'`, panel muestra
     `PanelBloqueado`, menú público sigue vivo con límites Free.
  5. **Recuperación**: pagar la factura pendiente → `pago_fallido_desde=null`,
     `estado='activo'`, panel desbloqueado.
  6. **Cancelación**: cancelar en el portal → `tenants.cancela_al_terminar=true`,
     sigue `activo` hasta `fecha_renovacion`; al llegar la fecha y dispararse
     `customer.subscription.deleted` → fila `cancelada` con `motivo_cambio='cancelacion'`,
     tenant en plan free, `estado='activo'`, `cancela_al_terminar=false`.
  7. Verificar en `/superadmin` que cada transición se ve bien (situación comercial,
     "Cancela al terminar", "Bajó · fecha").
- Nota: cómo usar "Advance clock" de Stripe test para no esperar 30 días reales.

## Fuera de alcance

- Dashboard de BI: MRR en el tiempo, cohortes, embudo trial→pago, adopción de
  funciones en agregado, análisis de onboarding sumado. Se difiere hasta ~10-20
  clientes pagando.
- Facturación CFDI real (trámite fiscal de KreaTech).
- Tocar el webhook de Stripe, el cron de dunning, o el gating de planes.
- Impersonar tenants / log de auditoría del super-admin (backlog del artifact).

## Constraints

- TS estricto; `tsc` y `eslint` 0 errores; `bun test` verde (baseline 211).
- Migración aditiva y transactional (`begin; … commit;`), un solo `create policy`.
  El controlador la aplica con el conector (los subagentes no tienen conector) y
  regenera `src/types/database.ts`.
- Copy en español de México, tú/tu, sin signos de admiración de más.
- Los helpers de `src/lib/superadmin.ts` son puros y con pruebas; el super-admin
  nunca cruza tenants (RLS `es_super_admin()` ya lo garantiza en Postgres).
- `git push` y deploy siguen siendo del usuario. Merge a main = stop condition.
