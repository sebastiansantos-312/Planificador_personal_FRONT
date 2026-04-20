/**
 * pages/HoyPage.tsx — Vista diaria de actividades priorizadas (ruta /hoy).
 *
 * Sprint 3:
 *   - Panel de configuración de límite diario (⚙️ en cabecera).
 *   - Tarjetas expandibles: cada actividad muestra un footer con sus pasos.
 *   - Carga de subtareas lazy (solo cuando el usuario expande la tarjeta).
 *   - Indicador de carga del día vs. límite del usuario.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { taskService } from "../services/taskService";
import { subjectService } from "../services/subjectService";
import { subtaskService } from "../services/subtaskService";
import { authService } from "../services/authService";
import api from "../services/api";
import type { Task, Subject, Subtask, LoadingState, LimitPreviewResult, AffectedDay, TaskInDay, TaskToMove } from "../types";


const PRIORITY_ORDER: Record<string, number> = { alta: 0, media: 1, baja: 2 };

const PRIORITY_STYLES: Record<string, string> = {
    alta: "bg-red-500/15 text-red-400 border border-red-500/30",
    media: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    baja: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
};

const STATUS_STYLES: Record<string, string> = {
    pending: "bg-slate-700/50 text-slate-400",
    in_progress: "bg-violet-600/20 text-violet-300",
    done: "bg-emerald-600/20 text-emerald-400",
};

const STATUS_LABELS: Record<string, string> = {
    pending: "Pendiente",
    in_progress: "En progreso",
    done: "Completada",
};

const SUBTASK_STATUS_ICON: Record<string, string> = {
    done: "✅",
    postponed: "⏭",
    pending: "⬜",
};

const TASK_TYPE_ICONS: Record<string, string> = {
    examen: "📝", quiz: "❓", taller: "🔧",
    proyecto: "📁", "exposición": "🎤", otro: "📌",
};

function sortByPriority(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority ?? "baja"] ?? 2;
        const pb = PRIORITY_ORDER[b.priority ?? "baja"] ?? 2;
        if (pa !== pb) return pa - pb;
        const da = a.due_date ? new Date(a.due_date + "T00:00:00").getTime() : Infinity;
        const db = b.due_date ? new Date(b.due_date + "T00:00:00").getTime() : Infinity;
        return da - db;
    });
}

interface Section {
    key: string;
    label: string;
    items: Task[];
    badge?: string;
    badgeClass?: string;
    emptyMsg: string;
    accentColor: string;
    cardBorder: string;
}

export default function HoyPage() {
    const navigate = useNavigate();
    const session = authService.getSession();

    const [overdue, setOverdue] = useState<Task[]>([]);
    const [forToday, setForToday] = useState<Task[]>([]);
    const [upcoming, setUpcoming] = useState<Task[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loadState, setLoadState] = useState<LoadingState>("loading");
    const [errorMsg, setErrorMsg] = useState("");

    // Expansión de subtareas
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
    const [subtaskCache, setSubtaskCache] = useState<Record<string, Subtask[]>>({});
    const [loadingSubtasks, setLoadingSubtasks] = useState<string | null>(null);

    // Configuración de límite diario
    const [showConfig, setShowConfig] = useState(false);
    const [limitHours, setLimitHours] = useState(6);
    const [savingLimit, setSavingLimit] = useState(false);
    const [limitSaved, setLimitSaved] = useState(false);
    // Modal enriquecido de preview de límite
    const [limitPreview, setLimitPreview] = useState<LimitPreviewResult | null>(null);
    const [previewDayIdx, setPreviewDayIdx] = useState(0);
    // Opción A: checkboxes manuales
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
    // Opción C: comprimir duraciones (map task_id -> minutos editados)
    const [compressMap, setCompressMap] = useState<Record<string, number>>({});
    // Estado de ejecución de acciones
    const [applyingAction, setApplyingAction] = useState(false);
    // Secciones expandidas (alt combos, impacto preview)
    const [showAltCombos, setShowAltCombos] = useState(false);
    const [showImpact, setShowImpact] = useState(false);
    const configRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!session) { navigate("/auth"); return; }
        load();
        loadDailyLimit();
    }, []);

    // Cerrar config al hacer clic fuera
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (configRef.current && !configRef.current.contains(e.target as Node)) {
                setShowConfig(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    async function load() {
        if (!session) return;
        setLoadState("loading");
        try {
            const [tasks, subs] = await Promise.all([
                taskService.getByEmail(session.email),
                subjectService.getByEmail(session.email),
            ]);
            setSubjects(subs);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const active = tasks.filter(t => t.status !== "done");

            const od = active.filter(t => {
                if (!t.due_date) return false;
                return new Date(t.due_date + "T00:00:00") < today;
            });
            const ft = active.filter(t => {
                if (!t.due_date) return false;
                return new Date(t.due_date + "T00:00:00").getTime() === today.getTime();
            });
            const up = active.filter(t => {
                if (!t.due_date) return true;
                return new Date(t.due_date + "T00:00:00") > today;
            });

            setOverdue(sortByPriority(od));
            setForToday(sortByPriority(ft));
            setUpcoming(sortByPriority(up));
            setLoadState("success");
        } catch {
            setLoadState("error");
            setErrorMsg("No se pudo cargar la vista de hoy. Verifica tu conexión.");
        }
    }

    async function loadDailyLimit() {
        if (!session) return;
        try {
            const { data } = await api.get<{ daily_limit_minutes: number }>(
                `/users/${session.user_id}/config`
            );
            setLimitHours(Math.round((data.daily_limit_minutes ?? 360) / 60));
        } catch { /* usar default 6h */ }
    }

    async function saveDailyLimit() {
        if (!session) return;
        setSavingLimit(true);
        const newLimitMins = limitHours * 60;
        try {
            const { data } = await api.post<LimitPreviewResult>(
                `/users/${session.user_id}/config/preview`,
                null,
                { params: { new_limit_minutes: newLimitMins } }
            );
            setSavingLimit(false);
            if (data.affected_days.length > 0) {
                setLimitPreview(data);
                setPreviewDayIdx(0);
                setSelectedTaskIds(new Set());
                setCompressMap({});
                setShowAltCombos(false);
                setShowImpact(false);
                return;
            }
            await confirmSaveLimit(limitHours);
        } catch { await confirmSaveLimit(limitHours); }
        finally { setSavingLimit(false); }
    }

    async function confirmSaveLimit(hours: number) {
        if (!session) return;
        setSavingLimit(true);
        setLimitPreview(null); // cerrar modal ANTES del await para evitar race-condition con load()
        try {
            await api.patch(`/users/${session.user_id}/config`, null, {
                params: { daily_limit_minutes: hours * 60 },
            });
            setLimitHours(hours);
            setLimitSaved(true);
            setTimeout(() => { setLimitSaved(false); setShowConfig(false); }, 1800);
        } catch { /* ignore — el modal ya está cerrado */ }
        finally { setSavingLimit(false); }
    }

    async function toggleExpand(taskId: string) {
        if (expandedTaskId === taskId) {
            setExpandedTaskId(null);
            return;
        }
        setExpandedTaskId(taskId);
        if (subtaskCache[taskId]) return; // ya cargadas
        setLoadingSubtasks(taskId);
        try {
            const subs = await subtaskService.getByTask(taskId);
            setSubtaskCache(prev => ({ ...prev, [taskId]: subs }));
        } catch { /* ignore */ }
        finally { setLoadingSubtasks(null); }
    }

    const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
    const total = overdue.length + forToday.length + upcoming.length;

    // Calcular exceso de horas para hoy
    const totalTodayMinutes = forToday.reduce((acc, t) => acc + (t.duration_minutes ?? 0), 0);
    const limitMinutes = limitHours * 60;
    const todayOverload = totalTodayMinutes > limitMinutes
        ? parseFloat(((totalTodayMinutes - limitMinutes) / 60).toFixed(1))
        : null;

    const sections: Section[] = [
        {
            key: "vencidas",
            label: "Vencidas",
            items: overdue,
            badge: "Vencida",
            badgeClass: "bg-red-500/15 text-red-400 border border-red-500/30",
            emptyMsg: "Sin actividades vencidas 🎉",
            accentColor: "text-red-400",
            cardBorder: "border-slate-800 hover:border-red-500/30",
        },
        {
            key: "hoy",
            label: "Para hoy",
            items: forToday,
            emptyMsg: "Sin actividades para hoy",
            accentColor: "text-violet-400",
            cardBorder: "border-slate-800 hover:border-violet-500/30",
        },
        {
            key: "proximas",
            label: "Próximas",
            items: upcoming,
            emptyMsg: "Sin actividades próximas",
            accentColor: "text-slate-400",
            cardBorder: "border-slate-800 hover:border-slate-700",
        },
    ];

    if (loadState === "loading") {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4" role="status" aria-live="polite">
                <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-400 text-sm">Cargando tu día...</p>
            </div>
        );
    }

    if (loadState === "error") {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4" role="alert">
                <span className="text-4xl">⚠️</span>
                <p className="text-slate-300 font-medium">{errorMsg}</p>
                <button onClick={load} className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition">
                    Reintentar
                </button>
            </div>
        );
    }

    if (total === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <span className="text-5xl">🌿</span>
                <p className="text-slate-300 font-semibold text-lg">¡Todo al día!</p>
                <p className="text-slate-500 text-sm max-w-xs">No tienes actividades pendientes. Crea una nueva para organizar tu estudio.</p>
                <button onClick={() => navigate("/crear")}
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold px-6 py-3 rounded-xl transition shadow-lg shadow-violet-500/20">
                    Crear actividad
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Encabezado */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-white text-2xl font-bold tracking-tight">
                        Hola, {session?.first_name} 👋
                    </h1>
                    <p className="text-slate-400 text-sm mt-0.5">
                        {new Date().toLocaleDateString("es-CO", { weekday: "long", month: "long", day: "numeric" })}
                    </p>
                </div>

                {/* Botones cabecera: config + nueva */}
                <div className="flex items-center gap-2">
                    {/* Config límite diario */}
                    <div className="relative" ref={configRef}>
                        <button
                            onClick={() => setShowConfig(v => !v)}
                            className="text-slate-500 hover:text-slate-300 text-lg w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-800 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                            title="Configurar límite diario"
                            aria-label="Configurar límite diario de estudio"
                        >
                            ⚙️
                        </button>

                        {showConfig && (
                            <div className="absolute right-0 top-11 z-40 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 w-72 space-y-3">
                                <p className="text-slate-300 text-sm font-semibold">Límite diario de estudio</p>
                                <p className="text-slate-500 text-xs leading-relaxed">
                                    El sistema te avisará cuando superes este límite al planificar actividades.
                                </p>
                                <div className="flex items-center gap-2">
                                    <input
                                        id="limit-hours-input"
                                        type="number"
                                        min={1}
                                        max={16}
                                        value={limitHours}
                                        onChange={e => setLimitHours(Number(e.target.value))}
                                        className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                    />
                                    <span className="text-slate-400 text-sm">horas / día</span>
                                </div>

                                <button
                                    onClick={saveDailyLimit}
                                    disabled={savingLimit || limitHours < 1}
                                    className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-xl transition"
                                >
                                    {limitSaved ? "✅ Guardado" : savingLimit ? "Verificando..." : "Guardar"}
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => navigate("/crear")}
                        className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition shadow-lg shadow-violet-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                        + Nueva
                    </button>
                </div>
            </div>

            {/* Pills de resumen */}
            <div className="flex gap-3 flex-wrap">
                {forToday.length > 0 && (
                    <span className="bg-violet-500/15 text-violet-300 border border-violet-500/30 text-xs font-medium px-3 py-1.5 rounded-full">
                        {forToday.length} para hoy
                    </span>
                )}
                {overdue.length > 0 && (
                    <span className="bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-medium px-3 py-1.5 rounded-full">
                        {overdue.length} vencida{overdue.length !== 1 ? "s" : ""}
                    </span>
                )}
                {upcoming.length > 0 && (
                    <span className="bg-slate-700/60 text-slate-400 text-xs font-medium px-3 py-1.5 rounded-full">
                        {upcoming.length} próxima{upcoming.length !== 1 ? "s" : ""}
                    </span>
                )}
                <span className="bg-slate-800/80 text-slate-500 border border-slate-700/50 text-xs font-medium px-3 py-1.5 rounded-full">
                    ⏱ Límite: {limitHours}h / día
                </span>
            </div>

            {/* Regla de priorización */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-slate-400 leading-relaxed">
                <span className="text-slate-300 font-semibold">📌 Orden de prioridad: </span>
                Primero las <span className="text-red-400 font-medium">vencidas</span>,
                luego las de <span className="text-violet-400 font-medium">hoy</span> y después las{" "}
                <span className="text-slate-300 font-medium">próximas</span>.
                Dentro de cada grupo: <span className="text-red-400">alta</span> → <span className="text-amber-400">media</span> → <span className="text-emerald-400">baja</span>.
                Haz clic en <span className="text-violet-400 font-medium">Ver pasos</span> para ver las subtareas de cada actividad.
            </div>

            {/* Secciones */}
            {sections.map(({ key, label, items, badge, badgeClass, emptyMsg, accentColor, cardBorder }) => (
                <section key={key} aria-labelledby={`section-${key}`}>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
                        <h2 id={`section-${key}`} className={`text-sm font-semibold uppercase tracking-widest ${accentColor}`}>
                            {label}
                        </h2>
                        <span className="text-slate-600 text-xs">{items.length}</span>
                        {/* Badge total vs límite — siempre visible en "Para hoy" */}
                        {key === "hoy" && forToday.length > 0 && (
                            <span className="ml-1 flex items-center gap-1 bg-slate-800/80 text-slate-400 border border-slate-700/50 text-xs font-medium px-2 py-0.5 rounded-full">
                                ⏱ {parseFloat((totalTodayMinutes / 60).toFixed(1))}h / {limitHours}h
                            </span>
                        )}
                        {/* Badge de exceso de horas — solo aparece cuando se supera el límite */}
                        {key === "hoy" && todayOverload !== null && (
                            <span className="ml-1 flex items-center gap-1 bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-semibold px-2 py-0.5 rounded-full animate-pulse">
                                ⚠️ +{todayOverload}h del límite
                            </span>
                        )}
                    </div>

                    {items.length === 0 ? (
                        <p className="text-slate-600 text-sm italic pl-1">{emptyMsg}</p>
                    ) : (
                        <div className="space-y-2">
                            {items.map(task => {
                                const subject = task.subject_id ? subjectMap[task.subject_id] : null;
                                const isExpanded = expandedTaskId === task.id;
                                const subs = subtaskCache[task.id] ?? [];
                                const isLoadingSubs = loadingSubtasks === task.id;
                                const doneCount = subs.filter(s => s.status === "done").length;

                                return (
                                    <div
                                        key={task.id}
                                        className={`bg-slate-900 border rounded-2xl transition-all duration-200 ${cardBorder} ${isExpanded ? "border-violet-500/30 shadow-lg shadow-violet-500/5" : ""}`}
                                    >
                                        {/* Tarjeta principal — click navega a detalle */}
                                        <button
                                            onClick={() => navigate(`/actividad/${task.id}`)}
                                            className="w-full text-left p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-inset rounded-2xl group"
                                            aria-label={`Ver actividad: ${task.title}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                {/* Barra de color de materia */}
                                                <div
                                                    className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
                                                    style={{ backgroundColor: subject?.color ?? "#475569" }}
                                                />

                                                <div className="flex-1 min-w-0">
                                                    {/* Badges superiores */}
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        {badge && (
                                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeClass}`}>
                                                                {badge}
                                                            </span>
                                                        )}
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
                                                    <p className="font-medium text-sm leading-snug text-white group-hover:text-violet-200 transition-colors">
                                                        {task.title}
                                                    </p>

                                                    {/* Fecha y duración */}
                                                    <div className="flex gap-3 mt-1.5 text-xs text-slate-600">
                                                        {task.due_date && <span>📅 {task.due_date}</span>}
                                                        {task.duration_minutes && <span>⏱ {task.duration_minutes}min</span>}
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
                                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[task.status] ?? ""}`}>
                                                            {STATUS_LABELS[task.status]}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>

                                        {/* Footer expandible de pasos */}
                                        <div className="border-t border-slate-800/80 px-4 pb-1">
                                            <button
                                                onClick={() => toggleExpand(task.id)}
                                                className="w-full flex items-center justify-between py-2.5 text-xs text-slate-500 hover:text-slate-300 transition group focus:outline-none"
                                                aria-expanded={isExpanded}
                                                aria-controls={`subtasks-${task.id}`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    {isExpanded ? "▾" : "▸"}
                                                    <span className="font-medium">
                                                        {isExpanded
                                                            ? "Ocultar pasos"
                                                            : subtaskCache[task.id]
                                                                ? `Ver pasos · ${subs.length} paso${subs.length !== 1 ? "s" : ""}`
                                                                : "Ver pasos"
                                                        }
                                                    </span>
                                                    {subtaskCache[task.id] && subs.length > 0 && (
                                                        <span className="bg-emerald-500/15 text-emerald-400 text-xs px-1.5 py-0.5 rounded-full font-medium">
                                                            {doneCount}/{subs.length} hechos
                                                        </span>
                                                    )}
                                                </span>
                                                {isLoadingSubs && (
                                                    <span className="w-3 h-3 border border-violet-500 border-t-transparent rounded-full animate-spin" />
                                                )}
                                            </button>

                                            {/* Lista de subtareas */}
                                            {isExpanded && (
                                                <div
                                                    id={`subtasks-${task.id}`}
                                                    className="pb-3 space-y-1.5"
                                                    role="list"
                                                    aria-label={`Pasos de ${task.title}`}
                                                >
                                                    {isLoadingSubs ? (
                                                        <div className="py-3 flex justify-center">
                                                            <div className="w-5 h-5 border border-violet-500 border-t-transparent rounded-full animate-spin" />
                                                        </div>
                                                    ) : subs.length === 0 ? (
                                                        <p className="text-slate-600 text-xs italic py-2 pl-1">
                                                            Esta actividad no tiene pasos definidos.
                                                        </p>
                                                    ) : (
                                                        subs.map(sub => {
                                                            const isDone = sub.status === "done";
                                                            const isPostponed = sub.status === "postponed";
                                                            return (
                                                                <div
                                                                    key={sub.id}
                                                                    role="listitem"
                                                                    className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs transition
                                                                        ${isDone
                                                                            ? "bg-emerald-500/8 border border-emerald-500/15"
                                                                            : isPostponed
                                                                                ? "bg-amber-500/8 border border-amber-500/15"
                                                                                : "bg-slate-800/50 border border-slate-700/50"
                                                                        }`}
                                                                >
                                                                    <span className="text-base leading-none mt-0.5 shrink-0">
                                                                        {SUBTASK_STATUS_ICON[sub.status ?? "pending"]}
                                                                    </span>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className={`font-medium leading-snug ${isDone ? "line-through text-slate-500" : isPostponed ? "text-amber-300" : "text-slate-200"}`}>
                                                                            {sub.title}
                                                                        </p>
                                                                        <div className="flex gap-2 mt-0.5 text-slate-600">
                                                                            {sub.target_date && <span>📅 {sub.target_date}</span>}
                                                                            {sub.estimated_minutes && <span>⏱ {sub.estimated_minutes}min</span>}
                                                                            {isPostponed && sub.postpone_note && (
                                                                                <span className="text-amber-600 italic">"{sub.postpone_note}"</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {/* Badge de estado */}
                                                                    <span className={`shrink-0 px-1.5 py-0.5 rounded-full font-medium
                                                                        ${isDone ? "bg-emerald-500/20 text-emerald-400" : isPostponed ? "bg-amber-500/20 text-amber-400" : "bg-slate-700 text-slate-400"}`}>
                                                                        {isDone ? "Hecho" : isPostponed ? "Pospuesto" : "Pendiente"}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })
                                                    )}

                                                    {/* Ir a detalle completo */}
                                                    {subs.length > 0 && (
                                                        <button
                                                            onClick={() => navigate(`/actividad/${task.id}`)}
                                                            className="w-full mt-1 text-violet-400 hover:text-violet-300 text-xs font-medium py-1.5 rounded-lg hover:bg-violet-500/10 transition text-center"
                                                        >
                                                            Ver detalle completo →
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            ))}

            {/* ── Modal enriquecido: límite diario con recomendaciones ── */}
            {limitPreview && (() => {
                const day: AffectedDay = limitPreview.affected_days[previewDayIdx];
                const totalDays = limitPreview.affected_days.length;
                const newLimitMins = limitPreview.new_limit_minutes;

                // Helpers de formato
                const fmtDate = (iso: string) =>
                    new Date(iso + "T00:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
                const fmtShort = (iso: string) =>
                    new Date(iso + "T00:00:00").toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
                const pColor: Record<string, string> = { alta: "text-red-400", media: "text-amber-400", baja: "text-emerald-400" };
                const pBg: Record<string, string> = { alta: "bg-red-500/15 border-red-500/30", media: "bg-amber-500/15 border-amber-500/30", baja: "bg-emerald-500/15 border-emerald-500/30" };

                // Opción A: minutos que quedarían con seleccionados
                const selectedMins = day.tasks
                    .filter(t => selectedTaskIds.has(t.task_id))
                    .reduce((a, t) => a + t.duration_minutes, 0);
                const resultAfterA = day.total_minutes - selectedMins;
                const aIsValid = resultAfterA <= newLimitMins && selectedMins > 0;

                // Opción C: total con compresión
                const compressTotal = day.tasks.reduce((acc, t) => {
                    const edited = compressMap[t.task_id];
                    return acc + (edited !== undefined ? edited : t.duration_minutes);
                }, 0);
                const cIsValid = compressTotal <= newLimitMins && compressTotal !== day.total_minutes;

                // Aplicar movimiento de tareas + guardar límite
                async function applyMovements(tasksToMove: TaskToMove[]) {
                    if (!session) return;
                    setApplyingAction(true);
                    try {
                        for (const t of tasksToMove) {
                            if (t.suggested_date) {
                                await taskService.update(t.task_id, { due_date: t.suggested_date });
                            }
                        }
                        await advanceOrSave();
                    } catch { setApplyingAction(false); }
                }

                // Aplicar compresión de duraciones
                async function applyCompress() {
                    if (!session) return;
                    setApplyingAction(true);
                    try {
                        for (const t of day.tasks) {
                            const edited = compressMap[t.task_id];
                            if (edited !== undefined && edited !== t.duration_minutes) {
                                await taskService.update(t.task_id, { duration_minutes: edited });
                            }
                        }
                        await advanceOrSave();
                    } catch { setApplyingAction(false); }
                }

                // Aplicar distribución automática
                async function applyDistribute() {
                    if (!session) return;
                    setApplyingAction(true);
                    try {
                        const days_avail = day.recommendations.distribute_option.days_available;
                        let dayIdx2 = 0;
                        let usedInDay: Record<string, number> = {};
                        for (const t of day.tasks) {
                            // Buscar día con espacio
                            while (dayIdx2 < days_avail.length) {
                                const avail = days_avail[dayIdx2].available_minutes - (usedInDay[days_avail[dayIdx2].date] ?? 0);
                                if (avail >= t.duration_minutes) break;
                                dayIdx2++;
                            }
                            if (dayIdx2 < days_avail.length) {
                                const targetDate = days_avail[dayIdx2].date;
                                await taskService.update(t.task_id, { due_date: targetDate });
                                usedInDay[targetDate] = (usedInDay[targetDate] ?? 0) + t.duration_minutes;
                            }
                        }
                        await advanceOrSave();
                    } catch { setApplyingAction(false); }
                }

                // Aplicar opción A: mover seleccionadas manualmente
                async function applyManualMove() {
                    if (!aIsValid || !session) return;
                    const toMove = day.tasks.filter(t => selectedTaskIds.has(t.task_id));
                    const recs = day.recommendations.auto_suggestion.tasks_to_move;
                    const payload: TaskToMove[] = toMove.map(t => {
                        const match = recs.find(r => r.task_id === t.task_id);
                        return { task_id: t.task_id, title: t.title, priority: t.priority, duration_minutes: t.duration_minutes, suggested_date: match?.suggested_date ?? null };
                    });
                    await applyMovements(payload);
                }

                async function advanceOrSave() {
                    setApplyingAction(false);
                    if (previewDayIdx < totalDays - 1) {
                        setPreviewDayIdx(i => i + 1);
                        setSelectedTaskIds(new Set());
                        setCompressMap({});
                        setShowAltCombos(false);
                        setShowImpact(false);
                    } else {
                        await confirmSaveLimit(limitHours); // esperar a que el límite se guarde
                        load(); // recargar tareas DESPUÉS de que el modal se cerró
                    }
                }

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="limit-modal-title">
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setLimitPreview(null)} />
                        <div className="relative bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto flex flex-col">

                            {/* ── Encabezado del modal ── */}
                            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 pt-5 pb-4 z-10">
                                {totalDays > 1 && (
                                    <div className="flex items-center justify-between mb-3">
                                        <button onClick={() => previewDayIdx > 0 && setPreviewDayIdx(i => i - 1)}
                                            disabled={previewDayIdx === 0}
                                            className="text-slate-500 hover:text-slate-300 disabled:opacity-30 text-xs px-2 py-1 rounded-lg hover:bg-slate-800 transition">← Anterior</button>
                                        <span className="text-slate-400 text-xs font-medium">Día {previewDayIdx + 1} de {totalDays}</span>
                                        <button onClick={() => previewDayIdx < totalDays - 1 && setPreviewDayIdx(i => i + 1)}
                                            disabled={previewDayIdx === totalDays - 1}
                                            className="text-slate-500 hover:text-slate-300 disabled:opacity-30 text-xs px-2 py-1 rounded-lg hover:bg-slate-800 transition">Siguiente →</button>
                                    </div>
                                )}
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl shrink-0">⚠️</span>
                                    <div>
                                        <p id="limit-modal-title" className="text-white font-bold text-sm capitalize">{fmtDate(day.date)}</p>
                                        <div className="flex gap-3 mt-1 text-xs">
                                            <span className="text-slate-400">{day.total_hours}h planificadas</span>
                                            <span className="text-slate-600">/</span>
                                            <span className="text-amber-400 font-semibold">{limitPreview.new_limit_hours}h nuevo límite</span>
                                            <span className="text-red-400 font-semibold">+{day.overflow_hours}h exceso</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-4 space-y-5">

                                {/* Tareas del día */}
                                <div>
                                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">Tareas de este día</p>
                                    <div className="space-y-1.5">
                                        {day.tasks.map((t: TaskInDay) => (
                                            <div key={t.task_id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-xs ${pBg[t.priority] ?? "bg-slate-800 border-slate-700"}`}>
                                                <input
                                                    type="checkbox"
                                                    id={`chk-${t.task_id}`}
                                                    checked={selectedTaskIds.has(t.task_id)}
                                                    onChange={e => {
                                                        const next = new Set(selectedTaskIds);
                                                        e.target.checked ? next.add(t.task_id) : next.delete(t.task_id);
                                                        setSelectedTaskIds(next);
                                                    }}
                                                    className="accent-violet-500 w-4 h-4 shrink-0"
                                                />
                                                <label htmlFor={`chk-${t.task_id}`} className="flex-1 cursor-pointer">
                                                    <span className="font-semibold text-white">{t.title}</span>
                                                    <span className={`ml-2 ${pColor[t.priority] ?? "text-slate-400"}`}>{t.priority}</span>
                                                    <span className="text-slate-500 ml-2">{t.duration_hours}h</span>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* ── Opción A: Mover seleccionadas manualmente ── */}
                                <div className="space-y-2">
                                    <p className="text-slate-300 text-xs font-semibold uppercase tracking-wide">A · Mover tareas seleccionadas</p>
                                    {selectedMins > 0 && (
                                        <p className={`text-xs ${aIsValid ? "text-emerald-400" : "text-amber-400"}`}>
                                            Seleccionadas: {(selectedMins / 60).toFixed(1)}h → El día quedaría en <strong>{(resultAfterA / 60).toFixed(1)}h</strong>
                                            {aIsValid ? " ✓" : ` (aún ${((resultAfterA - newLimitMins) / 60).toFixed(1)}h sobre el límite)`}
                                        </p>
                                    )}
                                    <button
                                        onClick={applyManualMove}
                                        disabled={!aIsValid || applyingAction}
                                        className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-30 text-white text-xs font-semibold py-2.5 rounded-xl transition"
                                    >
                                        {applyingAction ? "Aplicando..." : "Mover seleccionadas"}
                                    </button>
                                </div>

                                {/* ── Opción B: Recomendación automática ── */}
                                {day.recommendations.auto_suggestion.tasks_to_move.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-slate-300 text-xs font-semibold uppercase tracking-wide">B · Recomendación automática</p>
                                        <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-3 space-y-2">
                                            <p className="text-violet-300 text-xs">{day.recommendations.auto_suggestion.description}</p>
                                            <ul className="space-y-1">
                                                {day.recommendations.auto_suggestion.tasks_to_move.map((t: TaskToMove) => (
                                                    <li key={t.task_id} className="text-xs text-slate-400">
                                                        <span className={pColor[t.priority] ?? ""}>{t.priority}</span>
                                                        {" "}<span className="text-white">"{t.title}"</span>
                                                        {" "}→{" "}
                                                        {t.suggested_date
                                                            ? <span className="text-violet-300">{fmtShort(t.suggested_date)}</span>
                                                            : <span className="text-slate-600 italic">sin espacio disponible</span>}
                                                    </li>
                                                ))}
                                            </ul>
                                            <button
                                                onClick={() => applyMovements(day.recommendations.auto_suggestion.tasks_to_move)}
                                                disabled={applyingAction}
                                                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-30 text-white text-xs font-semibold py-2 rounded-lg transition"
                                            >
                                                {applyingAction ? "Aplicando..." : "Aplicar recomendación"}
                                            </button>
                                        </div>

                                        {day.recommendations.alternative_combinations.length > 0 && (
                                            <div>
                                                <button onClick={() => setShowAltCombos(v => !v)}
                                                    className="text-slate-500 hover:text-slate-300 text-xs py-1 transition">
                                                    {showAltCombos ? "▾" : "▸"} Ver otras opciones
                                                </button>
                                                {showAltCombos && (
                                                    <div className="space-y-2 mt-2">
                                                        {day.recommendations.alternative_combinations.map((combo, i) => (
                                                            <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-3 space-y-2">
                                                                <p className="text-xs text-slate-300">{combo.label}</p>
                                                                <p className="text-xs text-slate-500">Resultado: {(combo.result_minutes / 60).toFixed(1)}h</p>
                                                                <button
                                                                    onClick={() => applyMovements(combo.tasks_to_move)}
                                                                    disabled={applyingAction}
                                                                    className="w-full bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold py-1.5 rounded-lg transition disabled:opacity-30"
                                                                >
                                                                    Aplicar esta opción
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── Opción C: Comprimir duraciones ── */}
                                {day.recommendations.compress_option.available && (
                                    <div className="space-y-2">
                                        <p className="text-slate-300 text-xs font-semibold uppercase tracking-wide">C · Reducir duraciones</p>
                                        <div className="space-y-1.5">
                                            {day.tasks.map((t: TaskInDay) => (
                                                <div key={t.task_id} className="flex items-center gap-3 text-xs">
                                                    <span className="flex-1 text-slate-400 truncate">{t.title}</span>
                                                    <input
                                                        type="number" min={5}
                                                        value={compressMap[t.task_id] ?? t.duration_minutes}
                                                        onChange={e => setCompressMap(prev => ({ ...prev, [t.task_id]: Number(e.target.value) }))}
                                                        className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
                                                    />
                                                    <span className="text-slate-600 w-6">min</span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className={`text-xs ${cIsValid ? "text-emerald-400" : "text-amber-400"}`}>
                                            Total: <strong>{(compressTotal / 60).toFixed(1)}h</strong>
                                            {cIsValid ? " ✔ dentro del límite" : ` (aún ${((compressTotal - newLimitMins) / 60).toFixed(1)}h sobre el límite)`}
                                        </p>
                                        <button
                                            onClick={applyCompress}
                                            disabled={!cIsValid || applyingAction}
                                            className="w-full bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 text-xs font-semibold py-2 rounded-xl transition disabled:opacity-30"
                                        >
                                            {applyingAction ? "Guardando..." : "Guardar con estas duraciones"}
                                        </button>
                                    </div>
                                )}

                                {/* ── Opción D: Distribuir automáticamente ── */}
                                {day.recommendations.distribute_option.days_available.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-slate-300 text-xs font-semibold uppercase tracking-wide">D · Distribuir en días disponibles</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {day.recommendations.distribute_option.days_available.map(d => (
                                                <span key={d.date} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs px-2 py-1 rounded-lg">
                                                    {fmtShort(d.date)} · {d.available_hours}h libres
                                                </span>
                                            ))}
                                        </div>
                                        <button
                                            onClick={applyDistribute}
                                            disabled={applyingAction}
                                            className="w-full bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-xs font-semibold py-2 rounded-xl transition disabled:opacity-30"
                                        >
                                            {applyingAction ? "Distribuyendo..." : "Distribuir automáticamente"}
                                        </button>
                                    </div>
                                )}

                                {/* ── Opción E: Vista previa del impacto ── */}
                                <div>
                                    <button onClick={() => setShowImpact(v => !v)}
                                        className="text-slate-500 hover:text-slate-300 text-xs py-1 transition flex items-center gap-1">
                                        {showImpact ? "▾" : "▸"} Ver cómo quedarían los días
                                    </button>
                                    {showImpact && (
                                        <div className="mt-2 rounded-xl border border-slate-700 overflow-hidden text-xs">
                                            <div className="grid grid-cols-3 bg-slate-800 text-slate-400 font-medium px-3 py-2">
                                                <span>Día</span>
                                                <span className="text-center">Actual</span>
                                                <span className="text-right">Después</span>
                                            </div>
                                            <div className="grid grid-cols-3 px-3 py-2 border-t border-slate-700">
                                                <span className="text-white capitalize">{fmtShort(day.date)}</span>
                                                <span className="text-center text-amber-400">{day.total_hours}h</span>
                                                <span className={`text-right font-semibold ${
                                                    aIsValid ? "text-emerald-400" :
                                                    cIsValid ? "text-emerald-400" :
                                                    "text-slate-400"
                                                }`}>
                                                    {aIsValid ? (resultAfterA / 60).toFixed(1) :
                                                     cIsValid ? (compressTotal / 60).toFixed(1) :
                                                     day.total_hours}h
                                                </span>
                                            </div>
                                            {day.recommendations.distribute_option.days_available.slice(0, 3).map(d => (
                                                <div key={d.date} className="grid grid-cols-3 px-3 py-2 border-t border-slate-800">
                                                    <span className="text-slate-400 capitalize">{fmtShort(d.date)}</span>
                                                    <span className="text-center text-slate-500">{((newLimitMins - d.available_minutes) / 60).toFixed(1)}h</span>
                                                    <span className="text-right text-slate-400">—</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                            </div>

                            {/* ── Pie del modal ── */}
                            <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 px-6 py-4 flex gap-2">
                                <button
                                    onClick={() => { confirmSaveLimit(limitHours); }}
                                    disabled={savingLimit || applyingAction}
                                    className="flex-1 bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-slate-300 text-xs font-semibold py-2.5 rounded-xl transition disabled:opacity-40"
                                >
                                    {savingLimit ? "Guardando..." : "Guardar límite de todas formas"}
                                </button>
                                <button
                                    onClick={() => setLimitPreview(null)}
                                    className="flex-1 text-slate-400 hover:text-white text-xs py-2.5 rounded-xl hover:bg-slate-800 transition"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}