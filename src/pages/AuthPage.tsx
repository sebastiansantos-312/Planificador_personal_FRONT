/**
 * pages/AuthPage.tsx — Página de autenticación (login y registro).
 *
 * Página pública accesible en /auth. Permite al usuario iniciar sesión
 * o crear una cuenta nueva. Incluye un hint con credenciales demo.
 *
 * Flujo LOGIN:
 *   1. Usuario ingresa email y contraseña.
 *   2. authService.login() → POST /auth/login → Backend verifica credenciales.
 *   3. authService.saveSession() guarda user_id, email, nombre en localStorage.
 *   4. Redirige a /hoy.
 *
 * Flujo REGISTRO:
 *   1. Usuario completa nombre, apellido, email, contraseña (y opcionalmente fecha nacimiento).
 *   2. authService.register() → POST /users/ → Backend crea el usuario.
 *   3. Auto-login: authService.login() con las mismas credenciales.
 *   4. authService.saveSession() y redirige a /hoy.
 *
 * Peticiones al backend:
 *   POST /auth/login  (login)
 *   POST /users/      (registro)
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import type { LoadingState } from "../types";

type AuthMode = "login" | "register";

export default function AuthPage() {
    const navigate = useNavigate();
    const [mode, setMode] = useState<AuthMode>("login");
    const [state, setState] = useState<LoadingState>("idle");
    const [error, setError] = useState("");

    // Campos compartidos login/registro
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // Campos solo para registro
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [birthDate, setBirthDate] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    /** Maneja el envío del formulario para login o registro según el modo activo. */
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");

        // Validación de campos vacíos antes de llamar al backend
        if (!email.trim() || !password.trim()) {
            setError("Por favor completa todos los campos.");
            setState("error");
            return;
        }
        if (mode === "register" && (!firstName.trim() || !lastName.trim())) {
            setError("Por favor completa nombre y apellido.");
            setState("error");
            return;
        }

        // Validacion de formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            setError("Por favor ingresa un correo electronico valido.");
            setState("error");
            return;
        }

        // Validación de confirmación de contraseña
        if (mode === "register" && password !== confirmPassword) {
            setError("Las contraseñas no coinciden.");
            setState("error");
            return;
        }

        setState("loading");

        try {
            if (mode === "login") {
                // Login: POST /auth/login
                const user = await authService.login({ email, password });
                authService.saveSession(user);
                setState("success");
                navigate("/hoy");
            } else {
                // Registro: POST /users/, luego auto-login
                await authService.register({
                    first_name: firstName,
                    last_name: lastName,
                    email,
                    password,
                    birth_date: birthDate || undefined,
                });
                const user = await authService.login({ email, password });
                authService.saveSession(user);
                setState("success");
                navigate("/hoy");
            }
        } catch (err: unknown) {
            setState("error");
            // Extrae el mensaje de error del backend si está disponible
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
                "Ocurrió un error. Intenta de nuevo.";
            setError(typeof msg === "string" ? msg : JSON.stringify(msg));
        }
    }

    const isLoading = state === "loading";

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            {/* Decoración de fondo con gradientes difuminados */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo y tagline */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 mb-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30">
                            <span className="text-white text-lg">📚</span>
                        </div>
                        <span className="text-white font-bold text-xl tracking-tight">Planificador</span>
                    </div>
                    <p className="text-slate-400 text-sm">Organiza tu estudio. Alcanza tus metas.</p>
                </div>

                {/* Tarjeta principal */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
                    {/* Selector de modo: login / registro */}
                    <div className="flex bg-slate-800 rounded-xl p-1 mb-8">
                        {(["login", "register"] as AuthMode[]).map((m) => (
                            <button
                                key={m}
                                onClick={() => { setMode(m); setError(""); }}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${mode === m
                                    ? "bg-violet-600 text-white shadow-md shadow-violet-500/20"
                                    : "text-slate-400 hover:text-slate-200"
                                    }`}
                            >
                                {m === "login" ? "Iniciar sesión" : "Registrarse"}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                        {/* Campos adicionales solo en modo registro */}
                        {mode === "register" && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label htmlFor="firstName" className="block text-sm font-medium text-slate-300 mb-1.5">
                                            Nombre
                                        </label>
                                        <input id="firstName" type="text" required value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)} placeholder="Ana"
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="lastName" className="block text-sm font-medium text-slate-300 mb-1.5">
                                            Apellido
                                        </label>
                                        <input id="lastName" type="text" required value={lastName}
                                            onChange={(e) => setLastName(e.target.value)} placeholder="García"
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="birthDate" className="block text-sm font-medium text-slate-300 mb-1.5">
                                        Fecha de nacimiento <span className="text-slate-500">(opcional)</span>
                                    </label>
                                    <input id="birthDate" type="date" value={birthDate}
                                        onChange={(e) => setBirthDate(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                                    />
                                </div>
                            </>
                        )}

                        {/* Campos compartidos */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                                Correo electrónico
                            </label>
                            <input id="email" type="email" required value={email}
                                onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
                                Contraseña
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 pr-11 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-3 inset-y-0 my-auto h-fit text-slate-500 hover:text-slate-300 transition focus:outline-none"
                                    aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                                >
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.114-3.582m2.93-2.527A9.956 9.956 0 0112 5c4.478 0 8.268 2.943 9.542 7a9.973 9.973 0 01-1.84 3.169M15 12a3 3 0 11-6 0 3 3 0 016 0zM3 3l18 18" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            {mode === "register" && (
                                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                    Recomendado: mínimo 8 caracteres, combina letras, números y algún símbolo como @, #, !
                                </p>
                            )}
                        </div>

                        {/* Confirmar contraseña — solo en registro */}
                        {mode === "register" && (
                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-1.5">
                                    Confirmar contraseña
                                </label>
                                <div className="relative">
                                    <input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? "text" : "password"}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className={`w-full bg-slate-800 border rounded-xl px-3.5 py-2.5 pr-11 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition
                                            ${
                                                confirmPassword && password !== confirmPassword
                                                    ? "border-red-500/60 focus:ring-red-500"
                                                    : confirmPassword && password === confirmPassword
                                                        ? "border-emerald-500/60 focus:ring-emerald-500"
                                                        : "border-slate-700 focus:ring-violet-500"
                                            }`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword((v) => !v)}
                                        className="absolute right-3 inset-y-0 my-auto h-fit text-slate-500 hover:text-slate-300 transition focus:outline-none"
                                        aria-label={showConfirmPassword ? "Ocultar" : "Ver contraseña"}
                                    >
                                        {showConfirmPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.114-3.582m2.93-2.527A9.956 9.956 0 0112 5c4.478 0 8.268 2.943 9.542 7a9.973 9.973 0 01-1.84 3.169M15 12a3 3 0 11-6 0 3 3 0 016 0zM3 3l18 18" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                {/* Feedback en tiempo real */}
                                {confirmPassword && (
                                    <p className={`text-xs mt-1.5 font-medium ${
                                        password === confirmPassword ? "text-emerald-400" : "text-red-400"
                                    }`}>
                                        {password === confirmPassword ? "✅ Las contraseñas coinciden" : "❌ Las contraseñas no coinciden"}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Mensaje de error del backend */}
                        {state === "error" && (
                            <div role="alert" className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={
                                isLoading ||
                                !email.trim() ||
                                !password.trim() ||
                                (mode === "register" && (!firstName.trim() || !lastName.trim())) ||
                                (mode === "register" && password !== confirmPassword)
                            }
                            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg shadow-violet-500/20 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-900 mt-2"
                        >
                            {isLoading ? "Cargando..." : mode === "login" ? "Ingresar" : "Crear cuenta"}
                        </button>
                    </form>

                    {/* Credenciales demo para facilitar pruebas */}
                    {mode === "login" && (
                        <p className="text-center text-slate-500 text-xs mt-5">
                            Demo: <span className="text-slate-400">jose@gmail.com</span> / <span className="text-slate-400">123456</span>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
