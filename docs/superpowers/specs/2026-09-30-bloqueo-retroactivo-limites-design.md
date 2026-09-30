# Bloqueo retroactivo de límites de plan — Diseño

**Fecha:** 2026-09-30
**Rama:** feat/bloqueo-limites-plan (worktree `.claude/worktrees/bloqueo-limites-plan`)
**Origen:** Auditoría de fugas de plan pedida por el usuario (dueño de Vibemenu), sept. 2026. Confirmada línea por línea contra el código.

## Problema

Vibemenu gatea 13 funciones por plan. 12 se reevalúan en vivo contra el `plan_id` actual del tenant (join en cada lectura) o ya tienen un trigger dedicado que revoca al bajar de plan (formato visual, tema, dominio propio — migraciones existentes). Falta una: **los límites de conteo no se aplican retroactivamente.**

`limite_productos`, `limite_sucursales`, `limite_usuarios` y `limite_grupos_modificadores` solo se validan con triggers `before insert` — impiden agregar uno nuevo por encima del tope, pero no hacen nada cuando el plan baja (downgrade manual, trial de Pro vencido a los 14 días, o impago con gracia vencida). `obtenerMenuPublico()` (`src/hooks/useMenuPublico.ts`) trae **todos** los productos `activo=true` y **todas** las sucursales `activa=true` sin aplicar ningún límite de plan, y las políticas RLS de escritura (`*_write_miembros`) solo verifican membresía al tenant, nunca si el plan actual sigue permitiendo el multiusuario que se usó para agregar a un encargado.

Resultado: alguien puede pagar Pro un mes, cargar 50 productos + 3 sucursales + 2 encargados, dejar de pagar o bajar de plan, y conservar todo funcionando igual — de cara al comensal y de cara al panel — indefinidamente.

## Decisiones tomadas (con el usuario, 2026-09-30)

- **Criterio de corte:** automático, sin intervención del dueño. Los N registros más antiguos (por `created_at`) dentro del límite del plan nuevo quedan activos; el resto se bloquea sin borrarse. Sin UI de "elige cuáles conservar" en v1.
- **Impago vencido (7 días de gracia sin resolver):** se elimina el destino `estado='suspendido'` + `PanelBloqueado` del flujo automático. En vez de suspender, se trata exactamente como un downgrade: baja `plan_id` a Free, se aplica el bloqueo por límites. El dueño conserva su panel operando con lo que sí le cabe en Free — no un candado total. `estado='suspendido'` y `PanelBloqueado` **no se borran del código**: quedan como una herramienta manual, no reconstruida en este trabajo, para el caso ya contemplado en la sección 9 de Términos ("Podemos suspender una cuenta que incumpla" por uso indebido, no por impago).
- **Recuperación tardía de impago:** si Stripe logra cobrar después del corte de 7 días pero antes de cancelar la suscripción del todo (sigue reintentando por su cuenta), se restaura automáticamente el `plan_id` que tenía antes de la baja forzada — no se queda atorado en Free habiendo pagado.
- **Vista pública:** lo bloqueado desaparece del menú público por completo (como si no existiera). Las categorías que se quedan sin productos visibles también desaparecen (ya es el comportamiento actual de `obtenerMenuPublico`, se hereda gratis).
- **Panel del dueño:** lo bloqueado sigue en las listas, atenuado, con candado y el motivo ("Bloqueado por tu plan actual"). El dueño nunca pierde visibilidad de lo que tiene guardado, y puede seguir editándolo (el bloqueo no restringe escritura sobre contenido — solo visibilidad pública). Recuperarlo: subir de plan (desbloquea todo de inmediato) o borrar algo activo para liberar cupo (el bloqueado más antiguo pasa a activo automáticamente, sin acción manual extra).
- **Encargados (usuarios de más):** trato distinto al de contenido — pierden acceso de inmediato, no solo visibilidad. Es un asiento de licencia, no un dato que mostrar. El owner nunca se bloquea a sí mismo.
- **Downgrade manual:** antes de confirmar, se le muestra al dueño qué se va a bloquear ("tienes 35 productos, el plan nuevo permite 20 — se bloquearán los 15 más recientes"). Trial vencido e impago no llevan este aviso previo porque ya hay avisos por correo antes; el candado en el panel explica el resto después.
- **Sin swap manual en v1:** no hay UI para que el dueño elija a mano cuál activar sin subir de plan. El único control es indirecto: borrar algo activo libera el cupo para el bloqueado más antiguo automáticamente.

