# Vibemenu — Plantillas de correo de Auth

⚠️ Estas plantillas se pegan MANUALMENTE en el Dashboard de Supabase.
Nunca se editan desde Lovable Cloud ni desde código.

**Dónde:** Supabase Dashboard → tu proyecto `vibemenu` → **Authentication → Emails → Templates**.
Cada plantilla tiene su propio campo de **Subject** y su cuerpo **HTML**.

---

## Notas antes de pegar

**Variables disponibles.** Supabase reemplaza estas al enviar:

| Variable                 | Qué contiene                                        |
| ------------------------ | --------------------------------------------------- |
| `{{ .ConfirmationURL }}` | El enlace completo de confirmación o recuperación   |
| `{{ .Token }}`           | Código OTP de 6 dígitos                             |
| `{{ .SiteURL }}`         | La URL base configurada en Auth → URL Configuration |
| `{{ .Email }}`           | Correo del destinatario                             |

**Por qué el HTML se ve tan anticuado.** Gmail, Outlook y Apple Mail no soportan flexbox,
grid, variables CSS ni hojas de estilo externas. Todo va en tablas con estilos en línea.
Es feo de leer y es la única forma de que se vea igual en todos lados.

**Las fuentes de marca no existen en correo.** Space Grotesk no está instalada en el equipo
de nadie. Se usa una pila de fuentes de sistema que se le parece en peso y en aire.
El azul `#2B4EFF` y el resto de tokens sí se respetan tal cual.

**Configura primero el remitente.** En Authentication → Emails → SMTP Settings, pon el nombre
del remitente como `Vibemenu`. Si no, los correos salen a nombre de Supabase.

---

## 1. Confirm signup

Es el que ve un dueño de negocio justo después de registrarse. Es el primer contacto
real con la marca, y hoy dice "Confirm your signup" en inglés.

**Subject:**

```
Confirma tu correo y publica tu menú
```

**HTML:**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Confirma tu correo</title>
  </head>
  <body style="margin:0; padding:0; background-color:#F5F6F9;">
    <!-- Preheader: el texto de vista previa en la bandeja de entrada. Oculto en el cuerpo. -->
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
      Un clic y tu carta queda lista para compartir por QR.
    </div>

    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="background-color:#F5F6F9; padding:40px 16px;"
    >
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="600"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="max-width:600px; width:100%; background-color:#FFFFFF; border:1px solid #E4E6ED; border-radius:16px;"
          >
            <!-- Logo -->
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <span
                  style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:20px; font-weight:700; letter-spacing:-0.02em; color:#0B0B0F;"
                >
                  Vibemenu
                </span>
              </td>
            </tr>

            <!-- Titular y cuerpo -->
            <tr>
              <td style="padding:28px 40px 0 40px;">
                <h1
                  style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:30px; line-height:1.2; letter-spacing:-0.03em; font-weight:700; color:#0B0B0F;"
                >
                  Ya casi. Confirma tu correo.
                </h1>
                <p
                  style="margin:18px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:1.6; color:#4B4E5A;"
                >
                  Toca el botón y entra a tu panel. Ahí eliges tu formato, cargas tus platillos y
                  descargas el QR para imprimir. Sin apps, sin complicaciones.
                </p>
              </td>
            </tr>

            <!-- CTA -->
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color:#2B4EFF; border-radius:12px;">
                      <a
                        href="{{ .ConfirmationURL }}"
                        style="display:inline-block; padding:15px 28px; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; font-weight:600; color:#FFFFFF; text-decoration:none; border-radius:12px;"
                      >
                        Confirmar y crear mi menú
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Enlace de respaldo -->
            <tr>
              <td style="padding:28px 40px 0 40px;">
                <p
                  style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; line-height:1.6; color:#4B4E5A;"
                >
                  ¿No funciona el botón? Copia y pega esta dirección en tu navegador:
                </p>
                <p
                  style="margin:8px 0 0 0; font-family:'SF Mono',Menlo,Consolas,monospace; font-size:12px; line-height:1.5; color:#2B4EFF; word-break:break-all;"
                >
                  {{ .ConfirmationURL }}
                </p>
              </td>
            </tr>

            <!-- Separador -->
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <div style="height:1px; background-color:#E4E6ED; line-height:1px; font-size:0;">
                  &nbsp;
                </div>
              </td>
            </tr>

            <!-- Pie -->
            <tr>
              <td style="padding:24px 40px 36px 40px;">
                <p
                  style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; line-height:1.6; color:#4B4E5A;"
                >
                  Si no creaste una cuenta en Vibemenu, ignora este correo. No pasará nada.
                </p>
                <p
                  style="margin:16px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; font-weight:600; color:#0B0B0F;"
                >
                  Tu menú, tu formato.
                </p>
              </td>
            </tr>
          </table>

          <p
            style="margin:24px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:12px; color:#4B4E5A;"
          >
            Vibemenu · Menú digital con 4 formatos visuales
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 2. Reset password

