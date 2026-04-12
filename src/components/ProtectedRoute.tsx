/**
 * components/ProtectedRoute.tsx — Guardia de rutas autenticadas.
 *
 * Envuelve cualquier componente de ruta que requiera sesión activa.
 * Si el usuario no está autenticado (no hay user_id en localStorage),
 * redirige automáticamente a /auth sin renderizar el contenido.
 *
 * Uso en App.tsx:
 *   <ProtectedRoute>
 *     <Layout />    ← Solo se renderiza si isAuthenticated() es true
 *   </ProtectedRoute>
 *
 * NO hace peticiones al backend — solo verifica localStorage.
 */

import { Navigate } from "react-router-dom";
import { authService } from "../services/authService";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    // Si no hay sesión, redirige a /auth (replace evita que quede en el historial)
    if (!authService.isAuthenticated()) {
        return <Navigate to="/auth" replace />;
    }
    return <>{children}</>;
}