## Alcance

1. Migración: columna `bloqueado_por_plan boolean` en `productos`, `sucursales`, `tenant_usuarios`, `grupos_modificadores`; columna `created_at` nueva en `grupos_modificadores` (no existe hoy).
2. Función `recalcular_bloqueos_plan(tenant_id)` + triggers que la disparan: en cada insert/delete/toggle de visibilidad de las 4 tablas, y en cada cambio de `tenants.plan_id`.
3. `pertenece_a_tenant()` deja de considerar miembro a un encargado bloqueado — un solo cambio que cierra el acceso en cascada (RLS de todas las tablas admin lo usa).
4. `obtenerMenuPublico()` excluye lo bloqueado de productos, sucursales y grupos de modificadores.
5. Cron `procesar-trials-vencidos`: el corte por gracia vencida baja `plan_id` a Free en vez de suspender.
6. `stripe-webhook`: `invoice.paid` restaura el `plan_id` previo si detecta que venía de una baja forzada por impago.
7. Frontend: candado + motivo en `Menu.tsx`, `Sucursales.tsx`, `Equipo.tsx`; aviso previo en el flujo de downgrade de `Suscripcion.tsx`; conteo de bloqueados en `useUsoDelTenant`; visibilidad en `/superadmin`.

## Fuera de alcance

- UI para que el dueño elija manualmente cuál producto/sucursal desbloquear sin subir de plan (swap).
- Reconstruir o exponer un botón de super-admin para suspender manualmente por incumplimiento de Términos — la infraestructura (`estado='suspendido'`, `PanelBloqueado`) queda intacta y disponible, pero activarla a mano es trabajo aparte.
- Cambios a `formato_activo`/`tema`/`dominio_personalizado` — ya están correctamente resueltos por triggers existentes, no se tocan.
- Refinar `situacionComercial()` (`src/lib/superadmin.ts`) para distinguir "en gracia" de "ya bajó a Free por impago" — con los datos actuales (`pago_fallido_desde` + fila `activa` en `suscripciones`) el badge existente "Pago pendiente" sigue siendo correcto todo el tiempo que dure el impago; una etiqueta más fina es un follow-up, no un bloqueante.

## Lo que ya existe (contexto, no se reescribe la base)

- `validar_limite_productos()`, `validar_limite_sucursales()`, `validar_limite_usuarios()` — triggers `before insert`, sin cambios; siguen evitando agregar de más.
- `validar_formatos_tenant()` / `validar_tema_tenant()` — recortan `formato_activo`/`tema` en la misma fila de `tenants` al cambiar `plan_id`. Patrón que este diseño imita para el resto.
- `validar_dominio_tenant()` (migración 019) — revoca `dominio_personalizado` al bajar de plan, encola limpieza en `dominios_huerfanos`. Mismo patrón, tabla distinta.
- `bajarAFree()` en `stripe-webhook` — ya baja a Free sin pasar por `suspendido` cuando Stripe borra la suscripción (cancelación voluntaria o fin de dunning). El único punto que todavía suspende es el cron, para el corte a los 7 días de gracia.
- `useUsoDelTenant()` (`src/hooks/useTenantActual.ts`) — ya cuenta productos/sucursales/tenant_usuarios/grupos_modificadores por tenant con `count: "exact", head: true`. Se extiende, no se reemplaza.
- `pertenece_a_tenant(check_tenant_id)` — función `security definer` que gatea casi todo el RLS de escritura del panel (`tenants_update_miembros`, `sucursales_write_miembros`, `productos_write_miembros`, `grupos_mod_write_miembros`, `tenant_usuarios_select`, etc.). Único punto de verdad para "¿este usuario tiene acceso a este tenant?" — por eso un solo cambio ahí basta para cerrar el acceso de un encargado bloqueado.

## Arquitectura

### 1. Esquema (migración 020)

```sql
alter table productos add column bloqueado_por_plan boolean not null default false;
alter table sucursales add column bloqueado_por_plan boolean not null default false;
alter table tenant_usuarios add column bloqueado_por_plan boolean not null default false;

-- grupos_modificadores no tiene created_at hoy; se necesita para el corte por antigüedad.
alter table grupos_modificadores add column created_at timestamptz not null default now();
alter table grupos_modificadores add column bloqueado_por_plan boolean not null default false;
```

Sin `grant` extra a `authenticated`: la columna se lee vía `select *` (ya permitido) y solo la escribe la función `security definer`.