El botón "¿Olvidaste tu contraseña?" de `/login` dispara este.

**Subject:**

```
Restablece tu contraseña de Vibemenu
```

**HTML:**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Restablece tu contraseña</title>
  </head>
  <body style="margin:0; padding:0; background-color:#F5F6F9;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
      Elige una contraseña nueva y vuelve a tu menú.
    </div>

    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="background-color:#F5F6F9; padding:40px 16px;"
    >
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="600"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="max-width:600px; width:100%; background-color:#FFFFFF; border:1px solid #E4E6ED; border-radius:16px;"
          >
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <span
                  style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:20px; font-weight:700; letter-spacing:-0.02em; color:#0B0B0F;"
                >
                  Vibemenu
                </span>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 40px 0 40px;">
                <h1
                  style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:30px; line-height:1.2; letter-spacing:-0.03em; font-weight:700; color:#0B0B0F;"
                >
                  Elige una contraseña nueva.
                </h1>
                <p
                  style="margin:18px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:1.6; color:#4B4E5A;"
                >
                  Pediste restablecer el acceso a
                  <strong style="color:#0B0B0F;">{{ .Email }}</strong>. El enlace caduca en una
                  hora.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:32px 40px 0 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color:#2B4EFF; border-radius:12px;">
                      <a
                        href="{{ .ConfirmationURL }}"
                        style="display:inline-block; padding:15px 28px; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; font-weight:600; color:#FFFFFF; text-decoration:none; border-radius:12px;"
                      >
                        Restablecer mi contraseña
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 40px 0 40px;">
                <p
                  style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; line-height:1.6; color:#4B4E5A;"
                >
                  ¿No funciona el botón? Copia y pega esta dirección en tu navegador:
                </p>
                <p
                  style="margin:8px 0 0 0; font-family:'SF Mono',Menlo,Consolas,monospace; font-size:12px; line-height:1.5; color:#2B4EFF; word-break:break-all;"
                >
                  {{ .ConfirmationURL }}
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:32px 40px 0 40px;">
                <div style="height:1px; background-color:#E4E6ED; line-height:1px; font-size:0;">
                  &nbsp;
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 40px 36px 40px;">
                <p
                  style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; line-height:1.6; color:#4B4E5A;"
                >
                  Si no pediste esto, ignora el correo. Tu contraseña actual sigue funcionando.
                </p>
                <p
                  style="margin:16px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; font-weight:600; color:#0B0B0F;"
                >
                  Tu menú, tu formato.
                </p>
              </td>
            </tr>
          </table>

          <p
            style="margin:24px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:12px; color:#4B4E5A;"
          >
            Vibemenu · Menú digital con 4 formatos visuales
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 3. Change Email Address

**Subject:**

```
Confirma tu nuevo correo en Vibemenu
```

Reusa el HTML de **Confirm signup** cambiando el titular y el párrafo por:

