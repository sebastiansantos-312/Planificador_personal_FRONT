/**
 * pages/CrearPage.tsx — Formulario para crear una nueva tarea con subtareas.
 *
 * Sección 1 — ¿Qué vas a hacer? (título + tipo de actividad + materia)
 * Sección 2 — ¿Cuándo y cuánto tiempo? (fecha límite, duración, prioridad)
 * Sección 3 — Pasos/subtareas (opcional)
 *
 * Sprint 3 rev2: verificación de horas diarias al enviar el formulario usando
 *   el endpoint /tasks/{id}/check-conflict (cuenta task duration + subtask mins).
 *   Si supera el límite sale un modal informativo — el usuario puede ignorarlo y crear.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { taskService } from "../services/taskService";
import { subtaskService } from "../services/subtaskService";
import { subjectService } from "../services/subjectService";
import { authService } from "../services/authService";
import type { Subject, TaskPriority, TaskType, SubtaskCreate, LoadingState, ConflictResult, AlternativeDay, DisplaceableTask } from "../types";

interface SubtaskDraft {
    title: string;
    description: string;
    target_date: string;
    estimated_minutes: number;
}

/** Opciones de tipo de actividad — US-01. */
const TASK_TYPES: { value: TaskType; label: string; icon: string }[] = [
    { value: "examen", label: "Examen", icon: "📝" },
    { value: "quiz", label: "Quiz", icon: "❓" },
    { value: "taller", label: "Taller", icon: "🔧" },
    { value: "proyecto", label: "Proyecto", icon: "📁" },
    { value: "exposición", label: "Exposición", icon: "🎤" },
    { value: "otro", label: "Otro", icon: "📌" },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; activeClass: string }[] = [
    { value: "alta", label: "Alta", activeClass: "bg-red-500/20 text-red-400 border-red-500/40 ring-1 ring-red-400" },
    { value: "media", label: "Media", activeClass: "bg-amber-500/20 text-amber-400 border-amber-500/40 ring-1 ring-amber-400" },
    { value: "baja", label: "Baja", activeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 ring-1 ring-emerald-400" },
];

/** UUID dummy para una nueva tarea (no excluye nada del conteo). */
const DUMMY_UUID = "00000000-0000-0000-0000-000000000000";

export default function CrearPage() {
    const navigate = useNavigate();
    const session = authService.getSession();

    // Materias disponibles para el selector
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [subjectsState, setSubjectsState] = useState<LoadingState>("loading");

    // Campos del formulario de tarea
    const [title, setTitle] = useState("");
    const [taskType, setTaskType] = useState<TaskType | "">("");
    const [subjectId, setSubjectId] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [priority, setPriority] = useState<TaskPriority>("media");

    // Subtareas pendientes de crear (draft local)
    const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);
    const [showSubtaskForm, setShowSubtaskForm] = useState(false);
    const [newSub, setNewSub] = useState<SubtaskDraft>({
        title: "", description: "", target_date: "", estimated_minutes: 30,
    });

    // Modal de advertencia de límite diario
    const [conflictData, setConflictData] = useState<ConflictResult | null>(null);
    // Tarea candidata seleccionada para desplazar (opción B)
    const [selectedDisplaceable, setSelectedDisplaceable] = useState<DisplaceableTask | null>(null);
    // Día alternativo seleccionado (opción A)
    const [selectedAltDay, setSelectedAltDay] = useState<AlternativeDay | null>(null);
    const [displacingTask, setDisplacingTask] = useState(false);

    const [submitState, setSubmitState] = useState<LoadingState>("idle");
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        if (!session) { navigate("/auth"); return; }
        loadSubjects();
    }, []);

    async function loadSubjects() {
        if (!session) return;
        try {
            const data = await subjectService.getByEmail(session.email);
            setSubjects(data);
            setSubjectsState("success");
        } catch {
            setSubjectsState("error");
        }
    }

    /** Toggle de materia: click en la seleccionada la quita, en otra la pone. */
    function toggleSubject(id: string) {
        setSubjectId(prev => prev === id ? "" : id);
    }

    /** Agrega el paso al draft local. */
    function handleAddSubtask() {
        if (!newSub.title.trim() || !newSub.target_date) return;
        setSubtasks((prev) => [...prev, { ...newSub }]);
        setNewSub({ title: "", description: "", target_date: "", estimated_minutes: 30 });
        setShowSubtaskForm(false);
    }

    function removeSubtask(i: number) {
        setSubtasks((prev) => prev.filter((_, idx) => idx !== i));
    }

    /**
     * Al hacer submit: verifica si supera el límite diario.
     * Si hay conflicto, muestra el modal. Desde el modal el usuario
     * puede "Crear de todas formas" o "Cancelar".
     */
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!session || !taskType) return;

        setErrorMsg("");

        // Verificar límite diario antes de crear
        if (dueDate && durationMinutes > 0) {
            try {
                const result = await taskService.checkConflict(
                    DUMMY_UUID,
                    dueDate,
                    durationMinutes,
                    session.user_id,
                    priority,
                );
                if (result.has_conflict) {
                    setConflictData(result);
                    setSelectedAltDay(null);
                    setSelectedDisplaceable(null);
                    return;
                }
            } catch { /* si falla la verificación, continuar creando */ }
        }

        await doCreate();
    }

    /**
     * Opción A: mueve la tarea al día alternativo seleccionado y la crea.
     */
    async function doCreateOnAltDay() {
        if (!selectedAltDay) return;
        const originalDate = dueDate;
        setDueDate(selectedAltDay.date);
        setConflictData(null);
        // Pequeño truco: guardamos la fecha nueva y llamamos doCreate directamente
        // pasando la fecha como override (usamos un state intermedio)
        await doCreateWithDate(selectedAltDay.date);
        // Si el usuario cancela el modal antes de confirmar, restaurar
        void originalDate;
    }

    /**
     * Opción B: desplaza la tarea candidata al día sugerido, luego crea la nueva.
     */
    async function doDisplaceAndCreate() {
        if (!selectedDisplaceable || !selectedDisplaceable.suggested_new_date || !session) return;
        setDisplacingTask(true);
        try {
            // Mover la tarea candidata al día sugerido
            await taskService.update(selectedDisplaceable.task_id, {
                due_date: selectedDisplaceable.suggested_new_date,
            });
            // Crear la nueva tarea en el día original
            setConflictData(null);
            await doCreate();
        } catch {
            setDisplacingTask(false);
        }
    }

    /** Crea la tarea usando una fecha específica (para opción A). */
    async function doCreateWithDate(overrideDate: string) {
        if (!session || !taskType) return;
        setConflictData(null);
        setErrorMsg("");
        setSubmitState("loading");
        try {
            const task = await taskService.create({
                title,
                task_type: taskType,
                subject_id: subjectId || undefined,
                user_id: session.user_id,
                due_date: overrideDate,
                duration_minutes: durationMinutes,
                priority,
                status: "pending",
            });
            for (const sub of subtasks) {
                const payload: SubtaskCreate = {
                    task_id: task.id,
                    title: sub.title,
                    description: sub.description || undefined,
                    target_date: sub.target_date,
                    estimated_minutes: sub.estimated_minutes,
                    status: "pending",
                };
                await subtaskService.create(payload);
            }
            setSubmitState("success");
            setTimeout(() => navigate(`/actividad/${task.id}`), 1500);
        } catch {
            setSubmitState("error");
            setErrorMsg("No se pudo crear la actividad. Verifica los datos e intenta de nuevo.");
        }
    }

    /** Ejecuta la creación real de la tarea y sus pasos. */
    async function doCreate() {
        if (!session || !taskType) return;
        setConflictData(null);
        setErrorMsg("");
        setSubmitState("loading");

        try {
            const task = await taskService.create({
                title,
                task_type: taskType,
                subject_id: subjectId || undefined,
                user_id: session.user_id,
                due_date: dueDate,
                duration_minutes: durationMinutes,
                priority,
                status: "pending",
            });

            for (const sub of subtasks) {
                const payload: SubtaskCreate = {
                    task_id: task.id,
                    title: sub.title,
                    description: sub.description || undefined,
                    target_date: sub.target_date,
                    estimated_minutes: sub.estimated_minutes,
                    status: "pending",
                };
                await subtaskService.create(payload);
            }

            setSubmitState("success");
            setTimeout(() => navigate(`/actividad/${task.id}`), 1500);
        } catch {
            setSubmitState("error");
            setErrorMsg("No se pudo crear la actividad. Verifica los datos e intenta de nuevo.");
        }
    }

    const isLoading = submitState === "loading";

    return (
        <div className="space-y-8 pb-10">
            <div>
                <button onClick={() => navigate(-1)}
                    className="text-slate-500 hover:text-slate-300 text-sm mb-4 flex items-center gap-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
                >
                    ← Volver
                </button>
                <h1 className="text-white text-2xl font-bold tracking-tight">Nueva actividad</h1>
                <p className="text-slate-400 text-sm mt-1">Crea una tarea y opcionalmente divídela en pasos.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>

                {/* ── Sección 1: Qué vas a hacer ── */}
                <fieldset className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                    <legend className="text-slate-300 text-sm font-semibold mb-4 flex items-center gap-2">
                        <span className="bg-violet-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">1</span>
                        ¿Qué vas a hacer?
                    </legend>

                    {/* Título */}
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-slate-300 mb-1.5">
                            Título *
                        </label>
                        <input
                            id="title" type="text" required value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ej: Entregar informe de laboratorio"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                        />
                    </div>

                    {/* Tipo de actividad — US-01 */}
                    <div>
                        <p className="text-sm font-medium text-slate-300 mb-2">
                            Tipo de actividad *
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {TASK_TYPES.map(({ value, label, icon }) => (
                                <button
                                    key={value} type="button"
                                    onClick={() => setTaskType(value)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition
                                        focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500
                                        ${taskType === value
                                            ? "bg-violet-600/20 text-violet-300 border-violet-500/50"
                                            : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"
                                        }`}
                                    aria-pressed={taskType === value}
                                >
                                    <span aria-hidden="true">{icon}</span>
                                    {label}
                                </button>
                            ))}
                        </div>
                        {!taskType && (
                            <p className="text-xs text-slate-500 mt-1.5">
                                Selecciona el tipo de actividad para continuar
                            </p>
                        )}
                    </div>

                    {/* Selector de materia */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-sm font-medium text-slate-300">
                                Materia <span className="text-slate-500 font-normal">(opcional)</span>
                            </label>
                            <button type="button" onClick={() => navigate("/materias")}
                                className="text-violet-400 hover:text-violet-300 text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
                            >
                                + Gestionar materias
                            </button>
                        </div>
                        {subjectsState === "loading" ? (
                            <div className="h-10 bg-slate-800 rounded-xl animate-pulse" />
                        ) : subjectsState === "error" ? (
                            <p className="text-red-400 text-sm">Error cargando materias.</p>
                        ) : subjects.length === 0 ? (
                            <div className="text-center py-4">
                                <p className="text-slate-500 text-sm">No tienes materias creadas.</p>
                                <button type="button" onClick={() => navigate("/materias")}
                                    className="text-violet-400 text-sm mt-1 hover:text-violet-300 transition"
                                >
                                    Crear primera materia →
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {subjects.map((s) => (
                                    <button key={s.id} type="button" onClick={() => toggleSubject(s.id)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500
                                            ${subjectId === s.id
                                                ? "border-transparent text-white shadow-md"
                                                : "border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 bg-slate-800"
                                            }`}
                                        style={subjectId === s.id ? { backgroundColor: s.color, boxShadow: `0 4px 14px ${s.color}40` } : {}}
                                        aria-pressed={subjectId === s.id}
                                        title={subjectId === s.id ? "Click para deseleccionar" : s.name}
                                    >
                                        {s.name}
                                        {subjectId === s.id && <span className="ml-1.5 opacity-70">✕</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </fieldset>

                {/* ── Sección 2: Cuándo y cuánto ── */}
                <fieldset className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                    <legend className="text-slate-300 text-sm font-semibold mb-4 flex items-center gap-2">
                        <span className="bg-violet-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">2</span>
                        ¿Cuándo y cuánto tiempo?
                    </legend>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="dueDate" className="block text-sm font-medium text-slate-300 mb-1.5">
                                Fecha límite *
                            </label>
                            <input
                                id="dueDate" type="date" required value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                            />
                        </div>
                        <div>
                            <label htmlFor="duration" className="block text-sm font-medium text-slate-300 mb-1.5">
                                Duración (min) *
                            </label>
                            <input
                                id="duration" type="number" min={5} max={480} required value={durationMinutes}
                                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                            />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-300 mb-2">Prioridad *</p>
                        <div className="flex gap-2">
                            {PRIORITY_OPTIONS.map(({ value, label, activeClass }) => (
                                <button key={value} type="button" onClick={() => setPriority(value)}
                                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500
                                        ${priority === value ? activeClass : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"}`}
                                    aria-pressed={priority === value}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </fieldset>

                {/* ── Sección 3: Subtareas opcionales ── */}
                <fieldset className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                    <legend className="text-slate-300 text-sm font-semibold mb-4 flex items-center gap-2">
                        <span className="bg-slate-700 text-slate-300 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">3</span>
                        Pasos / Subtareas <span className="text-slate-600 font-normal">(opcional)</span>
                    </legend>

                    {subtasks.length > 0 && (
                        <ul className="space-y-2">
                            {subtasks.map((sub, i) => (
                                <li key={i} className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3 text-sm">
                                    <div>
                                        <span className="text-white font-medium">{sub.title}</span>
                                        <span className="text-slate-500 ml-2">{sub.estimated_minutes}min · {sub.target_date}</span>
                                    </div>
                                    <button type="button" onClick={() => removeSubtask(i)}
                                        className="text-slate-600 hover:text-red-400 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
                                        aria-label={`Eliminar ${sub.title}`}
                                    >✕</button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {showSubtaskForm ? (
                        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3">
                            <div>
                                <label htmlFor="subTitle" className="block text-xs font-medium text-slate-400 mb-1">
                                    Título del paso *
                                </label>
                                <input id="subTitle" type="text" value={newSub.title}
                                    onChange={(e) => setNewSub({ ...newSub, title: e.target.value })}
                                    placeholder="Ej: Buscar bibliografía"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                                />
                            </div>
                            <div>
                                <label htmlFor="subDesc" className="block text-xs font-medium text-slate-400 mb-1">
                                    Descripción (opcional)
                                </label>
                                <input id="subDesc" type="text" value={newSub.description}
                                    onChange={(e) => setNewSub({ ...newSub, description: e.target.value })}
                                    placeholder="Descripción breve..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor="subDate" className="block text-xs font-medium text-slate-400 mb-1">
                                        Fecha objetivo *
                                    </label>
                                    <input id="subDate" type="date" value={newSub.target_date}
                                        onChange={(e) => setNewSub({ ...newSub, target_date: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="subMinutes" className="block text-xs font-medium text-slate-400 mb-1">
                                        Minutos estimados
                                    </label>
                                    <input id="subMinutes" type="number" min={5} value={newSub.estimated_minutes}
                                        onChange={(e) => setNewSub({ ...newSub, estimated_minutes: Number(e.target.value) })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 pt-1">
                                <button type="button" onClick={handleAddSubtask}
                                    disabled={!newSub.title.trim() || !newSub.target_date}
                                    className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold px-4 py-2 rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                                >
                                    Agregar paso
                                </button>
                                <button type="button" onClick={() => setShowSubtaskForm(false)}
                                    className="text-slate-500 hover:text-slate-300 text-xs px-3 py-2 rounded-lg transition"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button type="button" onClick={() => setShowSubtaskForm(true)}
                            className="w-full border border-dashed border-slate-700 hover:border-violet-500/50 text-slate-500 hover:text-violet-400 text-sm py-3 rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                        >
                            + Agregar paso
                        </button>
                    )}
                </fieldset>

                {/* Mensajes de estado */}
                {submitState === "success" && (
                    <div role="status" className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                        <span className="text-lg">✅</span>
                        <span>¡Actividad creada correctamente! Redirigiendo...</span>
                    </div>
                )}
                {submitState === "error" && (
                    <div role="alert" className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
                        {errorMsg}
                    </div>
                )}

                {/* Botón submit */}
                <button
                    type="submit"
                    disabled={isLoading || !title.trim() || !taskType || !dueDate}
                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-violet-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                    {isLoading ? "Creando..." : "Crear actividad"}
                </button>
            </form>

            {/* ── Modal emergente: límite de horas superado ── */}
            {conflictData && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="hour-limit-title"
                >
                    {/* Fondo oscuro */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setConflictData(null)}
                    />

                    {/* Panel del modal */}
                    <div className="relative bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl shadow-amber-500/10 p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
                        {/* Encabezado */}
                        <div className="flex items-start gap-3">
                            <span className="text-2xl shrink-0">⚠️</span>
                            <div>
                                <p id="hour-limit-title" className="text-white font-semibold text-sm">
                                    Límite diario superado
                                </p>
                                <p className="text-slate-400 text-xs mt-1">{conflictData.message}</p>
                            </div>
                        </div>

                        {/* Detalles numéricos */}
                        <div className="bg-slate-800/70 rounded-xl p-3 space-y-1.5 text-xs">
                            <div className="flex justify-between text-slate-400">
                                <span>Horas ya planificadas ese día</span>
                                <span className="font-semibold text-white">{conflictData.current_hours}h</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>Límite diario configurado</span>
                                <span className="font-semibold text-white">{conflictData.limit_hours}h</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-700 pt-1.5 mt-0.5 text-amber-400">
                                <span>Total con esta actividad</span>
                                <span className="font-bold">{conflictData.new_total_hours}h</span>
                            </div>
                        </div>

                        {/* ── Opción A: Mover a día alternativo ── */}
                        {conflictData.recommendations?.alternative_days && conflictData.recommendations.alternative_days.length > 0 ? (
                            <div className="space-y-2">
                                <p className="text-slate-300 text-xs font-semibold uppercase tracking-wide">A · Asignar a un día disponible</p>
                                <div className="space-y-1.5">
                                    {conflictData.recommendations.alternative_days.map((day) => (
                                        <button
                                            key={day.date}
                                            type="button"
                                            onClick={() => setSelectedAltDay(prev => prev?.date === day.date ? null : day)}
                                            className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs transition ${
                                                selectedAltDay?.date === day.date
                                                    ? "bg-violet-600/20 border-violet-500/50 text-violet-300"
                                                    : "bg-slate-800 border-slate-700 text-slate-300 hover:border-violet-500/30"
                                            }`}
                                        >
                                            <span className="font-semibold">
                                                {new Date(day.date + "T00:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
                                            </span>
                                            <span className="text-slate-400 ml-2">{day.available_hours}h libres</span>
                                        </button>
                                    ))}
                                </div>
                                {selectedAltDay && (
                                    <button
                                        type="button"
                                        onClick={doCreateOnAltDay}
                                        disabled={isLoading}
                                        className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold py-2.5 rounded-xl transition"
                                    >
                                        Asignar al {new Date(selectedAltDay.date + "T00:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "long" })}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <p className="text-slate-500 text-xs italic">No hay días con espacio disponible en los próximos 7 días.</p>
                        )}

                        {/* ── Opción B: Desplazar tarea de menor prioridad ── */}
                        {conflictData.recommendations?.displaceable_tasks && conflictData.recommendations.displaceable_tasks.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-slate-300 text-xs font-semibold uppercase tracking-wide">B · Mover una tarea de menor prioridad</p>
                                <div className="space-y-1.5">
                                    {conflictData.recommendations.displaceable_tasks.map((t) => {
                                        const priorityColors: Record<string, string> = {
                                            alta: "text-red-400", media: "text-amber-400", baja: "text-emerald-400"
                                        };
                                        return (
                                            <button
                                                key={t.task_id}
                                                type="button"
                                                onClick={() => setSelectedDisplaceable(prev => prev?.task_id === t.task_id ? null : t)}
                                                className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs transition ${
                                                    selectedDisplaceable?.task_id === t.task_id
                                                        ? "bg-amber-500/15 border-amber-500/40 text-amber-200"
                                                        : "bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-500/30"
                                                }`}
                                            >
                                                <span className="font-semibold truncate block">{t.title}</span>
                                                <span className={`${priorityColors[t.priority] ?? "text-slate-400"} mr-2`}>{t.priority}</span>
                                                <span className="text-slate-500">{Math.round(t.duration_minutes / 60 * 10) / 10}h</span>
                                                {t.suggested_new_date && (
                                                    <span className="text-slate-500 ml-2">→ {new Date(t.suggested_new_date + "T00:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "long" })}</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                {selectedDisplaceable && selectedDisplaceable.suggested_new_date && (
                                    <button
                                        type="button"
                                        onClick={doDisplaceAndCreate}
                                        disabled={displacingTask}
                                        className="w-full bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 text-xs font-semibold py-2.5 rounded-xl transition disabled:opacity-40"
                                    >
                                        {displacingTask ? "Moviendo..." : `Mover "${selectedDisplaceable.title}" y crear aquí`}
                                    </button>
                                )}
                                {selectedDisplaceable && !selectedDisplaceable.suggested_new_date && (
                                    <p className="text-slate-500 text-xs italic">No hay espacio disponible para mover esa tarea en los próximos 7 días.</p>
                                )}
                            </div>
                        )}

                        {/* ── Opciones C y D ── */}
                        <div className="flex gap-2 pt-1 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={doCreate}
                                className="flex-1 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-slate-300 text-xs font-semibold py-2.5 rounded-xl transition"
                            >
                                C · Crear de todas formas
                            </button>
                            <button
                                type="button"
                                onClick={() => { setConflictData(null); setSelectedAltDay(null); setSelectedDisplaceable(null); }}
                                className="flex-1 text-slate-400 hover:text-white text-xs py-2.5 rounded-xl hover:bg-slate-800 transition"
                            >
                                D · Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}