/**
 * pages/ActividadesPage.tsx — Lista de todas las actividades del usuario (ruta /actividades).
 *
 * Muestra todas las tareas con:
 *   - Filtros por estado: Todas / Pendiente / En progreso / Completadas
 *   - Ordenadas por prioridad (alta→baja) y luego por due_date
 *   - Click → /actividad/:id
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { taskService } from "../services/taskService";
import { subjectService } from "../services/subjectService";
import { authService } from "../services/authService";
import type { Task, Subject, TaskStatus, LoadingState } from "../types";

const FILTER_OPTIONS: { value: TaskStatus | "all"; label: string }[] = [
    { value: "all",         label: "Todas" },
    { value: "pending",     label: "Pendiente" },
    { value: "in_progress", label: "En progreso" },
    { value: "done",        label: "Completadas" },
];

const PRIORITY_ORDER: Record<string, number> = { alta: 0, media: 1, baja: 2 };

const PRIORITY_STYLES: Record<string, string> = {
    alta:  "bg-red-500/15 text-red-400 border border-red-500/30",
    media: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    baja:  "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
};

const STATUS_PILL: Record<string, string> = {
    pending:     "bg-slate-700/50 text-slate-400",
    in_progress: "bg-violet-600/20 text-violet-300",
    done:        "bg-emerald-600/20 text-emerald-400",
};

const STATUS_LABELS: Record<string, string> = {
    pending:     "Pendiente",
    in_progress: "En progreso",
    done:        "Completada",
};

const TASK_TYPE_ICONS: Record<string, string> = {
    examen: "📝", quiz: "❓", taller: "🔧",
    proyecto: "📁", "exposición": "🎤", otro: "📌",
};

export default function ActividadesPage() {
    const navigate = useNavigate();
    const session = authService.getSession();

    const [tasks,     setTasks]     = useState<Task[]>([]);
    const [subjects,  setSubjects]  = useState<Subject[]>([]);
    const [filter,    setFilter]    = useState<TaskStatus | "all">("all");
    const [loadState, setLoadState] = useState<LoadingState>("loading");
    const [errorMsg,  setErrorMsg]  = useState("");

    useEffect(() => {
        if (!session) { navigate("/auth"); return; }
        load();
    }, []);

    async function load() {
        if (!session) return;
        try {
            const [ts, ss] = await Promise.all([
                taskService.getByEmail(session.email),
                subjectService.getByEmail(session.email),
            ]);
            setTasks(ts);
            setSubjects(ss);
            setLoadState("success");
        } catch {
            setLoadState("error");
            setErrorMsg("No se pudieron cargar las actividades.");
        }
    }

    const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

    const filtered = [...tasks]
        .filter(t => filter === "all" || t.status === filter)
        .sort((a, b) => {
            const pa = PRIORITY_ORDER[a.priority ?? "baja"] ?? 2;
            const pb = PRIORITY_ORDER[b.priority ?? "baja"] ?? 2;
            if (pa !== pb) return pa - pb;
            const da = a.due_date ? new Date(a.due_date + "T00:00:00").getTime() : Infinity;
            const db = b.due_date ? new Date(b.due_date + "T00:00:00").getTime() : Infinity;
            return da - db;
        });

    const counts = {
        all:         tasks.length,
        pending:     tasks.filter(t => t.status === "pending").length,
        in_progress: tasks.filter(t => t.status === "in_progress").length,
        done:        tasks.filter(t => t.status === "done").length,
    };

    if (loadState === "loading") {
        return (
            <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
                <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (loadState === "error") {
        return (
            <div className="flex flex-col items-center py-24 gap-4" role="alert">
                <span className="text-4xl">⚠️</span>
                <p className="text-slate-300">{errorMsg}</p>
                <button onClick={load} className="bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-violet-500 transition">
                    Reintentar
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-10">
            {/* Encabezado */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-white text-2xl font-bold tracking-tight">Actividades</h1>
                    <p className="text-slate-400 text-sm mt-1">Todas tus tareas académicas</p>
                </div>
                <button
                    onClick={() => navigate("/crear")}
                    className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition shadow-lg shadow-violet-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                    + Nueva
                </button>
            </div>

            {/* Filtros de estado */}
            <div className="flex gap-2 flex-wrap">
                {FILTER_OPTIONS.map(({ value, label }) => (
                    <button
                        key={value}
                        onClick={() => setFilter(value)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                            filter === value
                                ? "bg-violet-600/20 text-violet-300 border-violet-500/40"
                                : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"
                        }`}
                    >
                        {label}
                        <span className="ml-1.5 text-slate-500">
                            {counts[value as keyof typeof counts]}
                        </span>
                    </button>
                ))}
            </div>

            {/* Lista vacía */}
            {filtered.length === 0 && (
                <div className="text-center py-16">
                    <span className="text-5xl">📋</span>
                    <p className="text-slate-300 font-semibold mt-4">
                        {filter === "all" ? "No tienes actividades aún" : "Sin actividades en esta categoría"}
                    </p>
                    {filter === "all" && (
                        <>
                            <p className="text-slate-500 text-sm mt-1">Crea tu primera actividad para organizar tu estudio.</p>
                            <button
                                onClick={() => navigate("/crear")}
                                className="mt-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold px-6 py-3 rounded-xl transition shadow-lg shadow-violet-500/20"
                            >
                                Crear actividad
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Lista de actividades */}
            <div className="space-y-2">
                {filtered.map(task => {
                    const subject = task.subject_id ? subjectMap[task.subject_id] : null;
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const due = task.due_date ? new Date(task.due_date + "T00:00:00") : null;
                    const diffDays = due ? Math.ceil((due.getTime() - today.getTime()) / 86400000) : null;
                    const isOverdue = diffDays !== null && diffDays < 0 && task.status !== "done";
                    const urgencyColor = isOverdue
                        ? "text-red-400"
                        : (diffDays !== null && diffDays <= 2 && task.status !== "done")
                            ? "text-amber-400"
                            : "text-slate-500";

                    return (
                        <button
                            key={task.id}
                            onClick={() => navigate(`/actividad/${task.id}`)}
                            className="w-full text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-2xl px-4 py-4 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 group"
                            aria-label={`Ver actividad: ${task.title}`}
                        >
                            <div className="flex items-start gap-3">
                                {/* Barra de color de materia */}
                                <div
                                    className="w-1 self-stretch rounded-full shrink-0"
                                    style={{ backgroundColor: subject?.color ?? "#475569" }}
                                />

                                <div className="flex-1 min-w-0">
                                    {/* Materia + tipo */}
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        {subject && (
                                            <span className="text-xs font-medium" style={{ color: subject.color }}>
                                                {subject.name}
                                            </span>
                                        )}
                                        {task.task_type && (
                                            <span className="text-xs text-slate-600">
                                                {TASK_TYPE_ICONS[task.task_type] ?? "🏷"} {task.task_type}
                                            </span>
                                        )}
                                    </div>

                                    {/* Título */}
                                    <p className={`text-sm font-medium group-hover:text-violet-200 transition-colors ${task.status === "done" ? "line-through text-slate-500" : "text-white"}`}>
                                        {task.title}
                                    </p>

                                    {/* Fecha y duración */}
                                    <div className="flex items-center gap-3 mt-1.5">
                                        {due && (
                                            <span className={`text-xs ${urgencyColor}`}>
                                                📅 {isOverdue
                                                    ? `Venció hace ${Math.abs(diffDays!)}d`
                                                    : diffDays === 0
                                                        ? "Hoy"
                                                        : task.due_date}
                                            </span>
                                        )}
                                        {task.duration_minutes && (
                                            <span className="text-xs text-slate-600">⏱ {task.duration_minutes}min</span>
                                        )}
                                    </div>
                                </div>

                                {/* Columna derecha: prioridad + estado */}
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                    {task.priority && (
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_STYLES[task.priority] ?? ""}`}>
                                            {task.priority}
                                        </span>
                                    )}
                                    {task.status && (
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_PILL[task.status] ?? ""}`}>
                                            {STATUS_LABELS[task.status]}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
