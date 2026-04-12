# Planificador de Estudio — Frontend

Stack: React + TypeScript + Vite + Tailwind CSS v4 + React Router + Axios

## Estructura generada

```
src/
├── types/
│   └── index.ts          # Tipos TypeScript (User, Task, Subject, Subtask, etc.)
├── services/
│   ├── api.ts            # Instancia Axios base → Render backend
│   ├── authService.ts    # Login, register, session localStorage
│   ├── subjectService.ts # CRUD materias
│   ├── taskService.ts    # CRUD tareas + vista hoy
│   └── subtaskService.ts # CRUD subtareas + check-conflict
├── components/
│   ├── Layout.tsx        # Shell con nav principal
│   ├── ProtectedRoute.tsx
│   └── TaskCard.tsx      # Tarjeta reutilizable de tarea
├── pages/
│   ├── AuthPage.tsx      # Login + Registro (Sprint 1 sin JWT)
│   ├── HoyPage.tsx       # Vista del día: Vencidas → Hoy → Próximas
│   ├── CrearPage.tsx     # Crear tarea + subtareas
│   ├── ActividadPage.tsx # Detalle, cambiar estado, marcar subtareas
│   └── ProgresoPage.tsx  # Estadísticas globales y por materia
├── App.tsx               # React Router con rutas protegidas
├── main.tsx
└── index.css             # @import "tailwindcss" + overrides
```

## Rutas

| Ruta | Página |
|------|--------|
| `/auth` | Login / Registro |
| `/hoy` | Vista del día |
| `/crear` | Crear actividad |
| `/actividad/:id` | Detalle y edición |
| `/progreso` | Progreso general |

## Setup

```bash
# Instalar dependencias (si no están)
npm install react-router-dom axios

# Iniciar dev server
npm run dev
```

## Deploy Vercel

1. Conectar repo a Vercel
2. Framework: Vite
3. Build command: `npm run build`
4. Output dir: `dist`
5. Agregar en Settings → Environment Variables: ninguna necesaria (baseURL está hardcodeada)

> Para producción considera mover la baseURL a `VITE_API_URL` en `.env`

## Notas Sprint 1

- Sin JWT: sesión guardada en localStorage (`user_id`, `user_email`, etc.)
- Conflicto de sobrecarga: botón ⚡ en cada subtarea en `/actividad/:id`
- Usuario demo: `jose@gmail.com` / `123456`