# Plan: Migración a Supabase

## Objetivo

Reemplazar el almacenamiento en archivos JSON locales (`/data/users/`) por Supabase Postgres. Adicionalmente, guardar el **resumen completo de cada análisis de video** para permitir comparaciones históricas entre sesiones.

---

## Schema SQL

```sql
-- 1. Usuarios
create table users (
  id          uuid primary key default gen_random_uuid(),
  username    text unique not null,
  password    text not null,        -- plain text (igual que ahora)
  display_name text not null,
  created_at  timestamptz default now()
);
insert into users (username, password, display_name)
values ('valentin', '997', 'Valentín');

-- 2. Sesiones de análisis de video
create table sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(id) on delete cascade,
  created_at      timestamptz default now(),
  exercise        text not null,
  score           int not null,
  previous_score  int,
  improvement     int,
  -- Resumen generado por Gemini (nuevo campo clave)
  ai_summary      text,
  -- Datos completos de análisis (JSONB para queries)
  positives       text[] default '{}',
  corrections     jsonb default '[]',   -- [{point, severity, cue}]
  next_steps      text[] default '{}',
  frame_descriptions text[] default '{}',
  revised_time    text
);
create index sessions_user_id_idx on sessions(user_id);
create index sessions_exercise_idx on sessions(exercise);

-- 3. Chats guardados
create table chats (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references users(id) on delete cascade,
  title        text not null,
  exercise     text,
  score        int,
  messages     jsonb not null default '[]',  -- [{role, content}]
  message_count int default 0,
  created_at   timestamptz default now()
);
create index chats_user_id_idx on chats(user_id);

-- 4. Rutinas de entrenamiento
create table routines (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references users(id) on delete cascade,
  name               text not null,
  week_count         int not null,
  has_deload         boolean default false,
  deload_percentage  int default 50,
  start_date         text not null,
  days               jsonb default '[]',      -- RoutineDay[]
  one_rms            jsonb default '{}',      -- Record<string, number>
  raw_text           text,                    -- texto original del usuario
  created_at         timestamptz default now()
);
create index routines_user_id_idx on routines(user_id);

-- 5. Registros semanales de entrenamiento
create table week_logs (
  id           uuid primary key default gen_random_uuid(),
  routine_id   uuid references routines(id) on delete cascade,
  user_id      uuid references users(id) on delete cascade,
  week_number  int not null,
  days         jsonb not null default '[]',   -- DayLog[]
  logged_at    timestamptz default now(),
  unique(routine_id, week_number)
);
create index week_logs_routine_id_idx on week_logs(routine_id);

-- 6. Objetivos
create table goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references users(id) on delete cascade,
  text          text not null,
  category      text not null,    -- 'skill'|'strength'|'endurance'|'body'|'other'
  target_date   text,
  achieved      boolean default false,
  achieved_date timestamptz,
  created_at    timestamptz default now()
);
create index goals_user_id_idx on goals(user_id);
```

---

## Estructura de archivos a crear/modificar

```
lib/
  supabase.ts          ← cliente Supabase (server-side, usa service role key)
  supabase-browser.ts  ← cliente Supabase (browser, anon key) — solo si se necesita
  storage.ts           ← reemplazar fs por queries Supabase
  training.ts          ← reemplazar fs por queries Supabase
  chats.ts             ← reemplazar fs por queries Supabase
  goals.ts             ← reemplazar fs por queries Supabase
  users.ts             ← reemplazar array hardcodeado por query Supabase
.env.local             ← agregar SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
```

---

## Pasos de implementación

### Paso 1 — Setup inicial
- Instalar `@supabase/supabase-js`
- Agregar variables a `.env.local`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=eyJhb...
  ```
- Crear `lib/supabase.ts` con cliente admin (service role, solo server-side)

### Paso 2 — Schema en Supabase
- Ejecutar el SQL de arriba en el SQL Editor de Supabase
- Verificar que el usuario `valentin` fue insertado

### Paso 3 — Migrar `lib/users.ts`
- `verifyCredentials()` → `select * from users where username = $1`
- Retorna el mismo tipo `User`

### Paso 4 — Migrar `lib/storage.ts` (sesiones)
- `saveSession()` → `insert into sessions`
- `getAllSessions()` → `select * from sessions where user_id = $1 order by created_at desc`
- `getSessionsByExercise()` → agregar `where exercise = $2`
- Agregar campo `ai_summary` al flujo de análisis:
  - En `app/api/analyze/route.ts`: al final del análisis, pedir a Gemini un resumen conciso (2-3 oraciones) del desempeño → guardarlo en `ai_summary`

### Paso 5 — Migrar `lib/chats.ts`
- `saveChat()` → `insert into chats`
- `getAllChats()` → `select * from chats where user_id = $1`
- `deleteChat()` → `delete from chats where id = $1`

### Paso 6 — Migrar `lib/training.ts`
- Rutinas: CRUD sobre tabla `routines`
- Week logs: upsert sobre tabla `week_logs` (unique constraint routine_id + week_number)
- `calcWeekVolume()` no cambia (lógica pura, opera sobre el JSONB ya hidratado)

### Paso 7 — Migrar `lib/goals.ts`
- CRUD estándar sobre tabla `goals`

### Paso 8 — Limpieza
- Eliminar directorio `/data` del proyecto
- Agregar `/data` a `.gitignore` (si no está)
- Verificar que ningún `import fs` queda en módulos que se usen en cliente

---

## Detalles del campo `ai_summary` (feature nueva)

En `app/api/analyze/route.ts`, después de obtener el análisis completo, agregar un segundo prompt a Gemini:

```
"En 2-3 oraciones, resume el desempeño de este atleta en {exercise}.
Menciona el puntaje ({score}/100), el punto más importante a mejorar
y un aspecto positivo destacable. Sé directo y específico."
```

Esto se guarda en `sessions.ai_summary`. Luego en la página `/history`
se puede mostrar esta descripción corta debajo de cada sesión,
y al comparar dos sesiones se muestran ambos resúmenes lado a lado.

---

## Consideraciones de seguridad

- Usar **service role key** solo en server-side (route handlers, lib/ con fs)
- **Nunca** exponer service role key al browser
- RLS (Row Level Security) de Supabase: desactivar por ahora (auth es propia via cookie)
- Si en el futuro se migra a Supabase Auth, habilitar RLS con `auth.uid()`

---

## Orden de prioridad

1. Setup + schema + `lib/supabase.ts`
2. `lib/storage.ts` → sesiones (core de la app)
3. `ai_summary` en el flujo de análisis
4. `lib/goals.ts`
5. `lib/chats.ts`
6. `lib/training.ts` (más complejo por week logs)
7. `lib/users.ts`
8. Limpieza y tests manuales
