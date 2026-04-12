/**
 * pages/ProgresoPage.tsx — Dashboard de progreso académico (ruta /progreso).
 * Sprint 4: contador de pospuestas agregado.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { taskService } from "../services/taskService";
import { subjectService } from "../services/subjectService";
import { authService } from "../services/authService";
import type { Task, Subject, HoyGroup, LoadingState } from "../types";

interface SubjectStats {
    subject: Subject;
    total: number;
    done: number;
}

export default function ProgresoPage() {
    const navigate = useNavigate();
    const session = authService.getSession();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [hoyGroup, setHoyGroup] = useState<HoyGroup | null>(null);
    const [loadState, setLoadState] = useState<LoadingState>("loading");
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        if (!session) { navigate("/auth"); return; }
        load();
    }, []);

    async function load() {
        if (!session) return;
        try {
            const [ts, ss, hoy] = await Promise.all([
                taskService.getByEmail(session.email),
                subjectService.getByEmail(session.email),
                taskService.getHoy(session.email),
            ]);
            setTasks(ts);
            setSubjects(ss);
            setHoyGroup(hoy);
            setLoadState("success");
        } catch {
            setLoadState("error");
            setErrorMsg("No se pudo cargar el progreso.");
        }
    }

    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const pending = tasks.filter((t) => t.status === "pending").length;
    const postponed = tasks.filter((t) => (t.status as string) === "postponed").length;
    const globalPct = total > 0 ? Math.round((done / total) * 100) : 0;

    const subjectStats: SubjectStats[] = subjects.map((s) => {
        const subs = tasks.filter((t) => t.subject_id === s.id);
        return {
            subject: s,
            total: subs.length,
            done: subs.filter((t) => t.status === "done").length,
        };
    }).filter((s) => s.total > 0);

    const upcoming = [...tasks]
        .filter((t) => t.status !== "done")
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        .slice(0, 5);

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
                <button onClick={load} className="bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-violet-500 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                    Reintentar
                </button>
            </div>
        );
    }

    if (total === 0) {
        return (
            <div className="flex flex-col items-center py-24 gap-4 text-center">
                <span className="text-5xl">📈</span>
                <p className="text-slate-300 font-semibold">Aún no hay datos de progreso</p>
                <p className="text-slate-500 text-sm">Crea actividades para ver tus estadísticas aquí.</p>
                <button onClick={() => navigate("/crear")} className="bg-violet-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-violet-500 transition shadow-lg shadow-violet-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                    Crear actividad
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10">
            <div>
                <h1 className="text-white text-2xl font-bold tracking-tight">Progreso</h1>
                <p className="text-slate-400 text-sm mt-1">Resumen de todas tus actividades</p>
            </div>

            {/* ── Pasos del día (subtareas agrupadas) ── */}
            {hoyGroup && (
                <section aria-labelledby="pasos-heading">
                    <h2 id="pasos-heading" className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">
                        Pasos del día
                    </h2>
                    {(() => {
                        const allSteps = [
                            ...( hoyGroup.overdue ?? []).map(s => ({ ...s, _group: "overdue" as const })),
                            ...(hoyGroup.for_today ?? []).map(s => ({ ...s, _group: "today" as const })),
                            ...(hoyGroup.upcoming ?? []).map(s => ({ ...s, _group: "upcoming" as const })),
                        ];
                        if (allSteps.length === 0) {
                            return <p className="text-slate-600 text-sm italic">No hay pasos registrados aún.</p>;
                        }
                        const groupLabel: Record<string, string> = {
                            overdue: "Vencido",
                            today: "Hoy",
                            upcoming: "Próximo",
                        };
                        const groupColor: Record<string, string> = {
                            overdue: "text-red-400 border-red-500/30 bg-red-500/10",
                            today: "text-violet-300 border-violet-500/30 bg-violet-500/10",
                            upcoming: "text-slate-400 border-slate-700 bg-slate-800/50",
                        };
                        return (
                            <div className="space-y-2">
                                {allSteps.map(step => (
                                    <div key={step.id}
                                        className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium ${step.status === "done" ? "line-through text-slate-500" : "text-white"}`}>
                                                {step.title}
                                            </p>
                                            {step.description && (
                                                <p className="text-xs text-slate-500 mt-0.5 truncate">{step.description}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {step.estimated_minutes && (
                                                <span className="text-xs text-slate-600">⏱ {step.estimated_minutes}min</span>
                                            )}
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${groupColor[step._group]}`}>
                                                {groupLabel[step._group]}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </section>
            )}

            {/* Progreso global */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-white font-semibold">Progreso global</h2>
                    <span className="text-violet-400 font-bold text-2xl">{globalPct}%</span>
                </div>
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-700 rounded-full"
                        style={{ width: `${globalPct}%` }}
                        role="progressbar" aria-valuenow={globalPct} aria-valuemin={0} aria-valuemax={100}
                    />
                </div>
                {/* Contadores por estado — Sprint 4: agrega Pospuestas */}
                <div className="grid grid-cols-4 gap-3 pt-1">
                    {[
                        { label: "Completadas", value: done, color: "text-emerald-400" },
                        { label: "En progreso", value: inProgress, color: "text-violet-400" },
                        { label: "Pendientes", value: pending, color: "text-slate-400" },
                        { label: "Pospuestas", value: postponed, color: "text-amber-400" },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="text-center">
                            <span className={`text-2xl font-bold ${color}`}>{value}</span>
                            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Progreso por materia */}
            {subjectStats.length > 0 && (
                <section aria-labelledby="materias-heading">
                    <h2 id="materias-heading" className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">
                        Por materia
                    </h2>
                    <div className="space-y-3">
                        {subjectStats.map(({ subject, total: t, done: d }) => {
                            const pct = t > 0 ? Math.round((d / t) * 100) : 0;
                            return (
                                <div key={subject.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: subject.color }} />
                                            <span className="text-white text-sm font-medium">{subject.name}</span>
                                        </div>
                                        <span className="text-xs text-slate-500">{d}/{t} completadas</span>
                                    </div>
                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-500"
                                            style={{ width: `${pct}%`, backgroundColor: subject.color }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Próximas entregas */}
            {upcoming.length > 0 && (
                <section aria-labelledby="proximas-heading">
                    <h2 id="proximas-heading" className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">
                        Próximas entregas
                    </h2>
                    <div className="space-y-2">
                        {upcoming.map((task) => {
                            const sub = subjects.find((s) => s.id === task.subject_id);
                            const today = new Date(); today.setHours(0, 0, 0, 0);
                            const due = new Date(task.due_date + "T00:00:00");
                            const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            const urgency = diffDays < 0 ? "text-red-400" : diffDays <= 2 ? "text-amber-400" : "text-slate-500";
                            return (
                                <button key={task.id} onClick={() => navigate(`/actividad/${task.id}`)}
                                    className="w-full text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                                >
                                    <div className="flex-1 min-w-0">
                                        {sub && <span className="text-xs" style={{ color: sub.color }}>{sub.name} · </span>}
                                        <span className="text-white text-sm font-medium">{task.title}</span>
                                    </div>
                                    <span className={`text-xs font-medium shrink-0 ${urgency}`}>
                                        {diffDays < 0 ? `Hace ${Math.abs(diffDays)}d` : diffDays === 0 ? "Hoy" : `En ${diffDays}d`}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
}