```html
<h1
  style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:30px; line-height:1.2; letter-spacing:-0.03em; font-weight:700; color:#0B0B0F;"
>
  Confirma tu nuevo correo.
</h1>
<p
  style="margin:18px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:1.6; color:#4B4E5A;"
>
  Pediste cambiar el correo de tu cuenta a <strong style="color:#0B0B0F;">{{ .Email }}</strong>.
  Confírmalo para terminar.
</p>
```

y el botón por `Confirmar mi correo`.

---

## 4. Invitación de equipo (código, no Dashboard)

A diferencia de las tres plantillas de arriba, este correo **no se pega en el Dashboard**:
vive en `supabase/functions/invitar-encargado/index.ts` y se manda por la API HTTP de Resend
(no por SMTP), porque lo dispara la Edge Function al invitar a un encargado desde
`/admin/equipo` — no un flujo nativo de Supabase Auth.

Reemplaza al `auth.admin.inviteUserByEmail` que se usaba antes: ese método manda el correo
genérico de Supabase ("You have been invited") sin marca y sin forma de distinguir "correo
nuevo" de "correo que ya tiene cuenta en otro negocio" antes de vincularlo. Ver
`src/docs/vibemenu_migracion_invitaciones.sql` para el porqué completo.

El invitado cae en `/invitacion/:token` (`src/pages/AceptarInvitacion.tsx`), que resuelve los
cuatro casos: cuenta nueva, cuenta existente sin sesión, cuenta existente con sesión de otro
correo, y cuenta existente ya vinculada a otro negocio (se rechaza explícitamente — un usuario
es de un solo tenant en Vibemenu).

**Remitente:** `Vibemenu <invitaciones@vibemenu.com.mx>` — mismo dominio que las plantillas de
Auth, ya verificado en Resend.

**Desplegar y configurar:**

```
supabase functions deploy invitar-encargado --project-ref iaiiwtqqiaqxnzxjqcnt
supabase functions deploy aceptar-invitacion --project-ref iaiiwtqqiaqxnzxjqcnt
```

Secretos (Dashboard → Edge Functions → Secrets), además de los que ya usan las otras
funciones: agregar `RESEND_API_KEY` (crear una llave nueva en Resend dedicada a Vibemenu —
las que existen hoy, "Send Quotes" y "Onboarding", son de otro proyecto de KreaTech; no
reutilizarlas aquí).

Y correr `vibemenu_migracion_invitaciones.sql` en el SQL Editor **antes** de desplegar — las
Edge Functions asumen que la tabla `invitaciones` y la función `invitacion_info` ya existen.

## Antes de mandar el primer correo real

**El SMTP por defecto de Supabase tiene un límite muy bajo** (unos pocos correos por hora) y
solo entrega a los miembros del proyecto. Para producción hay que conectar un SMTP propio en
Authentication → Emails → SMTP Settings — esto es solo para los 3 correos de Auth de arriba
(confirm signup, reset password, change email); la invitación de equipo ya sale por Resend
directo, sin pasar por el SMTP de Supabase.

**Resend ya está conectado** (dominio `vibemenu.com.mx` verificado, envío habilitado). Para
usarlo como SMTP de Supabase Auth: Authentication → Emails → SMTP Settings →
host `smtp.resend.com`, puerto `465` (SSL) o `587` (TLS), usuario `resend`, contraseña la
API key de Resend (crea una dedicada a SMTP, no la de las Edge Functions). El remitente debe
seguir siendo del dominio verificado, p. ej. `Vibemenu <no-responde@vibemenu.com.mx>`.

**Revisa Auth → URL Configuration.** El `Site URL` y los `Redirect URLs` deben apuntar al
dominio real; si no, `{{ .ConfirmationURL }}` lleva a `localhost:3000` y el dueño del negocio
aterriza en una página muerta.

**Pruébalo en Gmail y en Outlook.** Outlook renderiza con el motor de Word y es donde se rompen
los `border-radius`: el botón se verá cuadrado. Es aceptable y es la razón de no usar imágenes
de fondo ni CSS moderno aquí.