### 2. Función de recálculo

Una función por tenant, reutilizada por los triggers de las 4 tablas y por el trigger de `tenants`:

```sql
create or replace function recalcular_bloqueos_plan(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limite_productos int;
  v_limite_sucursales int;
  v_limite_usuarios int;
  v_limite_grupos int;
  v_permite_multiusuario boolean;
begin
  -- Serializa recálculos concurrentes del mismo tenant (mismo patrón que los
  -- triggers de límite existentes).
  perform pg_advisory_xact_lock(hashtext('bloqueos_plan:' || p_tenant_id::text));

  select p.limite_productos, p.limite_sucursales, p.limite_usuarios,
         p.limite_grupos_modificadores, p.permite_multiusuario
    into v_limite_productos, v_limite_sucursales, v_limite_usuarios,
         v_limite_grupos, v_permite_multiusuario
    from tenants t join planes p on p.id = t.plan_id
   where t.id = p_tenant_id;

  if not found then
    return; -- tenant sin plan válido; no debería pasar, se ignora en vez de tronar.
  end if;

  -- Productos: solo compiten por cupo los visibles (activo=true). Uno que el
  -- propio dueño ya ocultó no consume límite ni se marca bloqueado por esto.
  with rankeados as (
    select id, row_number() over (order by created_at, id) as rank
      from productos
     where tenant_id = p_tenant_id and activo = true
  )
  update productos p
     set bloqueado_por_plan = (r.rank > coalesce(v_limite_productos, r.rank))
    from rankeados r
   where p.id = r.id;

  update productos
     set bloqueado_por_plan = false
   where tenant_id = p_tenant_id and activo = false and bloqueado_por_plan;

  -- Sucursales: mismo patrón con activa=true.
  with rankeadas as (
    select id, row_number() over (order by created_at, id) as rank
      from sucursales
     where tenant_id = p_tenant_id and activa = true
  )
  update sucursales s
     set bloqueado_por_plan = (r.rank > coalesce(v_limite_sucursales, r.rank))
    from rankeadas r
   where s.id = r.id;

  update sucursales
     set bloqueado_por_plan = false
   where tenant_id = p_tenant_id and activa = false and bloqueado_por_plan;

  -- Grupos de modificadores: sin bandera de visibilidad, cuentan todos.
  with rankeados as (
    select id, row_number() over (order by created_at, id) as rank
      from grupos_modificadores
     where tenant_id = p_tenant_id
  )
  update grupos_modificadores g
     set bloqueado_por_plan = (r.rank > coalesce(v_limite_grupos, r.rank))
    from rankeados r
   where g.id = r.id;

  -- Encargados: el owner nunca se bloquea (no entra al ranking). Si el plan no
  -- permite multiusuario en absoluto, todos los encargados se bloquean sin
  -- importar limite_usuarios (limite_usuarios es un tope adicional cuando el
  -- multiusuario sí está permitido, no lo que lo habilita).
  with rankeados as (
    select id, row_number() over (order by created_at, id) as rank
      from tenant_usuarios
     where tenant_id = p_tenant_id and rol = 'encargado'
  )
  update tenant_usuarios u
     set bloqueado_por_plan = (
       not coalesce(v_permite_multiusuario, false)
       or r.rank > coalesce(v_limite_usuarios - 1, r.rank) -- -1: el owner ya ocupa un asiento
     )
    from rankeados r
   where u.id = r.id;
end;
$$;
```

`limite_usuarios` cuenta owner + encargados juntos (así lo valida hoy `validar_limite_usuarios`), de ahí el `- 1`. Si `limite_usuarios` es `null` (sin tope, plan Enterprise) el `coalesce` lo vuelve "nunca bloquea por conteo" y solo `permite_multiusuario` decide.

### 3. Triggers

Un trigger `AFTER` por tabla — dispara el recálculo, no valida nada (eso lo siguen haciendo los triggers `before insert` existentes, sin tocar):

