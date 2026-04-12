/**
 * components/Layout.tsx — Shell principal de la aplicación.
 *
 * Renderiza la barra de navegación superior fija y el contenedor del contenido.
 * Todas las páginas protegidas (Hoy, Crear, Materias, Progreso, Actividad)
 * se renderizan dentro del <Outlet /> de este componente.
 *
 * Comportamiento:
 *   - Muestra el nombre del usuario en la barra (leído de localStorage via authService).
 *   - Resalta automáticamente el enlace activo con NavLink de React Router.
 *   - El botón "Salir" limpia la sesión de localStorage y redirige a /auth.
 *
 * NO hace peticiones al backend — solo lee la sesión local.
 *
 * Árbol de rutas donde aparece:
 *   App.tsx → ProtectedRoute → Layout → <Outlet /> (HoyPage | CrearPage | etc.)
 */

import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { authService } from "../services/authService";

export default function Layout() {
    const navigate = useNavigate();

    // Lee el nombre del usuario desde localStorage para mostrarlo en la barra
    const session = authService.getSession();

    /** Limpia la sesión de localStorage y redirige al login. */
    function handleLogout() {
        authService.clearSession();
        navigate("/auth");
    }

    // Ítems del menú principal — cada uno corresponde a una ruta protegida
    const navItems = [
        { to: "/hoy",         label: "Hoy",         icon: "☀️" },
        { to: "/crear",       label: "Crear",        icon: "✏️" },
        { to: "/actividades", label: "Actividades",  icon: "📋" },
        { to: "/materias",    label: "Materias",     icon: "📚" },
        { to: "/progreso",    label: "Progreso",     icon: "📊" },
    ];

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col">
            {/* Barra de navegación superior fija (sticky) */}
            <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
                <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">

                    {/* Logo + nombre de la app */}
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
                            <span className="text-sm">📚</span>
                        </div>
                        <span className="text-white font-semibold text-sm tracking-tight">Planificador</span>
                    </div>

                    {/* Menú de navegación — NavLink marca activo automáticamente */}
                    <nav className="flex items-center gap-1" role="navigation" aria-label="Navegación principal">
                        {navItems.map(({ to, label, icon }) => (
                            <NavLink
                                key={to}
                                to={to}
                                className={({ isActive }) =>
                                    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${isActive
                                        ? "bg-violet-600/20 text-violet-300"
                                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                                    }`
                                }
                            >
                                <span aria-hidden="true">{icon}</span>
                                <span className="hidden sm:inline">{label}</span>
                            </NavLink>
                        ))}
                    </nav>

                    {/* Nombre del usuario + botón de logout */}
                    <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-sm hidden sm:block">
                            {session?.first_name}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="text-slate-500 hover:text-slate-300 text-sm px-2 py-1 rounded-lg hover:bg-slate-800 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                            aria-label="Cerrar sesión"
                        >
                            Salir
                        </button>
                    </div>
                </div>
            </header>

            {/* Contenido principal — React Router renderiza aquí la página activa */}
            <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
                <Outlet />
            </main>
        </div>
    );
}
