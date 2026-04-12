/**
 * services/taskService.ts — Servicio de tareas académicas.
 *
 * Gestiona operaciones CRUD sobre tareas y la vista diaria priorizada.
 * Usa el email del usuario (de localStorage) para identificar al propietario.
 *
 * Endpoints que consume:
 *   GET  /tasks/by-email?user_email={email}          → Lista tareas del usuario.
 *   GET  /tasks/{id}                                 → Obtiene una tarea por UUID.
 *   GET  /tasks/hoy/prioridades?user_email={email}   → Vista diaria (devuelve SUBTAREAS, no tareas).
 *   POST /tasks/                                     → Crea una tarea con user_id y subject_id.
 *   PATCH /tasks/{id}                                → Actualiza campos de una tarea.
 *   DELETE /tasks/{id}                               → Elimina una tarea.
 *
 * ⚠️ IMPORTANTE — getHoy():
 *   El endpoint /tasks/hoy/prioridades devuelve SUBTAREAS agrupadas, no tareas.
 *   Retorna { date, overdue, for_today, upcoming } donde cada grupo es HoySubtask[].
 *   La interfaz HoyGroup refleja esta estructura.
 *
 * Usado en: HoyPage (getHoy), ActividadPage (getById, update, delete),
 *           CrearPage (create), ProgresoPage (getByEmail).
 */

import api from "./api";
import type { Task, TaskCreate, TaskUpdate, HoyGroup } from "../types";

export const taskService = {
    /**
     * Obtiene todas las tareas del usuario identificado por email.
     * Llama a GET /tasks/by-email con user_email como query param.
     *
     * @param email - Email del usuario (de authService.getSession().email).
     * @returns Lista de tareas del usuario.
     */
    async getByEmail(email: string): Promise<Task[]> {
        const { data } = await api.get<Task[]>("/tasks/by-email", {
            params: { user_email: email },
        });
        return data;
    },

    /**
     * Obtiene una tarea específica por su UUID.
     * Llama a GET /tasks/{id}.
     * Usado en ActividadPage al navegar a /actividad/{id}.
     *
     * @param id - UUID de la tarea.
     * @returns La tarea encontrada.
     */
    async getById(id: string): Promise<Task> {
        const { data } = await api.get<Task>(`/tasks/${id}`);
        return data;
    },

    /**
     * Obtiene la vista diaria priorizada del usuario (US-04).
     * Llama a GET /tasks/hoy/prioridades con user_email como query param.
     *
     * El backend devuelve SUBTAREAS agrupadas en tres categorías ordenadas:
     *   - overdue:    Subtareas vencidas (target_date < hoy)
     *   - for_today:  Subtareas para hoy (target_date == hoy)
     *   - upcoming:   Subtareas próximas (target_date > hoy)
     *
     * @param email - Email del usuario.
     * @returns HoyGroup con subtareas agrupadas y fecha actual.
     */
    async getHoy(email: string): Promise<HoyGroup> {
        const { data } = await api.get<HoyGroup>("/tasks/hoy/prioridades", {
            params: { user_email: email },
        });
        return data;
    },

    /**
     * Crea una nueva tarea.
     * Llama a POST /tasks/ con todos los campos incluyendo user_id y subject_id.
     * Usado en CrearPage tras validar el formulario.
     * Después de crear la tarea, CrearPage crea las subtareas una por una.
     *
     * @param payload - Datos de la tarea (título, materia, fecha, duración, prioridad).
     * @returns La tarea creada con su UUID asignado.
     */
    async create(payload: TaskCreate): Promise<Task> {
        const { data } = await api.post<Task>("/tasks/", payload);
        return data;
    },

    /**
     * Actualiza una tarea parcialmente (PATCH).
     * Llama a PATCH /tasks/{id} con solo los campos a cambiar.
     * Usado principalmente en ActividadPage para cambiar el estado
     * (pending → in_progress → done).
     *
     * @param id - UUID de la tarea.
     * @param payload - Campos a actualizar.
     * @returns La tarea actualizada.
     */
    async update(id: string, payload: TaskUpdate): Promise<Task> {
        const { data } = await api.patch<Task>(`/tasks/${id}`, payload);
        return data;
    },

    /**
     * Elimina una tarea y todas sus subtareas.
     * Llama a DELETE /tasks/{id}.
     * Usado en ActividadPage con confirmación previa del usuario.
     * Redirige a /hoy tras la eliminación.
     *
     * @param id - UUID de la tarea a eliminar.
     */
    async delete(id: string): Promise<void> {
        await api.delete(`/tasks/${id}`);
    },

    /**
     * Verifica si la duración de una tarea en una fecha supera el límite diario.
     * Llama a POST /tasks/{taskId}/check-conflict con query params.
     *
     * Para una nueva tarea usa el UUID dummy "00000000-0000-0000-0000-000000000000".
     * Para edición usa el UUID real de la tarea, así se excluye del conteo.
     *
     * @param taskId          - UUID de la tarea (dummy al crear, real al editar).
     * @param dueDate         - Fecha límite "YYYY-MM-DD".
     * @param durationMinutes - Duración de la tarea en minutos.
     * @param userId          - UUID del usuario.
     * @returns ConflictResult con has_conflict, horas usadas y límite.
     */
    async checkConflict(
        taskId: string,
        dueDate: string,
        durationMinutes: number,
        userId: string,
    ): Promise<import("../types").ConflictResult> {
        const { data } = await api.post<import("../types").ConflictResult>(
            `/tasks/${taskId}/check-conflict`,
            null,
            {
                params: {
                    due_date: dueDate,
                    duration_minutes: durationMinutes,
                    user_id: userId,
                },
            }
        );
        return data;
    },
};