```sql
create or replace function trg_recalcular_bloqueos_hijo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform recalcular_bloqueos_plan(coalesce(new.tenant_id, old.tenant_id));
  return null; -- AFTER: el valor de retorno se ignora
end;
$$;

create trigger trg_productos_40_bloqueo
  after insert or delete or update of activo on productos
  for each row execute function trg_recalcular_bloqueos_hijo();

create trigger trg_sucursales_40_bloqueo
  after insert or delete or update of activa on sucursales
  for each row execute function trg_recalcular_bloqueos_hijo();

create trigger trg_grupos_mod_40_bloqueo
  after insert or delete on grupos_modificadores
  for each row execute function trg_recalcular_bloqueos_hijo();

create trigger trg_tenant_usuarios_40_bloqueo
  after insert or delete on tenant_usuarios
  for each row execute function trg_recalcular_bloqueos_hijo();

create or replace function trg_recalcular_bloqueos_por_plan()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.plan_id is distinct from old.plan_id then
    perform recalcular_bloqueos_plan(new.id);
  end if;
  return new;
end;
$$;

create trigger trg_tenants_30_bloqueos
  after update of plan_id on tenants
  for each row execute function trg_recalcular_bloqueos_por_plan();
```

`AFTER` en `tenants` (no `BEFORE`, a diferencia de los triggers de formato/tema): `recalcular_bloqueos_plan` hace su propio `select` contra `tenants` para leer el plan, así que necesita que la fila ya esté escrita. No compite con `trg_tenants_20_formatos`/`trg_tenants_25_tema` (son `BEFORE`, corren antes y sobre otras columnas).

Efecto colateral buscado, no un caso especial: si el dueño borra un producto activo viejo, el `DELETE` dispara `trg_productos_40_bloqueo` → `recalcular_bloqueos_plan` vuelve a rankear con un hueco libre → el bloqueado más antiguo pasa a `bloqueado_por_plan=false` solo. No hace falta ninguna función de "intercambio manual".

### 4. Acceso de encargados — un solo cambio

```sql
create or replace function pertenece_a_tenant(check_tenant_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from tenant_usuarios
    where tenant_id = check_tenant_id
      and user_id = auth.uid()
      and not bloqueado_por_plan
  );
$$;
```

Como casi todas las políticas de escritura del panel llaman a `pertenece_a_tenant()`, un encargado bloqueado pierde acceso de escritura en cascada sin tocar cada política una por una. `es_owner_de_tenant()` no se toca — el owner nunca tiene `bloqueado_por_plan=true`.

`useTenantActual()` (`src/hooks/useTenantActual.ts`) hace `select ... from tenant_usuarios where user_id = ...`, gateado por la policy `tenant_usuarios_select` (que también usa `pertenece_a_tenant`). Un encargado bloqueado deja de ver su propia fila → `data?.tenant` llega `null` → la app ya trata "usuario autenticado sin tenant" como caso existente (es el mismo camino que ve hoy alguien recién registrado, o un encargado al que el owner borró a mano) — no hace falta pantalla nueva.

### 5. Menú público (`src/hooks/useMenuPublico.ts`)

Tres queries en `armarMenuPublico` ganan un filtro:

```ts
// sucursales
.eq("activa", true)
.eq("bloqueado_por_plan", false)   // nuevo

// productos
.eq("activo", true)
.eq("bloqueado_por_plan", false)   // nuevo

// grupos_modificadores
.eq("bloqueado_por_plan", false)   // nuevo (hoy no filtra nada, trae todos)
```

El filtro de categorías vacías (`categoriasConProductos.filter((c) => c.productos.length > 0)`, ya existente) hace que una categoría que se quedó sin productos visibles desaparezca sola — sin cambio ahí.

### 6. Cron `procesar-trials-vencidos`

Único cambio, en la parte 3 (hoy "Pago fallido: suspender tras 7 días de gracia"):

```ts
// Antes:
const { error } = await db.from("tenants").update({ estado: "suspendido" }).eq("id", t.id);

// Después (reutiliza planFree, ya resuelto arriba para la parte 2):
const { error } = await db.from("tenants").update({ plan_id: planFree.id }).eq("id", t.id);
```

No toca `pago_fallido_desde` (se queda puesto — todavía no ha pagado) ni `estado` (se queda `'activo'`, igual que hoy durante toda la gracia). El `update` de `plan_id` dispara `trg_tenants_30_bloqueos` (bloqueo por límites) y, de paso, `trg_tenants_20_formatos`/`trg_tenants_25_tema` (recorte de formato/tema) — mismo camino que un downgrade manual o un trial vencido.

Renombrar el comentario de la sección 3 del archivo (ya no "suspender"); el nombre de la función/archivo (`procesar-trials-vencidos`) no cambia, sigue siendo preciso.

### 7. `stripe-webhook` — recuperación tardía

En el handler `invoice.paid`, después del `upsert` a `pagos` y antes del `update` que limpia `pago_fallido_desde`:

