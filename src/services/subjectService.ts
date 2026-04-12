/**
 * services/subjectService.ts — Servicio de materias/asignaturas.
 *
 * Gestiona todas las operaciones CRUD sobre materias del usuario.
 * Usa las variantes "by-email" del backend para evitar pasar UUIDs
 * desde el frontend (el email se obtiene de localStorage via authService.getSession()).
 *
 * Endpoints que consume:
 *   GET    /subjects/by-email?user_email={email}  → Lista materias del usuario.
 *   GET    /subjects/{id}                         → Obtiene una materia por UUID.
 *   POST   /subjects/by-email                     → Crea materia (con email, no UUID).
 *   PATCH  /subjects/{id}                         → Actualiza nombre o color.
 *   DELETE /subjects/{id}                         → Elimina una materia.
 *
 * Usado en: CrearPage (selector de materia), MateriasPage (CRUD completo),
 *           ActividadPage (mostrar nombre/color de la materia de la tarea),
 *           ProgresoPage (stats por materia).
 */

import api from "./api";
import type { Subject, SubjectCreateByEmail } from "../types";

export const subjectService = {
    /**
     * Obtiene todas las materias del usuario identificado por email.
     * Llama a GET /subjects/by-email con user_email como query param.
     *
     * @param email - Email del usuario (de authService.getSession().email).
     * @returns Lista de materias del usuario.
     */
    async getByEmail(email: string): Promise<Subject[]> {
        const { data } = await api.get<Subject[]>("/subjects/by-email", {
            params: { user_email: email },
        });
        return data;
    },

    /**
     * Obtiene una materia específica por su UUID.
     * Llama a GET /subjects/{id}.
     * Usado en ActividadPage para mostrar el nombre y color de la materia.
     *
     * @param id - UUID de la materia.
     * @returns La materia encontrada.
     */
    async getById(id: string): Promise<Subject> {
        const { data } = await api.get<Subject>(`/subjects/${id}`);
        return data;
    },

    /**
     * Crea una nueva materia usando el email del usuario.
     * Llama a POST /subjects/by-email con nombre, color y user_email.
     * El backend busca el UUID del usuario internamente.
     *
     * @param payload - Nombre, color y email del usuario.
     * @returns La materia creada con su UUID asignado.
     */
    async createByEmail(payload: SubjectCreateByEmail): Promise<Subject> {
        const { data } = await api.post<Subject>("/subjects/by-email", payload);
        return data;
    },

    /**
     * Actualiza el nombre o color de una materia (PATCH parcial).
     * Llama a PATCH /subjects/{id} con solo los campos a cambiar.
     *
     * @param id - UUID de la materia.
     * @param payload - Campos a actualizar: name y/o color.
     * @returns La materia actualizada.
     */
    async update(id: string, payload: { name?: string; color?: string }): Promise<Subject> {
        const { data } = await api.patch<Subject>(`/subjects/${id}`, payload);
        return data;
    },

    /**
     * Elimina una materia por su UUID.
     * Llama a DELETE /subjects/{id}.
     * Usado en MateriasPage con confirmación previa del usuario.
     *
     * @param id - UUID de la materia a eliminar.
     */
    async delete(id: string): Promise<void> {
        await api.delete(`/subjects/${id}`);
    },
};