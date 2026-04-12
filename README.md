# 📚 Planificador de Estudio — Frontend

> Aplicación web para gestionar tareas académicas, materias y planificación diaria de estudio.

**Stack:** React 19 · TypeScript · Vite · TailwindCSS v4 · React Router v7 · Axios  
**Deploy:** [planificador-personal-front.vercel.app](https://planificador-personal-front.vercel.app)  
**Backend:** [planificador-personal-back.onrender.com](https://planificador-personal-back.onrender.com)

---

## 🚀 Funcionalidades

- 🔐 **Autenticación con JWT** — Login y registro de usuarios con tokens firmados (7 días de sesión)
- 📅 **Vista diaria `/hoy`** — Subtareas priorizadas: vencidas → hoy → próximas, con badge de exceso de horas
- ➕ **Crear actividades `/crear`** — Formulario completo: título, tipo, materia (opcional), fecha, duración, prioridad y pasos
- 🗂️ **Detalle de actividad `/actividad/:id`** — Edición inline, CRUD completo de pasos (marcar, posponer, reprogramar, editar, eliminar)
- 📋 **Lista de actividades `/actividades`** — Vista global con filtros por estado (pendiente / en progreso / completada)
- 📊 **Progreso `/progreso`** — Dashboard estadístico por materia y entregas próximas
- 🎨 **Materias `/materias`** — CRUD con paleta de 12 colores personalizables
- ⚡ **Detección de conflictos** — Alerta cuando una tarea o paso supera el límite diario de horas configurado

---

## 🗂️ Estructura del proyecto

```
src/
├── pages/
│   ├── AuthPage.tsx        → /auth          — Login y registro
│   ├── HoyPage.tsx         → /hoy           — Vista diaria de subtareas priorizadas
│   ├── CrearPage.tsx       → /crear         — Crear tarea + pasos
│   ├── ActividadPage.tsx   → /actividad/:id — Detalle y edición completa
│   ├── ActividadesPage.tsx → /actividades   — Lista global con filtros
│   ├── ProgresoPage.tsx    → /progreso      — Dashboard estadístico
│   └── MateriasPage.tsx    → /materias      — CRUD de materias
├── components/
│   ├── Layout.tsx          → Shell: navbar + outlet
│   ├── ProtectedRoute.tsx  → Guard de rutas (requiere JWT)
│   └── TaskCard.tsx        → Tarjeta visual de tarea
├── services/
│   ├── api.ts              → Axios con baseURL + interceptores JWT
│   ├── authService.ts      → Login, registro, manejo de sesión
│   ├── taskService.ts      → CRUD tareas + checkConflict
│   ├── subtaskService.ts   → CRUD pasos + checkConflict + weekSummary
│   └── subjectService.ts   → CRUD materias
└── types/
    └── index.ts            → Interfaces TypeScript: User, Task, Subject, Subtask, etc.
```

---

## ⚙️ Setup local

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm run dev
# → http://localhost:5173

# 3. (Opcional) Build de producción
npm run build
```

> El frontend en local apunta a `http://localhost:8000` por defecto. Para usar el backend de Render, crea un archivo `.env.local` con:
> ```
> VITE_API_URL=https://planificador-personal-back.onrender.com
> ```

---

## 🌐 Deploy en Vercel

1. Conectar este repositorio a Vercel (Framework: **Vite**)
2. En **Settings → Environment Variables**, agregar:

| Variable | Valor |
|----------|-------|
| `VITE_API_URL` | `https://planificador-personal-back.onrender.com` |

3. Build command: `npm run build` · Output dir: `dist`

---

## 📦 Dependencias principales

| Paquete | Versión | Uso |
|---------|---------|-----|
| `react` | ^19.2.0 | Framework UI |
| `react-router-dom` | ^7.13.1 | Enrutamiento SPA |
| `axios` | ^1.13.6 | Cliente HTTP |
| `tailwindcss` | ^4.2.1 | Estilos |
| `typescript` | ~5.9.3 | Tipado estático |
| `vite` | ^7.3.1 | Bundler |

---

## 📖 Documentación adicional

Ver [`ARCHITECTURE.md`](./ARCHITECTURE.md) para la arquitectura detallada, flujos de datos y documentación de componentes.