```ts
const { data: fila } = await db
  .from("suscripciones")
  .select("id, tenant_id, plan_id")   // + plan_id (antes solo id, tenant_id)
  .eq("stripe_subscription_id", suscripcionId)
  .order("fecha_inicio", { ascending: false })
  .limit(1)
  .maybeSingle();
if (!fila) break;

// ... upsert a `pagos` sin cambios ...

await db
  .from("tenants")
  .update({ pago_fallido_desde: null, estado: "activo" })
  .eq("id", fila.tenant_id);

// Nuevo: si el cron forzó una baja a Free por impago, el plan_id del tenant
// quedó por detrás del de la fila `activa` de suscripciones (esa fila nunca
// se tocó — sigue apuntando al plan pagado). Si difieren, se restaura.
// Sin efecto en el caso normal (ya coinciden) ni en checkout.session.completed
// (esa fila se abre con el mismo plan_id que ya trae tenants).
if (fila.plan_id) {
  await db
    .from("tenants")
    .update({ plan_id: fila.plan_id })
    .eq("id", fila.tenant_id)
    .neq("plan_id", fila.plan_id);
}
```

El `.neq("plan_id", fila.plan_id)` hace que el `update` sea un no-op (0 filas afectadas) cuando no hubo baja forzada — no dispara `trg_tenants_30_bloqueos` de más en cada renovación normal. Cuando sí hubo baja forzada, restaurar `plan_id` dispara el recálculo de bloqueos (todo vuelve a caber, se desbloquea) y el recorte de formato/tema existente (mismo comportamiento que cualquier otro cambio de plan — no es un caso nuevo a resolver, ya está cubierto).

`bajarAFree()` no cambia: ya baja a Free sin pasar por `suspendido` cuando Stripe cancela la suscripción del todo (dunning agotado o cancelación voluntaria).

### 8. Frontend

**`src/hooks/useTenantActual.ts` — `useUsoDelTenant`:** además del conteo total por tabla, agrega el conteo de bloqueados:

```ts
const contarBloqueados = async (tabla: TablaConLimite) => {
  const { count, error } = await supabase
    .from(tabla)
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId!)
    .eq("bloqueado_por_plan", true);
  if (error) throw error;
  return count ?? 0;
};
```

Devuelve `{ productos, sucursales, usuarios, gruposModificadores, productosBloqueados, sucursalesBloqueadas, usuariosBloqueados, gruposBloqueados }`.

**`src/pages/admin/Menu.tsx`, `Sucursales.tsx`, `Equipo.tsx`:** cada fila con `bloqueado_por_plan=true` se pinta atenuada (`opacity-60` o similar, consistente con el resto del panel) con un ícono de candado (`Lock`, `lucide-react`, ya usado en el proyecto vía otros íconos de la misma librería) y el texto "Bloqueado por tu plan actual". El botón de editar sigue habilitado (el bloqueo no restringe escritura de contenido, solo visibilidad pública / acceso de encargado). En `Equipo.tsx` el texto para un encargado bloqueado es distinto: "Sin acceso — súbete de plan para reactivarlo" (ahí sí es acceso, no solo visibilidad).

**`src/pages/admin/Suscripcion.tsx`:** antes de confirmar un downgrade manual, un helper puro nuevo en `src/lib/plan.ts`:

```ts
export function seBloquearianAlBajar(
  usoActual: { productos: number; sucursales: number; usuarios: number; gruposModificadores: number },
  planNuevo: Pick<Plan, "limite_productos" | "limite_sucursales" | "limite_usuarios" | "permite_multiusuario" | "limite_grupos_modificadores">,
): { productos: number; sucursales: number; usuarios: number; gruposModificadores: number }
```

Resta contra los límites del plan destino (mismo criterio de corte que el trigger: lo que exceda el límite se bloquearía). El componente de confirmación de downgrade muestra un resumen ("se bloquearán: 15 productos, 1 sucursal") solo con los renglones que sean `> 0`.

**`src/pages/SuperAdmin.tsx` / `SuperAdminDetalle.tsx`:** junto a los conteos de uso que ya muestra la ficha (`limite={detalle.plan?.limite_productos}`), agrega el conteo de bloqueados de esa tabla si es `> 0` — visibilidad para soporte sin tener que ir a SQL.

