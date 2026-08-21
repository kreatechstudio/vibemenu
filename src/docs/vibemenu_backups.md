# Vibemenu — Respaldos de la base de datos

Dos capas, no una. La primera la da Supabase; la segunda vive en Cloudflare R2
y la controla este repo.

---

## Por qué dos capas

**Capa 1 — Supabase.** Backups automáticos administrados por ellos. En el plan
**Free no existen** — si el proyecto se corrompe o alguien borra algo por error,
no hay nada que restaurar. El plan **Pro ($25 USD/mes)** los activa: una copia
diaria, retenida 7 días. Si más adelante quieres poder restaurar a un segundo
exacto en vez de al último corte diario, existe el add-on de **Point in Time
Recovery** — revisa el precio actual en el dashboard, cambia según cuántos días
de retención pidas.

**Qué hacer ahora:** entra a **Project Settings → Add-ons → Backups** en el
dashboard de Supabase y confirma en qué plan estás. Si sigues en Free, sube a
Pro antes de tener el primer tenant pagando — no antes por capricho, sino
porque es la única capa que cubre un desastre del lado de Supabase (cuenta
suspendida, proyecto borrado por error, etc.).

**Capa 2 — este workflow.** Una copia independiente, fuera de la cuenta de
Supabase, en un bucket de Cloudflare R2 que tú controlas. Cubre el escenario
que la capa 1 no cubre: perder acceso a la cuenta de Supabase misma, no solo a
un dato dentro de ella. Como R2 no cobra por sacar datos (egress), un día que
necesites restaurar no te cuesta nada bajar el archivo.

---

## Por qué esto no "satura" la base de datos

Dos cosas separadas que es fácil confundir:

**Las fotos de producto no viven en Postgres.** Ni en Supabase Storage ni en
Cloudflare R2 — ambos son almacenamiento de objetos, aparte de la base de
datos relacional. Un `pg_dump` de la base **nunca incluye las imágenes**, esté
donde esté guardado el archivo. El respaldo de la base es solo texto y
números: nombres, precios, categorías, configuración de tema. Por eso pesa
poco y no crece por más fotos que suban los tenants.

**El propio dump no le pega a las conexiones de la app.** `pg_dump` abre **una
sola conexión de lectura**, aparte del pool que usa el sitio en producción, y
corre a las 3am hora de México — cuando el tráfico real de menús escaneados es
casi cero. Con el tamaño de base que tiene Vibemenu hoy, termina en segundos.
Si algún día la base crece mucho, ahí sí conviene mover este job a un horario
de tráfico aún más bajo por tenant (zona horaria variable) o usar
`--jobs` para paralelizar, pero no es necesario todavía.

---

## Configurar el workflow

El archivo ya existe: [`.github/workflows/backup-db.yml`](../../.github/workflows/backup-db.yml).
Corre solo una vez que estén los secretos. Sin ellos, falla en rojo — visible
en la pestaña **Actions** del repo.

### 1. Cadena de conexión de Supabase

**Dashboard de Supabase → Project Settings → Database → Connection string.**
Copia la **conexión directa** (puerto `5432`), no la del *connection pooler*
(puerto `6543`, empieza con `postgres.` en el usuario) — `pgbouncer` en modo
transacción corta las sesiones largas que `pg_dump` necesita.

```
GitHub → Settings → Secrets and variables → Actions → New repository secret
  Nombre:  SUPABASE_DB_URL
  Valor:   postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
```

### 2. Bucket de Cloudflare R2

**Dashboard de Cloudflare → R2 → Create bucket** → nómbralo
`vibemenu-backups` (o el nombre que prefieras — va en un secreto, no en el
código).

**Regla de ciclo de vida**, para que no crezca para siempre: en el bucket,
**Settings → Object lifecycle rules → Add rule** → "Delete objects older than
30 days". Con un dump diario, eso deja siempre los últimos 30 respaldos y
borra solo el resto.

**Token de API:** R2 → Manage API tokens → Create API token → permiso
**Object Read & Write**, limitado a este bucket. Te da un `Access Key ID` y un
`Secret Access Key` — trátalos como una contraseña, no como una API pública.

```
GitHub → Settings → Secrets and variables → Actions
  R2_ACCOUNT_ID          tu Account ID de Cloudflare (Dashboard → derecha)
  R2_ACCESS_KEY_ID        del token que acabas de crear
  R2_SECRET_ACCESS_KEY    del mismo token
  R2_BUCKET_BACKUPS       vibemenu-backups
```

### 3. Probar sin esperar al cron

**Actions → Respaldo de la base de datos → Run workflow.** Si termina en
verde, revisa el bucket en el dashboard de R2: debe aparecer
`vibemenu-YYYY-MM-DD.dump`.

---

## Cómo restaurar, el día que haga falta

```bash
# Bajar el archivo mas reciente del bucket (gratis: R2 no cobra egress)
aws s3 cp s3://vibemenu-backups/vibemenu-2026-08-20.dump . \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com

# Restaurar contra un proyecto de Supabase (nuevo o el mismo, vacio)
pg_restore --no-owner --no-acl \
  -d "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" \
  vibemenu-2026-08-20.dump
```

**Prueba esto al menos una vez fuera de una emergencia real** — contra un
proyecto de Supabase nuevo, gratis, creado solo para la prueba. Un respaldo
que nadie ha restaurado nunca es una suposición, no una garantía.

---

## Lo que este workflow NO cubre

- **Las imágenes en sí.** Supabase Storage y Cloudflare R2 ya replican tus
  archivos internamente con alta durabilidad — no hace falta un respaldo
  aparte de las imágenes. Lo único que se pierde si el bucket de imágenes
  desaparece son los archivos; sus referencias (URLs) sí están en el dump de
  la base y se restauran con ella.
- **Las llaves de Stripe y los secretos de las Edge Functions.** Viven en el
  dashboard de Supabase (Edge Functions → Secrets), no en la base de datos.
  Antes de necesitarlos en una restauración de emergencia, tenlos guardados
  aparte en un gestor de contraseñas del equipo.
