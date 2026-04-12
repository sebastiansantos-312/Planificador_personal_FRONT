# 🏗️ Arquitectura del Frontend — Study Planner App

> **Stack:** React 19 · TypeScript · Vite · React Router v7 · Axios · TailwindCSS v4  
> **Entorno:** 100% local · Vite dev server en `http://localhost:5173`

---

## 📁 Estructura de archivos

```
planificador_estudio_personal/FRONT/
├── index.html              → Punto de entrada HTML
├── package.json            → Dependencias y scripts npm
├── vite.config.ts          → Configuración de Vite
├── tsconfig.json           → Configuración TypeScript
├── vercel.json             → Configuración de deploy (no usado en local)
├── .env.production         → URL del backend en producción — NO subir a git
│
└── src/
    ├── main.tsx            → Monta <App /> en el DOM
    ├── App.tsx             → Árbol de rutas con React Router
    ├── index.css           → Estilos globales base
    │
    ├── pages/              → Una página = una ruta de la app
    │   ├── AuthPage.tsx        → /auth          — Login y registro
    │   ├── HoyPage.tsx         → /hoy           — Vista diaria de subtareas priorizadas + config límite
    │   ├── CrearPage.tsx       → /crear         — Formulario para crear tarea + pasos opcionales
    │   ├── ActividadPage.tsx   → /actividad/:id — Detalle: editar tarea, gestionar pasos (CRUD completo)
    │   ├── ActividadesPage.tsx → /actividades   — Lista global de tareas con filtros por estado
    │   ├── ProgresoPage.tsx    → /progreso      — Dashboard de estadísticas por materia
    │   └── MateriasPage.tsx    → /materias      — CRUD de materias con selector de color
    │
    ├── components/         → Componentes reutilizables compartidos
    │   ├── Layout.tsx          → Shell: navbar superior + <Outlet /> de React Router
    │   ├── ProtectedRoute.tsx  → Guard: redirige a /auth si no hay sesión
    │   └── TaskCard.tsx        → Tarjeta visual de una tarea (usada en ProgresoPage)
    │
    ├── services/           → Capa de acceso a la API (toda la comunicación HTTP)
    │   ├── api.ts              → Instancia Axios con baseURL + interceptores JWT
    │   ├── authService.ts      → Login, registro, sesión en localStorage
    │   ├── taskService.ts      → CRUD de tareas + vista /hoy/prioridades + checkConflict
    │   ├── subtaskService.ts   → CRUD de pasos + checkConflict + getWeekSummary
    │   └── subjectService.ts   → CRUD de materias
    │
    └── types/
        └── index.ts        → Todas las interfaces y tipos TypeScript del proyecto
```

---

## 🔄 Flujo general de la aplicación

```
Usuario abre la app
        │
        ▼
main.tsx → <App /> → React Router
        │
        ├── /auth  ──────────────────────────── AuthPage (pública)
        │
        └── /*  → ProtectedRoute
                   │
                   ¿hay token en localStorage?
                   │
              NO ──┘   SI
              ↓          ↓
         /auth        Layout (navbar)
                        │
                        ├─ /hoy            → HoyPage
                        ├─ /crear          → CrearPage
                        ├─ /actividad/:id  → ActividadPage
                        ├─ /actividades    → ActividadesPage
                        ├─ /progreso       → ProgresoPage
                        └─ /materias       → MateriasPage
```

---

## 🔐 Autenticación: Cómo funciona la sesión

> **Archivos:** `services/api.ts` + `services/authService.ts` + `components/ProtectedRoute.tsx`

### 1. Login

```
Usuario ingresa email y contraseña en AuthPage
        │
        ▼  authService.login({ email, password })
  POST /auth/login  ←── Axios via api.ts
        │
        ▼  Backend verifica bcrypt y retorna:
  { access_token, token_type, user_id, email, first_name, last_name }
        │
        ▼  authService.saveSession(data)
  localStorage.setItem("token",           access_token)
  localStorage.setItem("user_id",         user.id)
  localStorage.setItem("user_email",      user.email)
  localStorage.setItem("user_first_name", user.first_name)
  localStorage.setItem("user_last_name",  user.last_name)
        │
        ▼
  navigate("/hoy")
```

