/**
 * services/subtaskService.ts — Servicio de subtareas/pasos.
 *
 * Gestiona operaciones CRUD sobre los pasos dentro de una tarea,
 * y la verificación de sobrecarga diaria (US-07).
 *
 * Endpoints que consume:
 *   GET    /subtasks/task/{taskId}              → Lista subtareas de una tarea.
 *   GET    /subtasks/{id}                       → Obtiene una subtarea por UUID.
 *   POST   /subtasks/                           → Crea una subtarea.
 *   PATCH  /subtasks/{id}                       → Actualiza subtarea (fechas, estado).
 *   DELETE /subtasks/{id}                       → Elimina una subtarea.
 *   POST   /subtasks/{id}/check-conflict        → Verifica sobrecarga diaria (US-07).
 *
 * ⚠️ IMPORTANTE — checkConflict():
 *   El endpoint usa query params (NO body): target_date, estimated_minutes, user_id.
 *   Por eso se pasa null como body y los datos van en { params: {...} }.
 *
 * Usado en: ActividadPage (getByTask, update para marcar done, checkConflict),
 *           CrearPage (create, una llamada por cada subtarea del formulario).
 */

import api from "./api";
import type { Subtask, SubtaskCreate, SubtaskUpdate, ConflictResult } from "../types";

export const subtaskService = {
    /**
     * Obtiene todas las subtareas de una tarea específica.
     * Llama a GET /subtasks/task/{taskId}.
     * Usado en ActividadPage al cargar el detalle de una tarea.
     *
     * @param taskId - UUID de la tarea padre.
     * @returns Lista de subtareas/pasos de esa tarea.
     */
    async getByTask(taskId: string): Promise<Subtask[]> {
        const { data } = await api.get<Subtask[]>(`/subtasks/task/${taskId}`);
        return data;
    },

    /**
     * Obtiene una subtarea específica por su UUID.
     * Llama a GET /subtasks/{id}.
     *
     * @param id - UUID de la subtarea.
     * @returns La subtarea encontrada.
     */
    async getById(id: string): Promise<Subtask> {
        const { data } = await api.get<Subtask>(`/subtasks/${id}`);
        return data;
    },

    /**
     * Crea una nueva subtarea asociada a una tarea.
     * Llama a POST /subtasks/ con task_id, título, fecha objetivo y minutos estimados.
     * CrearPage la llama en un bucle por cada paso agregado al formulario.
     *
     * @param payload - Datos del paso (task_id, title, target_date, estimated_minutes).
     * @returns La subtarea creada con su UUID asignado.
     */
    async create(payload: SubtaskCreate): Promise<Subtask> {
        const { data } = await api.post<Subtask>("/subtasks/", payload);
        return data;
    },

    /**
     * Actualiza una subtarea parcialmente (PATCH).
     * Llama a PATCH /subtasks/{id} con solo los campos a cambiar.
     * Usado en ActividadPage para:
     *   - Marcar como completada/pendiente: { status: "done" | "pending" }
     *   - Reprogramar fecha: { target_date: "YYYY-MM-DD" }
     *
     * @param id - UUID de la subtarea.
     * @param payload - Campos a actualizar.
     * @returns La subtarea actualizada.
     */
    async update(id: string, payload: SubtaskUpdate): Promise<Subtask> {
        const { data } = await api.patch<Subtask>(`/subtasks/${id}`, payload);
        return data;
    },

    /**
     * Elimina una subtarea por su UUID.
     * Llama a DELETE /subtasks/{id}.
     *
     * @param id - UUID de la subtarea a eliminar.
     */
    async delete(id: string): Promise<void> {
        await api.delete(`/subtasks/${id}`);
    },

    /**
     * Verifica si agregar una subtarea a un día genera sobrecarga (US-07, T3).
     * Llama a POST /subtasks/{id}/check-conflict con parámetros como query params.
     *
     * El backend suma los minutos estimados de todas las subtareas pendientes
     * del usuario para target_date (excluyendo la subtarea actual) y evalúa
     * si supera el límite de 6 horas (360 min).
     *
     * Se dispara desde ActividadPage al pulsar el botón ⚡ de cada subtarea.
     * El resultado se muestra inline bajo la subtarea.
     *
     * @param subtaskId     - UUID de la subtarea a verificar (se excluye del conteo).
     * @param targetDate    - Fecha objetivo en formato ISO "YYYY-MM-DD".
     * @param estimatedMinutes - Minutos estimados de la subtarea.
     * @param userId        - UUID del usuario (de authService.getSession().user_id).
     * @returns ConflictResult con has_conflict, totales y mensaje legible.
     */
    async checkConflict(
        subtaskId: string,
        targetDate: string,
        estimatedMinutes: number,
        userId: string
    ): Promise<ConflictResult> {
        const { data } = await api.post<ConflictResult>(
            `/subtasks/${subtaskId}/check-conflict`,
            null,          // Sin body — los datos van como query params
            {
                params: {
                    target_date: targetDate,
                    estimated_minutes: estimatedMinutes,
                    user_id: userId,
                },
            }
        );
        return data;
    },

    /**
     * Obtiene el resumen de disponibilidad diaria para un rango de 7 días.
     * Llamado desde CrearPage y ActividadPage al seleccionar/cambiar la fecha
     * de una actividad, para mostrar qué días tienen horas disponibles.
     *
     * @param userId    - UUID del usuario.
     * @param fromDate  - Fecha inicio del rango "YYYY-MM-DD".
     * @param toDate    - Fecha fin del rango "YYYY-MM-DD".
     * @returns Lista de DaySummary, uno por día del rango.
     */
    async getWeekSummary(userId: string, fromDate: string, toDate: string): Promise<DaySummary[]> {
        const { data } = await api.get<DaySummary[]>("/subtasks/week-summary", {
            params: { user_id: userId, from_date: fromDate, to_date: toDate },
        });
        return data;
    },
};

export interface DaySummary {
    date: string;           // "YYYY-MM-DD"
    used_minutes: number;
    limit_minutes: number;
    free_minutes: number;
    over_limit: boolean;
}