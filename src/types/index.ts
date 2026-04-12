/**
 * types/index.ts — Definiciones de tipos TypeScript del frontend.
 */


// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    birth_date?: string;
    created_at?: string;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface LoginResponse {
    access_token: string;
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
}

export interface RegisterPayload {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    birth_date?: string;
}

// ─── Subject ─────────────────────────────────────────────────────────────────

export interface Subject {
    id: string;
    name: string;
    color?: string;      // ← Fix M3: opcional — el backend puede devolver null
    user_id: string;
    created_at?: string;
}

export interface SubjectCreate {
    name: string;
    color: string;
    user_id: string;
}

export interface SubjectCreateByEmail {
    name: string;
    color: string;
    user_email: string;
}

// ─── Task ────────────────────────────────────────────────────────────────────

export type TaskPriority = "alta" | "media" | "baja";
export type TaskStatus = "pending" | "in_progress" | "done";

/** Tipos de actividad válidos — requerido por US-01. */
export type TaskType =                                            // ← NUEVO (US-01)
    | "examen"
    | "quiz"
    | "taller"
    | "proyecto"
    | "exposición"
    | "otro";

export interface Task {
    id: string;
    title: string;
    task_type?: TaskType;                                         // ← NUEVO (US-01)
    subject_id: string;
    user_id: string;
    due_date: string;
    duration_minutes: number;
    priority: TaskPriority;
    status: TaskStatus;
    created_at?: string;
}

export interface TaskCreate {
    title: string;
    task_type?: TaskType;                                         // ← NUEVO (US-01)
    subject_id?: string;                                          // opcional — no requiere materia
    user_id: string;
    due_date: string;
    duration_minutes: number;
    priority: TaskPriority;
    status?: TaskStatus;
}

export interface TaskUpdate {
    title?: string;
    task_type?: TaskType;
    subject_id?: string | null;   // null → limpia la materia en la BD
    due_date?: string;
    duration_minutes?: number;
    priority?: TaskPriority;
    status?: TaskStatus;
}

// ─── Subtask ─────────────────────────────────────────────────────────────────

export type SubtaskStatus = "pending" | "done" | "postponed";  
export interface Subtask {
    id: string;
    task_id: string;
    title: string;
    description?: string;
    target_date: string;
    estimated_minutes: number;
    status: SubtaskStatus;
    postpone_note?: string;  
    created_at?: string;
}

export interface SubtaskCreate {
    task_id: string;
    title: string;
    description?: string;
    target_date: string;
    estimated_minutes: number;
    status?: SubtaskStatus;
}

export interface SubtaskUpdate extends Partial<SubtaskCreate> {
    status?: SubtaskStatus;
    postpone_note?: string;                                       // ← agregar
    target_date?: string;
    estimated_minutes?: number;
}

// ─── Vista Hoy ───────────────────────────────────────────────────────────────

export interface HoySubtask {
    id: string;
    task_id: string;
    title: string;
    description?: string;
    target_date: string;
    estimated_minutes: number;
    status: string;
    postpone_note?: string;
    created_at?: string;
}

export interface HoyGroup {
    date: string;
    overdue: HoySubtask[];
    for_today: HoySubtask[];
    upcoming: HoySubtask[];
}

// ─── Conflict Check ──────────────────────────────────────────────────────────

export interface ConflictResult {
    has_conflict: boolean;
    current_minutes: number;
    new_total_minutes: number;
    limit_minutes: number;
    current_hours: number;
    new_total_hours: number;
    limit_hours: number;
    message: string;
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

export type LoadingState = "idle" | "loading" | "success" | "error";

export const STATUS_LABELS: Record<string, string> = {
    pending: "Pendiente",
    in_progress: "En progreso",
    done: "Completada",
    postponed: "Pospuesta",
};