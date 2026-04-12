/**
 * services/authService.ts — Servicio de autenticación y gestión de sesión.
 *
 * Sprint 2: Actualizado para manejar JWT.
 * - login() ahora guarda el access_token en localStorage
 * - saveSession() persiste el token junto a los datos de usuario
 * - clearSession() limpia también el token
 * - isAuthenticated() verifica existencia del token
 *
 * Endpoints que consume:
 *   POST /auth/login  → Verifica credenciales con bcrypt, devuelve JWT + datos.
 *   POST /users/      → Registra un nuevo usuario (contraseña hasheada en BE).
 *   GET  /auth/me     → Verifica que el token sigue siendo válido.
 *
 * Claves de localStorage:
 *   token           → JWT Bearer token (nuevo Sprint 2)
 *   user_id         → UUID del usuario autenticado
 *   user_email      → Email (usado por taskService, subjectService)
 *   user_first_name → Nombre para mostrar en Layout y HoyPage
 *   user_last_name  → Apellido
 */

import api from "./api";
import type { LoginCredentials, LoginResponse, RegisterPayload, User } from "../types";

export const authService = {
    /**
     * Inicia sesión con email y contraseña.
     * Sprint 2: El backend verifica bcrypt y retorna un JWT.
     *
     * @param credentials - Email y contraseña del usuario.
     * @returns LoginResponse con access_token, user_id, email, first_name, last_name.
     * @throws AxiosError 401 si las credenciales son inválidas.
     */
    async login(credentials: LoginCredentials): Promise<LoginResponse> {
        const { data } = await api.post<LoginResponse>("/auth/login", credentials);
        // Guardar sesión inmediatamente después del login
        authService.saveSession(data);
        return data;
    },

    /**
     * Registra un nuevo usuario en el sistema.
     * Sprint 2: El backend hashea la contraseña con bcrypt antes de guardar.
     *
     * @param payload - Datos del nuevo usuario.
     * @returns User creado (sin contraseña).
     */
    async register(payload: RegisterPayload): Promise<User> {
        const { data } = await api.post<User>("/users/", payload);
        return data;
    },

    /**
     * Verifica que el token JWT almacenado sigue siendo válido.
     * Llama a GET /auth/me — si responde 401, el interceptor de api.ts
     * limpia la sesión y redirige a /auth automáticamente.
     *
     * @returns true si el token es válido, false si no hay token.
     */
    async verifyToken(): Promise<boolean> {
        const token = localStorage.getItem("token");
        if (!token) return false;
        try {
            await api.get("/auth/me");
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Persiste la sesión del usuario en localStorage.
     * Sprint 2: también guarda el access_token JWT.
     *
     * @param user - Datos de sesión devueltos por el backend.
     */
    saveSession(user: LoginResponse) {
        if (user.access_token) {
            localStorage.setItem("token", user.access_token);
        }
        localStorage.setItem("user_id", user.user_id);
        localStorage.setItem("user_email", user.email);
        localStorage.setItem("user_first_name", user.first_name);
        localStorage.setItem("user_last_name", user.last_name);
    },

    /**
     * Lee la sesión actual desde localStorage.
     *
     * @returns LoginResponse con los datos de sesión, o null si no hay sesión.
     */
    getSession(): LoginResponse | null {
        const user_id = localStorage.getItem("user_id");
        const email = localStorage.getItem("user_email");
        const first_name = localStorage.getItem("user_first_name");
        const last_name = localStorage.getItem("user_last_name");
        const access_token = localStorage.getItem("token") ?? "";
        if (!user_id || !email) return null;
        return {
            access_token,
            user_id,
            email,
            first_name: first_name ?? "",
            last_name: last_name ?? "",
        };
    },

    /**
     * Elimina todos los datos de sesión del localStorage (logout).
     * Sprint 2: también elimina el token JWT.
     */
    clearSession() {
        ["token", "user_id", "user_email", "user_first_name", "user_last_name"]
            .forEach((k) => localStorage.removeItem(k));
    },

    /**
     * Verifica si hay una sesión activa comprobando el token JWT.
     * Usado por ProtectedRoute para decidir si redirigir a /auth.
     *
     * @returns true si hay token en localStorage, false si no.
     */
    isAuthenticated(): boolean {
        return !!localStorage.getItem("token");
    },
};