### 2. El JWT se adjunta automáticamente a cada petición

```typescript
// api.ts — interceptor de REQUEST
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
```

### 3. Si el token expira → logout automático

```typescript
// api.ts — interceptor de RESPONSE
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = "/auth";
        }
        return Promise.reject(error);
    }
);
```

### 4. ProtectedRoute: guarda de rutas

```
<ProtectedRoute>
    <Layout />    ← Solo se renderiza si hay token
</ProtectedRoute>

authService.isAuthenticated()
  → !!localStorage.getItem("token")
  → true  → renderiza children
  → false → <Navigate to="/auth" replace />
```

### 5. Logout

```typescript
// Layout.tsx → botón "Salir"
authService.clearSession()
  → elimina: token, user_id, user_email, user_first_name, user_last_name
navigate("/auth")
```

---

## 🌐 Comunicación con el Backend (api.ts)

```typescript
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000"
});
```

| Entorno | URL del backend |
|---------|----------------|
| Local | `http://localhost:8000` (fallback en `api.ts`) |

---

## 📄 Páginas — Cómo funciona cada una

---

### 📍 AuthPage — `/auth`

**Propósito:** Página pública de login y registro.

| Estado | Tipo | Descripción |
|--------|------|-------------|
| `mode` | `"login" \| "register"` | Controla qué formulario se muestra |
| `email`, `password` | `string` | Campos compartidos |
| `firstName`, `lastName`, `birthDate` | `string` | Solo en modo registro |
| `state` | `LoadingState` | `idle \| loading \| success \| error` |

**Flujo LOGIN:** `handleSubmit()` → `authService.login()` → `POST /auth/login` → `saveSession()` → `navigate("/hoy")`

**Flujo REGISTRO:** `handleSubmit()` → `authService.register()` → `POST /users/` → auto-login → `navigate("/hoy")`

---

### 📍 HoyPage — `/hoy`

**Propósito:** Pantalla principal. Muestra las **subtareas** del usuario agrupadas en 3 secciones (vencidas / para hoy / próximas), con panel de configuración de límite diario.

| Estado | Tipo | Descripción |
|--------|------|-------------|
| `overdue` | `HoySubtask[]` | Subtareas vencidas (`target_date < hoy`) |
| `forToday` | `HoySubtask[]` | Subtareas con objetivo hoy |
| `upcoming` | `HoySubtask[]` | Subtareas futuras |
| `subjects` | `Subject[]` | Materias para color/nombre |
| `limitHours` | `number` | Límite diario en horas (de `GET /users/{id}/config`) |
| `showConfig` | `boolean` | Abre/cierra el panel de configuración |
| `overloadModal` | `{ days: string[] } \| null` | Modal de días con exceso al bajar el límite |
| `todayOverload` | `number \| null` | Horas en exceso del día actual (calculado en frontend) |

**Badge de exceso de horas:**
```
totalTodayMinutes = suma de estimated_minutes de forToday
si totalTodayMinutes > limitHours * 60:
  → badge "⚠️ +Xh del límite" aparece junto al título "Para hoy"
```

**Configuración del límite:**
```
[⚙️ Config] → panel deslizable
→ Usuario ajusta deslizador (1–16 h)
→ [Guardar]
    │  GET /subtasks/daily-overload?user_id=...&new_limit_minutes=...
    │  → ¿hay días con exceso?
    ├── NO → PATCH /users/{id}/config → guarda límite
    └── SÍ → abre overloadModal con días afectados
              → "Guardar de todas formas" o "Cancelar"
```

**Click en tarjeta de subtarea:** `navigate("/actividad/{task_id}")`

---

### 📍 CrearPage — `/crear`

**Propósito:** Formulario en 3 secciones para crear una tarea con sus pasos opcionales.

| Estado | Descripción |
|--------|-------------|
| `title` | Título de la tarea |
| `taskType` | Tipo (examen, quiz, taller, proyecto, exposición, otro) — obligatorio |
| `subjectId` | UUID de la materia seleccionada (opcional — click en seleccionada la desmarca) |
| `dueDate` | Fecha límite — obligatoria |
| `durationMinutes` | Duración total estimada en minutos (default: 60) |
| `priority` | alta / media / baja (default: media) |
| `subtasks` | Array de pasos en borrador (solo en memoria) |
| `conflictData` | `ConflictResult \| null` — datos del modal de advertencia de hora |

