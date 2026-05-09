/**
 * pages/ProgresoPage.tsx — Dashboard de progreso académico (ruta /progreso).
 * Sprint 4: porcentaje y contadores basados en actividades (tasks).
 *           Sección de entregas muestra hechas + pospuestas + pendientes.
 *           Sección de pasos (subtareas) va debajo de las entregas.
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { taskService } from "../services/taskService";
import { subjectService } from "../services/subjectService";
import { authService } from "../services/authService";
import type { Task, Subject, LoadingState } from "../types";

interface GlobalProgress {
    // Actividades
    tasks_total: number;
    tasks_done: number;
    tasks_postponed: number;
    tasks_pending: number;
    tasks_percent: number;
    // Subtareas (desglose interno)
    total_subtasks: number;
    done: number;
    postponed: number;
    pending: number;
    percent: number;
}

interface SubjectStats {
    subject: Subject;
    total: number;
    done: number;
}

// Badge de estado de actividad
function StatusBadge({ status }: { status: string }) {
    if (status === "done")
        return (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 shrink-0">
                Hecha
            </span>
        );
    if (status === "postponed")
        return (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 shrink-0">
                Pospuesta
            </span>
        );
    if (status === "in_progress")
        return (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 shrink-0">
                En progreso
            </span>
        );
    return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 shrink-0">
            Pendiente
        </span>
    );
}

export default function ProgresoPage() {
    const navigate = useNavigate();
    const session = authService.getSession();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [progress, setProgress] = useState<GlobalProgress | null>(null);
    const [loadState, setLoadState] = useState<LoadingState>("loading");
    const [errorMsg, setErrorMsg] = useState("");
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async (silent = false) => {
        if (!session) return;
        if (!silent) setLoadState("loading");
        else setRefreshing(true);
        try {
            const [ts, ss, prog] = await Promise.all([
                taskService.getByEmail(session.email),
                subjectService.getByEmail(session.email),
                taskService.getGlobalProgress(session.email),
            ]);
            setTasks(ts);
            setSubjects(ss);
            setProgress(prog);
            setLastUpdated(new Date());
            if (!silent) setLoadState("success");
        } catch {
            if (!silent) {
                setLoadState("error");
                setErrorMsg("No se pudo cargar el progreso. Verifica tu conexión.");
            }
        } finally {
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (!session) { navigate("/auth"); return; }
        load();

        function handleVisibility() {
            if (document.visibilityState === "visible") load(true);
        }
        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, []);

    // ── Entregas: todas las tareas con fecha de entrega, ordenadas por fecha ──
    const allDeliveries = [...tasks]
        .filter(t => t.due_date)
        .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());

    // Progreso por materia: basado en tasks (completadas vs total)
    const subjectStats: SubjectStats[] = subjects.map(s => {
        const subs = tasks.filter(t => t.subject_id === s.id);
        return {
            subject: s,
            total: subs.length,
            done: subs.filter(t => t.status === "done").length,
        };
    }).filter(s => s.total > 0);

    // ── Estados de carga ─────────────────────────────────────────────────────

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
                <p className="text-slate-300">{errorMsg}</p>
                <button
                    onClick={() => load()}
                    className="bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-violet-500 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                    Reintentar
                </button>
            </div>
        );
    }

    if (tasks.length === 0) {
        return (
            <div className="flex flex-col items-center py-24 gap-4 text-center">
                <span className="text-5xl">📊</span>
                <div>
                    <p className="text-slate-300 font-semibold">Aún sin datos de progreso</p>
                    <p className="text-slate-500 text-sm mt-1 max-w-xs">
                        Crea actividades y comienza a registrar tu avance académico.
                    </p>
                </div>
                <button
                    onClick={() => navigate("/crear")}
                    className="bg-violet-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-violet-500 transition shadow-lg shadow-violet-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                    Crear primera actividad
                </button>
            </div>
        );
    }

    const tasksPct = progress?.tasks_percent ?? 0;

    return (
        <div className="space-y-8 pb-10">
            {/* Encabezado + botón refrescar */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-white text-2xl font-bold tracking-tight">Progreso</h1>
                    <p className="text-slate-400 text-sm mt-1">Resumen de tus actividades académicas</p>
                </div>
                <button
                    onClick={() => load(true)}
                    disabled={refreshing}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 px-3 py-1.5 rounded-xl hover:bg-slate-800 transition disabled:opacity-40"
                    title="Actualizar datos"
                >
                    <span className={refreshing ? "animate-spin inline-block" : ""}>&#8635;</span>
                    {lastUpdated && !refreshing && (
                        <span className="text-slate-600">
                            {lastUpdated.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                    )}
                    {refreshing && <span>Actualizando...</span>}
                </button>
            </div>

            {/* ── Progreso global de ACTIVIDADES ── */}
            {progress && progress.tasks_total > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-white font-semibold">Actividades</h2>
                        <span className="text-violet-400 font-bold text-2xl">{tasksPct}%</span>
                    </div>

                    {/* Barra progreso actividades */}
                    <div className="space-y-1.5">
                        <div className="h-3 bg-slate-800 rounded-full overflow-hidden flex">
                            <div
                                className="h-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-700 rounded-l-full"
                                style={{ width: `${tasksPct}%` }}
                                role="progressbar"
                                aria-valuenow={tasksPct}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label="Progreso de actividades"
                            />
                            {progress.tasks_postponed > 0 && (
                                <div
                                    className="h-full bg-amber-500/60 transition-all duration-700"
                                    style={{ width: `${Math.round((progress.tasks_postponed / progress.tasks_total) * 100)}%` }}
                                />
                            )}
                        </div>
                        <p className="text-xs text-slate-600 text-right">{progress.tasks_total} actividades en total</p>
                    </div>

                    {/* Contadores por estado de actividades */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: "Completadas", value: progress.tasks_done, color: "text-emerald-400" },
                            { label: "Pospuestas", value: progress.tasks_postponed, color: "text-amber-400" },
                            { label: "Pendientes", value: progress.tasks_pending, color: "text-slate-400" },
                        ].map(({ label, value, color }) => (
                            <div key={label} className="text-center bg-slate-800/50 rounded-xl py-3">
                                <span className={`text-2xl font-bold ${color}`}>{value}</span>
                                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Progreso por materia ── */}
            {subjectStats.length > 0 && (
                <section aria-labelledby="materias-heading">
                    <h2
                        id="materias-heading"
                        className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3"
                    >
                        Por materia
                    </h2>
                    <div className="space-y-3">
                        {subjectStats.map(({ subject, total: t, done: d }) => {
                            const pct = t > 0 ? Math.round((d / t) * 100) : 0;
                            return (
                                <div key={subject.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: subject.color ?? "#6366f1" }} />
                                            <span className="text-white text-sm font-medium">{subject.name}</span>
                                        </div>
                                        <span className="text-xs text-slate-500">{d}/{t} completadas</span>
                                    </div>
                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{ width: `${pct}%`, backgroundColor: subject.color ?? "#6366f1" }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ── Entregas de actividades: hechas + pospuestas + pendientes ── */}
            {allDeliveries.length > 0 && (
                <section aria-labelledby="entregas-heading">
                    <h2
                        id="entregas-heading"
                        className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3"
                    >
                        Entregas
                    </h2>
                    <div className="space-y-2">
                        {allDeliveries.map(task => {
                            const sub = subjects.find(s => s.id === task.subject_id);
                            const today = new Date(); today.setHours(0, 0, 0, 0);
                            const due = new Date(task.due_date! + "T00:00:00");
                            const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                            // Color de fecha según urgencia y estado
                            let dateColor = "text-slate-500";
                            if (task.status === "done") dateColor = "text-emerald-500/70";
                            else if (task.status === "postponed") dateColor = "text-amber-500/70";
                            else if (diffDays < 0) dateColor = "text-red-400";
                            else if (diffDays <= 2) dateColor = "text-amber-400";

                            const dateLabel =
                                task.status === "done"
                                    ? due.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })
                                    : diffDays < 0
                                    ? `Hace ${Math.abs(diffDays)}d`
                                    : diffDays === 0
                                    ? "Hoy"
                                    : `En ${diffDays}d`;

                            return (
                                <button
                                    key={task.id}
                                    onClick={() => navigate(`/actividad/${task.id}`)}
                                    className="w-full text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                                >
                                    <div className="flex-1 min-w-0">
                                        {sub && <span className="text-xs" style={{ color: sub.color }}>{sub.name} · </span>}
                                        <span className="text-white text-sm font-medium">{task.title}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={`text-xs font-medium ${dateColor}`}>{dateLabel}</span>
                                        <StatusBadge status={task.status} />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ── Desglose de pasos (subtareas) ── */}
            {progress && progress.total_subtasks > 0 && (
                <section aria-labelledby="subtareas-heading">
                    <h2
                        id="subtareas-heading"
                        className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3"
                    >
                        Pasos (subtareas)
                    </h2>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                        {/* Barra de subtareas */}
                        <div className="space-y-1.5">
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                                <div
                                    className="h-full bg-emerald-500 transition-all duration-700"
                                    style={{ width: `${progress.percent}%` }}
                                />
                                {progress.postponed > 0 && (
                                    <div
                                        className="h-full bg-amber-500/60 transition-all duration-700"
                                        style={{ width: `${Math.round((progress.postponed / progress.total_subtasks) * 100)}%` }}
                                    />
                                )}
                            </div>
                            <div className="flex justify-between text-xs text-slate-600">
                                <span>{progress.total_subtasks} pasos en total</span>
                                <span>{progress.percent}% completados</span>
                            </div>
                        </div>

                        {/* Contadores subtareas */}
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: "Hechos", value: progress.done, color: "text-emerald-400" },
                                { label: "Pospuestos", value: progress.postponed, color: "text-amber-400" },
                                { label: "Pendientes", value: progress.pending, color: "text-slate-400" },
                            ].map(({ label, value, color }) => (
                                <div key={label} className="text-center bg-slate-800/50 rounded-xl py-3">
                                    <span className={`text-xl font-bold ${color}`}>{value}</span>
                                    <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}