/**
 * App.tsx — Raíz de la aplicación y configuración de rutas.
 *
 * Define el árbol de rutas con React Router v6. Las rutas protegidas
 * se anidan dentro de ProtectedRoute → Layout, de modo que todas comparten
 * la barra de navegación y redirigen al login si no hay sesión activa.
 *
 * Árbol de rutas:
 *
 *   /auth                → AuthPage (login y registro — pública)
 *   /                    → ProtectedRoute → Layout
 *     index              →   Redirige a /hoy
 *     /hoy               →   HoyPage     — Vista diaria de subtareas priorizadas
 *     /crear             →   CrearPage   — Formulario nueva tarea + subtareas
 *     /actividad/:id     →   ActividadPage — Detalle de tarea, cambiar estado, marcar pasos
 *     /progreso          →   ProgresoPage — Estadísticas globales y por materia
 *     /materias          →   MateriasPage — CRUD de materias con selector de color
 *   /*                   → Fallback: redirige a /hoy si autenticado, o a /auth si no.
 *
 * La verificación de sesión la hace ProtectedRoute consultando localStorage.
 * No se hacen peticiones al backend desde este componente.
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { authService } from "./services/authService";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthPage from "./pages/AuthPage";
import HoyPage from "./pages/HoyPage";
import CrearPage from "./pages/CrearPage";
import ActividadPage from "./pages/ActividadPage";
import ActividadesPage from "./pages/ActividadesPage";
import ProgresoPage from "./pages/ProgresoPage";
import MateriasPage from "./pages/MateriasPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública — login y registro */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Shell protegido — todas las rutas hijas comparten Layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {/* Índice redirige a /hoy */}
          <Route index element={<Navigate to="/hoy" replace />} />

          {/* Vista diaria priorizada (US-04) */}
          <Route path="hoy" element={<HoyPage />} />

          {/* Criar nueva tarea con pasos */}
          <Route path="crear" element={<CrearPage />} />

          {/* Detalle de tarea — :id es el UUID de la tarea */}
          <Route path="actividad/:id" element={<ActividadPage />} />

          {/* Lista de todas las actividades */}
          <Route path="actividades" element={<ActividadesPage />} />

          {/* Progreso global y por materia */}
          <Route path="progreso" element={<ProgresoPage />} />

          {/* CRUD de materias */}
          <Route path="materias" element={<MateriasPage />} />
        </Route>

        {/* Fallback — cualquier ruta desconocida */}
        <Route
          path="*"
          element={
            authService.isAuthenticated() ? (
              <Navigate to="/hoy" replace />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