**Materia opcional con toggle:** hacer click en la materia ya seleccionada la **desmarca** (muestra `✕`).

**Flujo de envío — Sprint 3:**
```
handleSubmit()
    │
    ├── 1. taskService.checkConflict(DUMMY_UUID, dueDate, durationMinutes, userId)
    │      → POST /tasks/00000000.../check-conflict
    │      → Suma task.duration_minutes de otras tareas ese día
    │        + subtask.estimated_minutes de pasos ese día
    │
    ├── has_conflict = false → doCreate() directamente
    │
    └── has_conflict = true → Modal ⚠️ con:
            │  • Horas ya planificadas ese día: Xh
            │  • Límite configurado: Yh
            │  • Total con esta actividad: Zh
            ├── "Crear de todas formas" → doCreate() igualmente
            └── "Cancelar"            → cierra modal, el usuario ajusta
```

**`doCreate()`:** `POST /tasks/` → loop `POST /subtasks/` (uno por paso) → `navigate("/actividad/{id}")`

**El botón "Crear actividad" se deshabilita si:** falta título, tipo de actividad o fecha límite.

---

### 📍 ActividadPage — `/actividad/:id`

**Propósito:** Página de detalle de una tarea. Permite ver, editar y gestionar la tarea y todos sus pasos con CRUD completo.

**Estado interno principal:**

| Estado | Descripción |
|--------|-------------|
| `task` | La tarea cargada |
| `subject` | La materia asociada (puede ser null si no tiene) |
| `subtasks` | Lista de pasos de la tarea |
| `editingTask` | Modo edición inline de la tarea principal |
| `editSubjectId` | UUID de la materia en el formulario de edición (vacío = sin materia) |
| `subjects` | Materias del usuario cargadas al abrir edición |
| `editConflictData` | `ConflictResult \| null` — advertencia de horas al guardar edición |
| `pendingEditSave` | `boolean` — indica que hay un conflicto esperando confirmación |
| `editingSubtaskId` | UUID del paso en modo reprogramar fecha |
| `editingContentId` | UUID del paso en modo editar título/descripción |
| `postponingId` | UUID del paso en modo posposición con nota |
| `conflictModal` | Datos del conflicto al reprogramar un paso (3 opciones de resolución) |
| `showAddStep` | Muestra el formulario para agregar un nuevo paso |

#### Acciones sobre la TAREA:

| Acción | Cómo funciona |
|--------|---------------|
| ✏️ Editar | Formulario inline con título, fecha, duración, tipo, prioridad **y materia** → `PATCH /tasks/{id}` |
| Materia en edición | Toggle: click selecciona / click en la misma desmarca (envía `null` al backend para limpiar) |
| Conflicto al guardar | Si la nueva fecha supera el límite → advertencia ⚠️ inline con opción "Guardar de todas formas" |
| Cambiar estado | Botones Pendiente/En progreso/Completada → `PATCH /tasks/{id}` |
| 🗑 Eliminar | Confirm nativo → `DELETE /tasks/{id}` → `navigate("/hoy")` |

**Flujo de guardado con conflicto — Sprint 3:**
```
saveTaskEdits()
    │
    ├── taskService.checkConflict(task.id, editDueDate, editDuration, userId)
    │      → POST /tasks/{id}/check-conflict
    │      → Excluye la tarea actual del conteo (soporta cambio de fecha)
    │
    ├── has_conflict = false → doSaveTaskEdits() directamente
    │
    └── has_conflict = true → Advertencia inline ⚠️:
            │  • Horas ya planificadas ese día: Xh
            │  • Límite configurado: Yh
            │  • Total con esta actividad: Zh
            ├── "Guardar de todas formas" → doSaveTaskEdits()
            └── "Cambiar fecha"          → resetea conflicto, usuario edita
```

#### Acciones sobre cada PASO:

