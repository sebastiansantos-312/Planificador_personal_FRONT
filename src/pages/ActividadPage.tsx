/**
 * pages/ActividadPage.tsx — Detalle de una tarea (ruta /actividad/:id).
 * Sprint 3: Reprogramación + conflicto.
 * Sprint 4: Registrar avance (hecha/pospuesta con nota) + feedback visual.
 * Sprint 5: Edición inline de la tarea principal.
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { taskService } from "../services/taskService";
import { subtaskService } from "../services/subtaskService";
import { subjectService } from "../services/subjectService";
import { authService } from "../services/authService";
import type { Task, Subtask, Subject, TaskStatus, TaskPriority, TaskType, LoadingState, ConflictResult } from "../types";

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
    { value: "pending", label: "Pendiente" },
    { value: "in_progress", label: "En progreso" },
    { value: "done", label: "Completada" },
];

const TASK_TYPES_LIST: { value: TaskType; label: string; icon: string }[] = [
    { value: "examen", label: "Examen", icon: "📝" },
    { value: "quiz", label: "Quiz", icon: "❓" },
    { value: "taller", label: "Taller", icon: "🔧" },
    { value: "proyecto", label: "Proyecto", icon: "📁" },
    { value: "exposición", label: "Exposición", icon: "🎤" },
    { value: "otro", label: "Otro", icon: "📌" },
];

const PRIORITY_LIST: { value: TaskPriority; label: string; activeClass: string }[] = [
    { value: "alta", label: "Alta", activeClass: "bg-red-500/20 text-red-400 border-red-500/40" },
    { value: "media", label: "Media", activeClass: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
    { value: "baja", label: "Baja", activeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
];

const PRIORITY_STYLES: Record<string, string> = {
    alta: "bg-red-500/15 text-red-400 border-red-500/30",
    media: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    baja: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const STATUS_ACTIVE_STYLES: Record<string, string> = {
    pending: "bg-slate-600 border-slate-500 text-white",
    in_progress: "bg-violet-600 border-violet-500 text-white shadow-md shadow-violet-500/20",
    done: "bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-500/20",
};

const TASK_TYPE_ICONS: Record<string, string> = {
    examen: "📝", quiz: "❓", taller: "🔧",
    proyecto: "📁", exposición: "🎤", otro: "📌",
};

// Estilos por estado de subtarea
const SUBTASK_STATUS_STYLES: Record<string, string> = {
    done: "bg-emerald-500/10 border-emerald-500/20",
    postponed: "bg-amber-500/10 border-amber-500/20",
    pending: "",
};

interface ConflictModal {
    sub: Subtask;
    newDate: string;
    conflict: ConflictResult;
}

export default function ActividadPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const session = authService.getSession();

    const [task, setTask] = useState<Task | null>(null);
    const [subject, setSubject] = useState<Subject | null>(null);
    const [subtasks, setSubtasks] = useState<Subtask[]>([]);
    const [loadState, setLoadState] = useState<LoadingState>("loading");
    const [errorMsg, setErrorMsg] = useState("");
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [deletingTask, setDeletingTask] = useState(false);

    // Edición inline de la tarea principal
    const [editingTask, setEditingTask] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editDueDate, setEditDueDate] = useState("");
    const [editDuration, setEditDuration] = useState(0);
    const [editPriority, setEditPriority] = useState<TaskPriority>("media");
    const [editTaskType, setEditTaskType] = useState<TaskType | "">("otro");
    const [editSubjectId, setEditSubjectId] = useState("");
    const [savingTask, setSavingTask] = useState(false);

    // Materias disponibles para el selector en modo edición
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loadingSubjects, setLoadingSubjects] = useState(false);

    // Modal de advertencia de límite diario (al guardar edición)
    const [editConflictData, setEditConflictData] = useState<ConflictResult | null>(null);
    const [pendingEditSave, setPendingEditSave] = useState(false);

    // Sprint 3: reprogramar fecha del paso
    const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
    const [editDate, setEditDate] = useState("");
    const [editMinutes, setEditMinutes] = useState<number>(0);
    const [rescheduling, setRescheduling] = useState(false);
    const [conflictModal, setConflictModal] = useState<ConflictModal | null>(null);
    const [reducedMinutes, setReducedMinutes] = useState<number>(0);
    const [altDate, setAltDate] = useState("");
    const [resolvingConflict, setResolvingConflict] = useState(false);

    // Editar título/descripción de un paso
    const [editingContentId, setEditingContentId] = useState<string | null>(null);
    const [editSubTitle, setEditSubTitle] = useState("");
    const [editSubDesc, setEditSubDesc] = useState("");
    const [savingContent, setSavingContent] = useState(false);

    // Agregar nuevo paso
    const [showAddStep, setShowAddStep] = useState(false);
    const [newStepTitle, setNewStepTitle] = useState("");
    const [newStepDesc, setNewStepDesc] = useState("");
    const [newStepDate, setNewStepDate] = useState("");
    const [newStepMinutes, setNewStepMinutes] = useState(30);
    const [addingStep, setAddingStep] = useState(false);

    // Eliminar paso
    const [deletingSubtaskId, setDeletingSubtaskId] = useState<string | null>(null);

    // Sprint 4: posponer con nota
    const [postponingId, setPostponingId] = useState<string | null>(null);
    const [postponeNote, setPostponeNote] = useState("");
    const [savingAdvance, setSavingAdvance] = useState<string | null>(null);

    // Sprint 4: feedback visual al cambiar estado
    const [recentFeedback, setRecentFeedback] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!session) { navigate("/auth"); return; }
        if (!id) return;
        load(id);
    }, [id]);

    async function load(taskId: string) {
        setLoadState("loading");
        try {
            const t = await taskService.getById(taskId);
            setTask(t);
            const [subs, s] = await Promise.all([
                subtaskService.getByTask(taskId),
                t.subject_id ? subjectService.getById(t.subject_id) : Promise.resolve(null),
            ]);
            setSubtasks(subs);
            setSubject(s);
            setLoadState("success");
        } catch {
            setLoadState("error");
            setErrorMsg("No se pudo cargar la actividad.");
        }
    }

    async function updateTaskStatus(status: TaskStatus) {
        if (!task) return;
        setUpdatingStatus(true);
        try {
            const updated = await taskService.update(task.id, { status });
            setTask(updated);
        } catch {/* ignore */ }
        finally { setUpdatingStatus(false); }
    }

    function startEditingTask() {
        if (!task) return;
        setEditTitle(task.title);
        setEditDueDate(task.due_date ?? "");
        setEditDuration(task.duration_minutes ?? 60);
        setEditPriority((task.priority as TaskPriority) ?? "media");
        setEditTaskType((task.task_type as TaskType) ?? "otro");
        setEditSubjectId(task.subject_id ?? "");
        setEditingTask(true);
        setEditConflictData(null);
        // Cargar materias si aún no se han cargado
        if (subjects.length === 0 && session) {
            setLoadingSubjects(true);
            subjectService.getByEmail(session.email)
                .then(setSubjects)
                .catch(() => {})
                .finally(() => setLoadingSubjects(false));
        }
    }

    async function saveTaskEdits() {
        if (!task || !editTitle.trim() || !editDueDate || !session) return;

        // Verificar límite diario antes de guardar
        if (editDueDate && editDuration > 0 && !pendingEditSave) {
            try {
                const result = await taskService.checkConflict(
                    task.id,
                    editDueDate,
                    editDuration,
                    session.user_id
                );
                if (result.has_conflict) {
                    setEditConflictData(result);
                    setPendingEditSave(true);
                    return; // Esperar decisión del usuario en el modal
                }
            } catch { /* si falla, continuar guardando */ }
        }

        await doSaveTaskEdits();
    }

    /** Ejecuta la actualización real (tras confirmar en modal o sin conflicto). */
    async function doSaveTaskEdits() {
        if (!task || !editTitle.trim() || !editDueDate) return;
        setEditConflictData(null);
        setPendingEditSave(false);
        setSavingTask(true);
        try {
            const updated = await taskService.update(task.id, {
                title: editTitle.trim(),
                due_date: editDueDate,
                duration_minutes: editDuration,
                priority: editPriority,
                task_type: editTaskType || undefined,
                // Envía null explícito para limpiar la materia cuando se desmarca
                subject_id: editSubjectId || null,
            });
            setTask(updated);
            // Actualizar subject mostrado localmente
            if (editSubjectId) {
                const s = subjects.find(x => x.id === editSubjectId) ?? null;
                setSubject(s);
            } else {
                setSubject(null);
            }
            setEditingTask(false);
        } catch {/* ignore */}
        finally { setSavingTask(false); }
    }

    async function deleteTask() {
        if (!task) return;
        if (!confirm("¿Eliminar esta actividad y todas sus subtareas?")) return;
        setDeletingTask(true);
        try {
            await taskService.delete(task.id);
            navigate("/hoy");
        } catch { setDeletingTask(false); }
    }

    // ── Sprint 4: marcar como hecha ──────────────────────────────────────────

    async function markDone(sub: Subtask) {
        const newStatus = sub.status === "done" ? "pending" : "done";
        setSavingAdvance(sub.id);
        try {
            const updated = await subtaskService.update(sub.id, {
                status: newStatus,
                postpone_note: newStatus === "pending" ? "" : undefined,
            });
            setSubtasks((prev) => prev.map((s) => s.id === sub.id ? updated : s));
            // Feedback visual temporal
            if (newStatus === "done") {
                setRecentFeedback((prev) => ({ ...prev, [sub.id]: "done" }));
                setTimeout(() => setRecentFeedback((prev) => { const n = { ...prev }; delete n[sub.id]; return n; }), 2000);
            }
        } catch {/* ignore */ }
        finally { setSavingAdvance(null); }
    }

    // ── Sprint 4: abrir panel de posponer ────────────────────────────────────

    function startPostpone(sub: Subtask) {
        setPostponingId(sub.id);
        setPostponeNote(sub.postpone_note ?? "");
        cancelEditing();
    }

    function cancelPostpone() {
        setPostponingId(null);
        setPostponeNote("");
    }

    // ── Sprint 4: confirmar posponer ─────────────────────────────────────────

    async function confirmPostpone(sub: Subtask) {
        setSavingAdvance(sub.id);
        try {
            const updated = await subtaskService.update(sub.id, {
                status: "postponed",
                postpone_note: postponeNote || undefined,
            });
            setSubtasks((prev) => prev.map((s) => s.id === sub.id ? updated : s));
            setRecentFeedback((prev) => ({ ...prev, [sub.id]: "postponed" }));
            setTimeout(() => setRecentFeedback((prev) => { const n = { ...prev }; delete n[sub.id]; return n; }), 2000);
            cancelPostpone();
        } catch {/* ignore */ }
        finally { setSavingAdvance(null); }
    }

    // ── Sprint 4: volver a pendiente ─────────────────────────────────────────

    async function markPending(sub: Subtask) {
        setSavingAdvance(sub.id);
        try {
            const updated = await subtaskService.update(sub.id, {
                status: "pending",
                postpone_note: "",
            });
            setSubtasks((prev) => prev.map((s) => s.id === sub.id ? updated : s));
        } catch {/* ignore */ }
        finally { setSavingAdvance(null); }
    }

    // ── Sprint 3: editar fecha ───────────────────────────────────────────────

    function startEditing(sub: Subtask) {
        setEditingSubtaskId(sub.id);
        setEditDate(sub.target_date ?? "");
        setEditMinutes(sub.estimated_minutes ?? 0);
        setConflictModal(null);
        cancelPostpone();
        setEditingContentId(null);
    }

    function cancelEditing() {
        setEditingSubtaskId(null);
        setEditDate("");
        setEditMinutes(0);
    }

    // ── Editar título/descripción del paso ───────────────────────────────────

    function startEditingContent(sub: Subtask) {
        setEditingContentId(sub.id);
        setEditSubTitle(sub.title);
        setEditSubDesc(sub.description ?? "");
        setEditingSubtaskId(null);
        cancelPostpone();
    }

    function cancelEditingContent() {
        setEditingContentId(null);
        setEditSubTitle("");
        setEditSubDesc("");
    }

    async function saveSubtaskContent(sub: Subtask) {
        if (!editSubTitle.trim()) return;
        setSavingContent(true);
        try {
            const updated = await subtaskService.update(sub.id, {
                title: editSubTitle.trim(),
                description: editSubDesc.trim() || undefined,
            });
            setSubtasks(prev => prev.map(s => s.id === sub.id ? updated : s));
            cancelEditingContent();
        } catch {/* ignore */}
        finally { setSavingContent(false); }
    }

    // ── Eliminar paso ────────────────────────────────────────────────────────

    async function deleteSubtask(subtaskId: string) {
        if (!confirm("¿Eliminar este paso?")) return;
        setDeletingSubtaskId(subtaskId);
        try {
            await subtaskService.delete(subtaskId);
            setSubtasks(prev => prev.filter(s => s.id !== subtaskId));
        } catch {/* ignore */}
        finally { setDeletingSubtaskId(null); }
    }

    // ── Agregar nuevo paso ───────────────────────────────────────────────────

    async function addSubtask() {
        if (!task || !newStepTitle.trim() || !newStepDate) return;
        setAddingStep(true);
        try {
            const created = await subtaskService.create({
                task_id: task.id,
                title: newStepTitle.trim(),
                description: newStepDesc.trim() || undefined,
                target_date: newStepDate,
                estimated_minutes: newStepMinutes,
                status: "pending",
            });
            setSubtasks(prev => [...prev, created]);
            setNewStepTitle("");
            setNewStepDesc("");
            setNewStepDate("");
            setNewStepMinutes(30);
            setShowAddStep(false);
        } catch {/* ignore */}
        finally { setAddingStep(false); }
    }

    async function handleReschedule(sub: Subtask) {
        if (!session || !editDate) return;
        setRescheduling(true);
        try {
            const conflict = await subtaskService.checkConflict(sub.id, editDate, editMinutes, session.user_id);
            if (conflict.has_conflict) {
                setConflictModal({ sub, newDate: editDate, conflict });
                setReducedMinutes(editMinutes);
                setAltDate(editDate);
                setRescheduling(false);
                return;
            }
            await saveReschedule(sub.id, editDate, editMinutes);
        } catch { setRescheduling(false); }
    }

    async function saveReschedule(subtaskId: string, newDate: string, newMinutes: number) {
        try {
            const updated = await subtaskService.update(subtaskId, { target_date: newDate, estimated_minutes: newMinutes });
            setSubtasks((prev) => prev.map((s) => s.id === subtaskId ? updated : s));
            setEditingSubtaskId(null);
            setConflictModal(null);
            setEditDate("");
            setEditMinutes(0);
        } catch {/* ignore */ }
        finally { setRescheduling(false); }
    }

    async function resolveForce() {
        if (!conflictModal) return;
        setResolvingConflict(true);
        const mins = conflictModal.conflict.new_total_minutes - conflictModal.conflict.current_minutes;
        await saveReschedule(conflictModal.sub.id, conflictModal.newDate, mins);
        setResolvingConflict(false);
    }

    async function resolveMove() {
        if (!conflictModal || !altDate) return;
        setResolvingConflict(true);
        try {
            const mins = conflictModal.conflict.new_total_minutes - conflictModal.conflict.current_minutes;
            const check = await subtaskService.checkConflict(conflictModal.sub.id, altDate, mins, session!.user_id);
            if (check.has_conflict) { setConflictModal({ ...conflictModal, newDate: altDate, conflict: check }); setResolvingConflict(false); return; }
            await saveReschedule(conflictModal.sub.id, altDate, mins);
        } catch { setResolvingConflict(false); }
    }

    async function resolveReduce() {
        if (!conflictModal) return;
        setResolvingConflict(true);
        await saveReschedule(conflictModal.sub.id, conflictModal.newDate, reducedMinutes);
        setResolvingConflict(false);
    }

    // ── Render ───────────────────────────────────────────────────────────────

    if (loadState === "loading") {
        return (
            <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
                <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (loadState === "error" || !task) {
        return (
            <div className="flex flex-col items-center py-24 gap-4" role="alert">
                <span className="text-4xl">⚠️</span>
                <p className="text-slate-300">{errorMsg}</p>
                <button onClick={() => navigate("/hoy")} className="bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-violet-500 transition">
                    Volver al inicio
                </button>
            </div>
        );
    }

    const dueDate = new Date(task.due_date + "T00:00:00");
    const formattedDate = dueDate.toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const hours = Math.floor((task.duration_minutes ?? 0) / 60);
    const mins = (task.duration_minutes ?? 0) % 60;
    const durationLabel = hours > 0 ? `${hours}h ${mins > 0 ? mins + "m" : ""}` : `${mins}m`;
    const completedCount = subtasks.filter((s) => s.status === "done").length;
    const postponedCount = subtasks.filter((s) => s.status === "postponed").length;
    const progress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : null;

    return (
        <div className="space-y-6 pb-10">

            {/* Modal de conflicto — Sprint 3 */}
            {conflictModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">⚠️</span>
                            <div>
                                <h2 className="text-white font-bold text-base">Día con sobrecarga</h2>
                                <p className="text-slate-400 text-sm mt-1">{conflictModal.conflict.message}</p>
                            </div>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm space-y-1">
                            <div className="flex justify-between text-slate-300"><span>Ya planificadas ese día</span><span className="font-medium">{conflictModal.conflict.current_hours}h</span></div>
                            <div className="flex justify-between text-red-400"><span>Total si agregas esta subtarea</span><span className="font-bold">{conflictModal.conflict.new_total_hours}h</span></div>
                            <div className="flex justify-between text-slate-400"><span>Tu límite diario</span><span>{conflictModal.conflict.limit_hours}h</span></div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-slate-300 text-sm font-medium">Opción 1 — Mover a otro día</p>
                            <div className="flex gap-2">
                                <input type="date" value={altDate} onChange={(e) => setAltDate(e.target.value)} className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                                <button onClick={resolveMove} disabled={resolvingConflict || !altDate} className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">Mover</button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-slate-300 text-sm font-medium">Opción 2 — Reducir minutos estimados</p>
                            <div className="flex gap-2 items-center">
                                <input type="number" min={5} max={conflictModal.conflict.limit_minutes - conflictModal.conflict.current_minutes} value={reducedMinutes} onChange={(e) => setReducedMinutes(Number(e.target.value))} className="w-24 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                                <span className="text-slate-500 text-sm">min (máx. {conflictModal.conflict.limit_minutes - conflictModal.conflict.current_minutes} sin conflicto)</span>
                            </div>
                            <button onClick={resolveReduce} disabled={resolvingConflict || reducedMinutes <= 0} className="w-full bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-400 text-sm font-semibold py-2 rounded-xl transition disabled:opacity-40">
                                Guardar con {reducedMinutes} min
                            </button>
                        </div>
                        <div className="pt-2 border-t border-slate-800 flex gap-2">
                            <button onClick={resolveForce} disabled={resolvingConflict} className="flex-1 text-slate-500 hover:text-slate-300 text-sm py-2 rounded-xl hover:bg-slate-800 transition disabled:opacity-40">Guardar de todas formas</button>
                            <button onClick={() => { setConflictModal(null); cancelEditing(); }} className="flex-1 text-slate-500 hover:text-slate-300 text-sm py-2 rounded-xl hover:bg-slate-800 transition">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-slate-300 text-sm flex items-center gap-1 transition rounded">
                ← Volver
            </button>

            {/* Tarjeta principal */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">

                {/* ── Modo lectura ── */}
                {!editingTask && (
                    <>
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                {subject && (
                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full inline-block mb-2"
                                        style={{ backgroundColor: subject.color + "25", color: subject.color }}>
                                        {subject.name}
                                    </span>
                                )}
                                <h1 className="text-white text-xl font-bold leading-snug">{task.title}</h1>
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                                {task.priority && (
                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${PRIORITY_STYLES[task.priority] ?? ""}`}>
                                        {task.priority}
                                    </span>
                                )}
                                <button
                                    onClick={startEditingTask}
                                    className="text-slate-500 hover:text-violet-400 text-xs flex items-center gap-1 transition px-2 py-1 rounded-lg hover:bg-slate-800"
                                >
                                    ✏️ Editar
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                            {task.due_date && <span>📅 {formattedDate}</span>}
                            {task.duration_minutes && <span>⏱ {durationLabel}</span>}
                            {task.task_type && <span className="capitalize">{TASK_TYPE_ICONS[task.task_type] ?? "🏷"} {task.task_type}</span>}
                        </div>
                    </>
                )}

                {/* ── Modo edición ── */}
                {editingTask && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-slate-300 text-sm font-semibold">Editar actividad</p>
                            <button onClick={() => { setEditingTask(false); setEditConflictData(null); setPendingEditSave(false); }}
                                className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 rounded-lg hover:bg-slate-800 transition">
                                ✕ Cancelar
                            </button>
                        </div>

                        {/* Título */}
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Título *</label>
                            <input
                                type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                            />
                        </div>

                        {/* Fecha y duración */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Fecha límite *</label>
                                <input
                                    type="date" value={editDueDate}
                                    onChange={e => { setEditDueDate(e.target.value); setEditConflictData(null); setPendingEditSave(false); }}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Duración (min)</label>
                                <input
                                    type="number" min={5} value={editDuration}
                                    onChange={e => { setEditDuration(Number(e.target.value)); setEditConflictData(null); setPendingEditSave(false); }}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                                />
                            </div>
                        </div>

                        {/* Tipo */}
                        <div>
                            <p className="text-xs font-medium text-slate-400 mb-1.5">Tipo de actividad</p>
                            <div className="flex flex-wrap gap-1.5">
                                {TASK_TYPES_LIST.map(({ value, label, icon }) => (
                                    <button key={value} type="button" onClick={() => setEditTaskType(value)}
                                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition
                                            ${editTaskType === value
                                                ? "bg-violet-600/20 text-violet-300 border-violet-500/50"
                                                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"}`}
                                    >
                                        {icon} {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Materia */}
                        <div>
                            <p className="text-xs font-medium text-slate-400 mb-1.5">
                                Materia <span className="text-slate-600">(opcional)</span>
                            </p>
                            {loadingSubjects ? (
                                <div className="h-8 bg-slate-800 rounded-xl animate-pulse" />
                            ) : subjects.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {subjects.map((s) => (
                                        <button
                                            key={s.id} type="button"
                                            onClick={() => setEditSubjectId(prev => prev === s.id ? "" : s.id)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition
                                                ${editSubjectId === s.id
                                                    ? "border-transparent text-white"
                                                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"}`}
                                            style={editSubjectId === s.id ? { backgroundColor: s.color } : {}}
                                            title={editSubjectId === s.id ? "Click para quitar" : s.name}
                                        >
                                            {s.name}{editSubjectId === s.id && <span className="ml-1 opacity-70">✕</span>}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>

                        {/* Prioridad */}
                        <div>
                            <p className="text-xs font-medium text-slate-400 mb-1.5">Prioridad</p>
                            <div className="flex gap-2">
                                {PRIORITY_LIST.map(({ value, label, activeClass }) => (
                                    <button key={value} type="button" onClick={() => setEditPriority(value)}
                                        className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition
                                            ${editPriority === value ? activeClass : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Modal inline de conflicto de horas */}
                        {editConflictData && (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
                                <div className="flex items-start gap-2">
                                    <span className="text-lg shrink-0">⚠️</span>
                                    <div>
                                        <p className="text-amber-300 font-semibold text-sm">Límite diario superado</p>
                                        <p className="text-slate-400 text-xs mt-0.5">Ese día ya tiene muchas horas planificadas.</p>
                                    </div>
                                </div>
                                <div className="text-xs space-y-1">
                                    <div className="flex justify-between text-slate-400">
                                        <span>Ya planificadas ese día</span>
                                        <span className="font-semibold text-white">{editConflictData.current_hours}h</span>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Límite configurado</span>
                                        <span className="font-semibold text-white">{editConflictData.limit_hours}h</span>
                                    </div>
                                    <div className="flex justify-between border-t border-slate-700 pt-1 text-amber-400">
                                        <span>Total con esta actividad</span>
                                        <span className="font-bold">{editConflictData.new_total_hours}h</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={doSaveTaskEdits}
                                        disabled={savingTask}
                                        className="flex-1 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 text-xs font-semibold py-2 rounded-lg transition disabled:opacity-40"
                                    >
                                        Guardar de todas formas
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setEditConflictData(null); setPendingEditSave(false); }}
                                        className="flex-1 text-slate-400 hover:text-white text-xs py-2 rounded-lg hover:bg-slate-800 transition"
                                    >
                                        Cambiar fecha
                                    </button>
                                </div>
                            </div>
                        )}

                        {!editConflictData && (
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={saveTaskEdits}
                                    disabled={savingTask || !editTitle.trim() || !editDueDate}
                                    className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl transition"
                                >
                                    {savingTask ? "Guardando..." : "Guardar cambios"}
                                </button>
                                <button onClick={() => { setEditingTask(false); setEditConflictData(null); setPendingEditSave(false); }}
                                    className="flex-1 text-slate-400 hover:text-white text-sm py-2.5 rounded-xl hover:bg-slate-800 transition">
                                    Cancelar
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Progreso — siempre visible */}
                {progress !== null && (
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>Progreso de subtareas</span>
                            <span className="flex gap-2">
                                <span className="text-emerald-400">{completedCount} hechas</span>
                                {postponedCount > 0 && <span className="text-amber-400">{postponedCount} pospuestas</span>}
                                <span>/ {subtasks.length} total</span>
                            </span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 rounded-l-full"
                                style={{ width: `${progress}%` }}
                                role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
                            />
                            {postponedCount > 0 && (
                                <div className="h-full bg-amber-500/60 transition-all duration-500"
                                    style={{ width: `${Math.round((postponedCount / subtasks.length) * 100)}%` }}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* Estado — siempre visible */}
                <div>
                    <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Estado</p>
                    <div className="flex gap-2 flex-wrap">
                        {STATUS_OPTIONS.map(({ value, label }) => (
                            <button key={value} onClick={() => updateTaskStatus(value)} disabled={updatingStatus}
                                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50
                                    ${task.status === value ? STATUS_ACTIVE_STYLES[value] : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"}`}
                                aria-pressed={task.status === value}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Lista de subtareas */}
            {/* ── Lista de pasos ── */}
            <section aria-labelledby="subtasks-heading">
                <div className="flex items-center justify-between mb-3">
                    <h2 id="subtasks-heading" className="text-sm font-semibold text-slate-400 uppercase tracking-widest">
                        Pasos {subtasks.length > 0 && `(${completedCount}/${subtasks.length})`}
                    </h2>
                    {!showAddStep && (
                        <button
                            onClick={() => setShowAddStep(true)}
                            className="text-violet-400 hover:text-violet-300 text-xs font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-violet-500/10 transition"
                        >
                            + Agregar paso
                        </button>
                    )}
                </div>

                {subtasks.length === 0 && !showAddStep && (
                    <p className="text-slate-600 text-sm italic py-4 pl-1">Esta actividad no tiene pasos aún.</p>
                )}

                <div className="space-y-2">
                    {subtasks.map((sub) => {
                        const isDone = sub.status === "done";
                        const isPostponed = sub.status === "postponed";
                        const isEditing = editingSubtaskId === sub.id;
                        const isEditingContent = editingContentId === sub.id;
                        const isPostponing = postponingId === sub.id;
                        const isSaving = savingAdvance === sub.id;
                        const isDeleting = deletingSubtaskId === sub.id;
                        const feedback = recentFeedback[sub.id];

                        return (
                            <div key={sub.id}
                                className={`border rounded-2xl p-4 transition-all duration-300 ${SUBTASK_STATUS_STYLES[sub.status ?? "pending"] || "bg-slate-900 border-slate-800"}`}>

                                {/* Feedback temporal */}
                                {feedback && (
                                    <div className={`text-xs font-semibold mb-2 px-2 py-1 rounded-lg text-center
                                        ${feedback === "done" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                                        {feedback === "done" ? "✅ ¡Paso completado!" : "⏭ Paso pospuesto"}
                                    </div>
                                )}

                                <div className="flex items-start gap-3">
                                    {/* Checkbox */}
                                    <button
                                        onClick={() => markDone(sub)}
                                        disabled={isSaving || isPostponed || isDeleting}
                                        className={`mt-0.5 w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50
                                            ${isDone ? "bg-emerald-500 border-emerald-500" : isPostponed ? "border-amber-500/50" : "border-slate-600 hover:border-violet-400"}`}
                                        aria-label={`Marcar "${sub.title}" como ${isDone ? "pendiente" : "completada"}`}
                                        role="checkbox" aria-checked={isDone}
                                    >
                                        {isDone && <span className="text-white text-xs font-bold">✓</span>}
                                        {isPostponed && <span className="text-amber-400 text-xs">⏭</span>}
                                    </button>

                                    {/* Contenido */}
                                    <div className="flex-1 min-w-0">

                                        {/* ── Panel editar título/desc ── */}
                                        {isEditingContent ? (
                                            <div className="space-y-2">
                                                <input
                                                    type="text" value={editSubTitle}
                                                    onChange={e => setEditSubTitle(e.target.value)}
                                                    placeholder="Título del paso *"
                                                    autoFocus
                                                    className="w-full bg-slate-800 border border-violet-500/40 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                                />
                                                <input
                                                    type="text" value={editSubDesc}
                                                    onChange={e => setEditSubDesc(e.target.value)}
                                                    placeholder="Descripción (opcional)"
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                                />
                                                <div className="flex gap-2">
                                                    <button onClick={() => saveSubtaskContent(sub)} disabled={savingContent || !editSubTitle.trim()}
                                                        className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">
                                                        {savingContent ? "Guardando..." : "Guardar"}
                                                    </button>
                                                    <button onClick={cancelEditingContent}
                                                        className="text-slate-500 hover:text-slate-300 text-xs px-3 py-1.5 rounded-lg transition">
                                                        Cancelar
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <p className={`text-sm font-medium ${isDone ? "line-through text-slate-500" : isPostponed ? "text-amber-300" : "text-white"}`}>
                                                    {sub.title}
                                                </p>

                                                {isPostponed && (
                                                    <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full inline-block mt-1">
                                                        Pospuesta
                                                    </span>
                                                )}

                                                {isPostponed && sub.postpone_note && (
                                                    <p className="text-xs text-amber-300/70 mt-1 italic">📝 {sub.postpone_note}</p>
                                                )}

                                                {sub.description && !isPostponed && (
                                                    <p className="text-xs text-slate-500 mt-0.5">{sub.description}</p>
                                                )}

                                                {!isEditing && !isPostponing && (
                                                    <div className="flex gap-3 mt-1.5 text-xs text-slate-600">
                                                        {sub.target_date && <span>📅 {sub.target_date}</span>}
                                                        {sub.estimated_minutes && <span>⏱ {sub.estimated_minutes}min</span>}
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {/* Panel posponer */}
                                        {isPostponing && (
                                            <div className="mt-3 space-y-2">
                                                <label className="text-xs text-slate-400 block">
                                                    ¿Por qué pospones? <span className="text-slate-600">(opcional)</span>
                                                </label>
                                                <input type="text" value={postponeNote}
                                                    onChange={e => setPostponeNote(e.target.value)}
                                                    placeholder="Ej: Se cruzó con otro examen..."
                                                    className="w-full bg-slate-800 border border-amber-500/30 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                                                    autoFocus
                                                />
                                                <div className="flex gap-2">
                                                    <button onClick={() => confirmPostpone(sub)} disabled={isSaving}
                                                        className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">
                                                        {isSaving ? "Guardando..." : "Confirmar posposición"}
                                                    </button>
                                                    <button onClick={cancelPostpone}
                                                        className="text-slate-500 hover:text-slate-300 text-xs px-3 py-1.5 rounded-lg transition">Cancelar</button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Panel reprogramar fecha */}
                                        {isEditing && (
                                            <div className="mt-3 space-y-2">
                                                <div className="flex gap-2 flex-wrap">
                                                    <div>
                                                        <label className="text-xs text-slate-500 block mb-1">Nueva fecha</label>
                                                        <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                                                            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-slate-500 block mb-1">Minutos estimados</label>
                                                        <input type="number" min={5} value={editMinutes} onChange={e => setEditMinutes(Number(e.target.value))}
                                                            className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleReschedule(sub)} disabled={rescheduling || !editDate}
                                                        className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">
                                                        {rescheduling ? "Verificando..." : "Guardar fecha"}
                                                    </button>
                                                    <button onClick={cancelEditing}
                                                        className="text-slate-500 hover:text-slate-300 text-xs px-3 py-1.5 rounded-lg transition">Cancelar</button>
                                                </div>
                                            </div>
                                        )}

                                        {isPostponed && !isPostponing && (
                                            <button onClick={() => markPending(sub)} disabled={isSaving}
                                                className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition">
                                                ↩ Volver a pendiente
                                            </button>
                                        )}
                                    </div>

                                    {/* Botones de acción */}
                                    {!isEditingContent && !isEditing && !isPostponing && (
                                        <div className="flex gap-1 shrink-0">
                                            {!isDone && !isPostponed && (
                                                <button onClick={() => startPostpone(sub)} disabled={isSaving || isDeleting}
                                                    className="text-slate-600 hover:text-amber-400 text-sm transition rounded disabled:opacity-40"
                                                    title="Posponer" aria-label="Posponer este paso">⏭</button>
                                            )}
                                            {!isDone && !isPostponed && (
                                                <button onClick={() => startEditing(sub)} disabled={isSaving || isDeleting}
                                                    className="text-slate-600 hover:text-violet-400 text-sm transition rounded disabled:opacity-40"
                                                    title="Reprogramar fecha" aria-label="Editar fecha del paso">📅</button>
                                            )}
                                            {/* Editar título/descripción */}
                                            <button onClick={() => startEditingContent(sub)} disabled={isSaving || isDeleting}
                                                className="text-slate-600 hover:text-violet-400 text-sm transition rounded disabled:opacity-40"
                                                title="Editar nombre" aria-label="Editar nombre del paso">✏️</button>
                                            {/* Eliminar */}
                                            <button onClick={() => deleteSubtask(sub.id)} disabled={isSaving || isDeleting}
                                                className="text-slate-600 hover:text-red-400 text-sm transition rounded disabled:opacity-40"
                                                title="Eliminar paso" aria-label="Eliminar este paso">
                                                {isDeleting ? (
                                                    <span className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin inline-block" />
                                                ) : "🗑"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ── Formulario de agregar paso ── */}
                {showAddStep && (
                    <div className="mt-3 bg-slate-800/60 border border-violet-500/20 rounded-2xl p-4 space-y-3">
                        <p className="text-xs font-semibold text-slate-300">Nuevo paso</p>
                        <input
                            type="text" value={newStepTitle}
                            onChange={e => setNewStepTitle(e.target.value)}
                            placeholder="Título del paso *"
                            autoFocus
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                        />
                        <input
                            type="text" value={newStepDesc}
                            onChange={e => setNewStepDesc(e.target.value)}
                            placeholder="Descripción (opcional)"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Fecha objetivo *</label>
                                <input
                                    type="date" value={newStepDate}
                                    onChange={e => setNewStepDate(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Minutos estimados</label>
                                <input
                                    type="number" min={5} value={newStepMinutes}
                                    onChange={e => setNewStepMinutes(Number(e.target.value))}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={addSubtask}
                                disabled={addingStep || !newStepTitle.trim() || !newStepDate}
                                className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl transition"
                            >
                                {addingStep ? "Agregando..." : "Agregar paso"}
                            </button>
                            <button
                                onClick={() => { setShowAddStep(false); setNewStepTitle(""); setNewStepDesc(""); setNewStepDate(""); setNewStepMinutes(30); }}
                                className="flex-1 text-slate-400 hover:text-white text-sm py-2.5 rounded-xl hover:bg-slate-800 transition"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}
            </section>

            <div className="pt-4 border-t border-slate-800">
                <button onClick={deleteTask} disabled={deletingTask}
                    className="w-full text-red-500/70 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 text-sm font-medium py-3 rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-40">
                    {deletingTask ? "Eliminando..." : "🗑 Eliminar actividad"}
                </button>
            </div>
        </div>
    );
}