**`src/types/database.ts`:** regenerar desde Supabase (`generate_typescript_types`) tras aplicar la migración — trae solas `bloqueado_por_plan` en las 4 tablas y `created_at` en `grupos_modificadores`. `src/lib/demo.ts` (fixtures de demo) gana `bloqueado_por_plan: false` en sus entradas de productos/sucursales/grupos si el tipo lo exige.

## Secuencia de despliegue

1. Aplicar la migración 020 (MCP `apply_migration`).
2. Regenerar `src/types/database.ts`.
3. Desplegar `procesar-trials-vencidos` y `stripe-webhook` (Edge Functions).
4. Frontend: helper `seBloquearianAlBajar`, cambios en `Menu.tsx`/`Sucursales.tsx`/`Equipo.tsx`/`Suscripcion.tsx`/`SuperAdmin*.tsx`, extensión de `useUsoDelTenant`.
5. Merge a `main` (Vercel despliega solo en el push).

## QA manual

Además de las pruebas automatizadas (TDD por unidad para `recalcular_bloqueos_plan` vía pruebas SQL estilo `vibemenu_pruebas_triggers.sql`, y para `seBloquearianAlBajar` como función pura):

- Tenant de prueba en Pro con 30 productos, 3 sucursales, 2 encargados. Bajar a Free (límite 20/1/0) a mano desde `/admin/suscripcion`:
  - Se muestra el aviso previo con los conteos correctos antes de confirmar.
  - Tras confirmar: 10 productos y 2 sucursales quedan `bloqueado_por_plan=true` (los más recientes), los 2 encargados también (Free no permite multiusuario).
  - El menú público (`/<slug>`) ya no muestra los 10 productos ni la sucursal bloqueada; las categorías que se quedaron sin productos visibles desaparecen.
  - En el panel, los 10 productos siguen en la lista con candado; se pueden editar (título, precio) sin error.
  - Los 2 encargados ya no pueden iniciar sesión en el panel del tenant (llegan a "sin acceso", no a un error crudo de RLS).
- Borrar uno de los 20 productos activos → el producto bloqueado más antiguo pasa a activo solo, reaparece en el menú público, sin acción manual extra.
- Subir el mismo tenant de Free a Pro otra vez → los 10 productos, la sucursal y los 2 encargados se desbloquean todos de inmediato.
- Simular impago con el guion de Stripe (`docs/pruebas-stripe-test.md`, pasos 3-4 actualizados): al vencer la gracia de 7 días, el tenant baja a Free (no queda `suspendido`, el panel sigue accesible) y lo que sobra se bloquea igual que un downgrade manual.
- Recuperación tardía: con el tenant ya bajado a Free por impago, pagar la factura pendiente después del corte de 7 días → `plan_id` vuelve al plan pagado, todo se desbloquea, sin pasar por `/admin/suscripcion` a mano.
- Confirmar que un tenant con `estado='suspendido'` puesto a mano en la base (simulando el uso futuro para incumplimiento de Términos) sigue mostrando `PanelBloqueado` como hoy — no se rompió ese camino.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Recalcular en cada insert/delete de las 4 tablas agrega overhead a operaciones frecuentes (agregar un producto) | El recálculo es un `update` acotado a las filas del tenant (decenas, no miles) bajo un `pg_advisory_xact_lock` — mismo costo relativo que los triggers de límite `before insert` que ya existen. |
| Dos triggers (`before insert` de límite y `after insert` de bloqueo) en la misma tabla podrían parecer redundantes | No lo son: el `before` impide crecer sin control hacia adelante; el `after` corrige el pasado cuando el plan cambia. Se necesitan los dos. |
| Un encargado bloqueado a mitad de sesión (pestaña abierta) sigue viendo datos ya cargados en el cliente hasta el siguiente refetch | Aceptable para v1 — el próximo `useQuery` (staleTime 30s en `useTenantActual`) lo saca. Sin invalidación en tiempo real (Realtime) en el alcance. |
| `invoice.paid` restaura `plan_id` incluso si el dueño, mientras tanto, decidió voluntariamente bajar de plan por su cuenta (no por impago) | Improbable en la ventana de días que dura el dunning de Stripe, y el peor caso es "vuelve a su plan pagado, que sigue pagando" — no es una pérdida para el negocio. Fuera de alcance resolverlo con más precisión. |
| Otra sesión de Claude Code toca los mismos archivos en el checkout compartido | Este trabajo vive en un worktree aislado (`.claude/worktrees/bloqueo-limites-plan`), no en el checkout principal — cero riesgo de choque con sesiones hermanas activas en `main`. |