| Ícono | Acción | Endpoint |
|-------|--------|----------|
| ✓ checkbox | Marcar hecha / volver a pendiente | `PATCH /subtasks/{id}` |
| ⏭ | Posponer con nota opcional | `PATCH /subtasks/{id}` |
| 📅 | Reprogramar fecha + verificar conflicto (Sprint 3) | `POST /subtasks/{id}/check-conflict` → `PATCH /subtasks/{id}` |
| ✏️ | Editar título y descripción | `PATCH /subtasks/{id}` |
| 🗑 | Eliminar paso | `DELETE /subtasks/{id}` |
| + Agregar paso | Formulario: título, desc, fecha, minutos | `POST /subtasks/` |

**Modal de conflicto al reprogramar un paso — Sprint 3:**
```
has_conflict = true → ConflictModal con 3 opciones:
  ├── Opción 1: Mover a otro día → re-verifica en la nueva fecha
  ├── Opción 2: Reducir minutos estimados → guardar con menos tiempo
  └── Guardar de todas formas → ignora el conflicto y guarda
```

---

### 📍 ActividadesPage — `/actividades`

**Propósito:** Lista global de todas las tareas del usuario con filtros por estado.

| Estado | Descripción |
|--------|-------------|
| `tasks` | Todas las tareas del usuario |
| `subjects` | Materias para mostrar nombre y color |
| `filter` | `all \| pending \| in_progress \| done` |

**Carga:**
```
Promise.all([
    taskService.getByEmail(email),    → GET /tasks/by-email
    subjectService.getByEmail(email)  → GET /subjects/by-email
])
```

**Ordenamiento:** por prioridad (alta→media→baja) y luego por `due_date` ascendente.

**Click en tarjeta:** `navigate("/actividad/{task.id}")`

**Indicadores de urgencia:**
- Rojo → vencida y no completada
- Ámbar → vence en ≤ 2 días
- Gris → resto

---

### 📍 ProgresoPage — `/progreso`

**Propósito:** Dashboard de estadísticas académicas basado en subtareas.

**Carga (paralela):**
```
taskService.getByEmail(email)    → GET /tasks/by-email
subjectService.getByEmail(email) → GET /subjects/by-email
```

**Métricas calculadas en el frontend:**

| Métrica | Fórmula |
|---------|---------|
| Progreso global % | `Math.round((done / total) * 100)` |
| Contadores por estado | Filtra `tasks` por `status` |
| Progreso por materia | Agrupa por `subject_id`, calcula % done |
| Próximas 5 entregas | Filtra no-done, ordena por `due_date`, toma las 5 primeras |
| Urgencia (color fecha) | `diffDays < 0` → rojo · `<= 2` → ámbar · resto → gris |

---

### 📍 MateriasPage — `/materias`

**Propósito:** CRUD de materias con selector de 12 colores.

```
Carga:  subjectService.getByEmail(email)        → GET /subjects/by-email
Crear:  subjectService.createByEmail({ name, color, user_email }) → POST /subjects/by-email
Editar: subjectService.update(id, { name, color }) → PATCH /subjects/{id}
Borrar: subjectService.delete(id)               → DELETE /subjects/{id}
```

**Paleta de colores disponibles:**
`#7c3aed` `#6366f1` `#3b82f6` `#06b6d4` `#10b981` `#f59e0b`
`#ef4444` `#ec4899` `#8b5cf6` `#14b8a6` `#f97316` `#84cc16`

---

## 🧩 Servicios — Endpoints consumidos

| Servicio | Función | Endpoint |
|----------|---------|----------|
| `authService` | `login()` | `POST /auth/login` |
| `authService` | `register()` | `POST /users/` |
| `authService` | `verifyToken()` | `GET /auth/me` |
| `taskService` | `getByEmail()` | `GET /tasks/by-email` |
| `taskService` | `getById()` | `GET /tasks/{id}` |
| `taskService` | `getHoy()` | `GET /tasks/hoy/prioridades` |
| `taskService` | `create()` | `POST /tasks/` |
| `taskService` | `update()` | `PATCH /tasks/{id}` |
| `taskService` | `delete()` | `DELETE /tasks/{id}` |
| `taskService` | `checkConflict()` *(Sprint 3)* | `POST /tasks/{id}/check-conflict` |
| `subtaskService` | `getByTask()` | `GET /subtasks/task/{taskId}` |
| `subtaskService` | `getById()` | `GET /subtasks/{id}` |
| `subtaskService` | `create()` | `POST /subtasks/` |
| `subtaskService` | `update()` | `PATCH /subtasks/{id}` |
| `subtaskService` | `delete()` | `DELETE /subtasks/{id}` |
| `subtaskService` | `checkConflict()` *(Sprint 3)* | `POST /subtasks/{id}/check-conflict` |
| `subtaskService` | `getWeekSummary()` *(Sprint 3)* | `GET /subtasks/week-summary` |
| `subtaskService` | `getDailyOverload()` | `GET /subtasks/daily-overload` |
| `subjectService` | `getByEmail()` | `GET /subjects/by-email` |
| `subjectService` | `getById()` | `GET /subjects/{id}` |
| `subjectService` | `createByEmail()` | `POST /subjects/by-email` |
| `subjectService` | `update()` | `PATCH /subjects/{id}` |
| `subjectService` | `delete()` | `DELETE /subjects/{id}` |

---

## 🗂️ Tipos TypeScript (`types/index.ts`)

| Tipo | Descripción |
|------|-------------|
| `User` | Datos del usuario autenticado |
| `LoginCredentials` | `{ email, password }` para el login |
| `LoginResponse` | Respuesta con `access_token` + datos de sesión |
| `RegisterPayload` | Datos para registrar un nuevo usuario |
| `Subject` | Materia con `id`, `name`, `color`, `user_id` |
| `Task` | Tarea con `id`, `title`, `task_type`, `subject_id` (nullable), `status`, `priority`, `duration_minutes`, etc. |
| `TaskType` | `"examen" \| "quiz" \| "taller" \| "proyecto" \| "exposición" \| "otro"` |
| `TaskStatus` | `"pending" \| "in_progress" \| "done"` |
| `TaskPriority` | `"alta" \| "media" \| "baja"` |
| `TaskCreate` | Payload para crear tarea (`subject_id` y `task_type` opcionales) |
| `TaskUpdate` | Payload PATCH de tarea — `subject_id?: string \| null` (null limpia la materia) |
| `Subtask` | Paso con `status`, `postpone_note`, `target_date`, `estimated_minutes` |
| `SubtaskStatus` | `"pending" \| "done" \| "postponed"` |
| `SubtaskCreate` | Payload para crear paso |
| `SubtaskUpdate` | Payload PATCH de paso |
| `HoySubtask` | Subtarea en la vista /hoy (estructura de respuesta del backend) |
| `HoyGroup` | `{ date, overdue, for_today, upcoming }` — respuesta de /hoy/prioridades |
| `ConflictResult` | Resultado de `check-conflict`: `has_conflict`, horas actuales, total nuevo, límite, mensaje |
| `LoadingState` | `"idle" \| "loading" \| "success" \| "error"` |
| `STATUS_LABELS` | Mapa de estado → etiqueta en español |

---

## 🌍 Variables de entorno

| Variable | Descripción | Configurada en |
|----------|-------------|----------------|
| `VITE_API_URL` | URL del backend FastAPI | `.env.production` (Vercel) |

**Local:** No se necesita `.env` adicional. Fallback en `api.ts` usa `http://localhost:8000`.

> **Nota:** El archivo `.env.production` existe pero no se usa en el flujo local actual.

---

## 🚀 Cómo correr el proyecto localmente

```bash
# 1. Instalar dependencias
npm install

# 2. Servidor de desarrollo
npm run dev
# → http://localhost:5173

# 3. Build de producción
npm run build

# 4. Preview del build
npm run preview
```

---

## 📦 Dependencias principales

| Paquete | Versión | Uso |
|---------|---------|-----|
| `react` | ^19.2.0 | Framework UI |
| `react-dom` | ^19.2.0 | Renderizado en el navegador |
| `react-router-dom` | ^7.13.1 | Enrutamiento SPA |
| `axios` | ^1.13.6 | Cliente HTTP para la API REST |
| `vite` | ^7.3.1 | Bundler y servidor de desarrollo |
| `typescript` | ~5.9.3 | Tipado estático |
| `tailwindcss` | ^4.2.1 | Estilos utilitarios |
