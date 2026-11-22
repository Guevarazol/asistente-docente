/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type {
  ClassroomGrade,
  ClassroomGradebook,
  IncidentLogData,
  SavedDocument,
  SchoolConfig,
  StudentGradeRecord,
  StudentProfile,
  StudentSubjectScore,
} from '../types/casm';
import {
  loadClassroomsRegistry,
  loadGradebook,
  loadIncidentsForStudent,
  saveGradebook,
} from '../db/indexedDb';

const DEFAULT_SUBJECTS = [
  'Lenguaje y Literatura',
  'Matemática',
  'Ciencia y Tecnología',
  'Estudios Sociales',
  'Inglés',
  'Educación Física',
  'Educación Artística',
  'Moral, Urbanidad y Cívica',
];

const PERIOD_OPTIONS = [
  'Trimestre 1',
  'Trimestre 2',
  'Trimestre 3',
  'Periodo 1',
  'Periodo 2',
  'Periodo 3',
  'Periodo 4',
];

const CONDUCT_OPTIONS = [
  { value: 'Excelente', label: 'Excelente (E)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { value: 'Muy Bueno', label: 'Muy Bueno (MB)', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { value: 'Bueno', label: 'Bueno (B)', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { value: 'En Proceso', label: 'En Proceso (EP)', color: 'text-orange-700 bg-orange-50 border-orange-200' },
  { value: 'Necesita Mejorar', label: 'Necesita Mejorar (NM)', color: 'text-rose-700 bg-rose-50 border-rose-200' },
];

interface AcademicPerformanceModuleProps {
  config: SchoolConfig;
  initialDocument?: SavedDocument<ClassroomGradebook> | null;
}

export const AcademicPerformanceModule: React.FC<AcademicPerformanceModuleProps> = ({
  config,
  initialDocument,
}) => {
  const [classrooms, setClassrooms] = useState<ClassroomGrade[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
  const [period, setPeriod] = useState<string>('Trimestre 1');
  const [subjects, setSubjects] = useState<string[]>(DEFAULT_SUBJECTS);
  const [records, setRecords] = useState<StudentGradeRecord[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [semaphoreFilter, setSemaphoreFilter] = useState<'all' | 'green' | 'yellow' | 'red'>('all');

  // New subject modal
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');

  // Detailed subject score editor modal
  const [editingStudentScore, setEditingStudentScore] = useState<{
    studentId: string;
    studentName: string;
    subjectName: string;
  } | null>(null);

  // Student incident report modal
  const [selectedIncidentReport, setSelectedIncidentReport] = useState<{
    studentName: string;
    incidents: SavedDocument<IncidentLogData>[];
  } | null>(null);

  // Map of studentId -> list of incidents loaded from Bitácora
  const [incidentsMap, setIncidentsMap] = useState<Record<string, SavedDocument<IncidentLogData>[]>>({});

  // Individual Report Card modal for printing
  const [printingStudent, setPrintingStudent] = useState<StudentGradeRecord | null>(null);

  // 1. Load available classrooms
  useEffect(() => {
    void loadClassroomsRegistry().then((cls) => {
      setClassrooms(cls);
      if (initialDocument?.data?.classroomId) {
        setSelectedClassroomId(initialDocument.data.classroomId);
        if (initialDocument.data.period) setPeriod(initialDocument.data.period);
        if (initialDocument.data.subjects?.length) setSubjects(initialDocument.data.subjects);
        if (initialDocument.data.records?.length) setRecords(initialDocument.data.records);
      } else if (cls.length > 0) {
        setSelectedClassroomId(cls[0].id);
      }
    });
  }, [initialDocument]);

  const activeClassroom = useMemo(() => {
    return classrooms.find((c) => c.id === selectedClassroomId) || null;
  }, [classrooms, selectedClassroomId]);

  // 2. Load gradebook or populate from active classroom
  useEffect(() => {
    if (!selectedClassroomId) return;
    const currentClass = classrooms.find((c) => c.id === selectedClassroomId);
    if (!currentClass) return;

    void loadGradebook(selectedClassroomId, period).then(async (saved) => {
      let finalRecords: StudentGradeRecord[] = [];

      if (saved && saved.records && saved.records.length > 0) {
        // Merge with any new students added to the classroom
        const existingIds = new Set(saved.records.map((r) => r.studentId));
        finalRecords = [...saved.records];

        for (const student of currentClass.students) {
          if (!existingIds.has(student.id)) {
            finalRecords.push({
              studentId: student.id,
              studentName: student.fullName,
              period,
              scores: {},
              conductScore: 'Muy Bueno',
              absences: 0,
            });
          }
        }
        if (saved.subjects && saved.subjects.length > 0) {
          setSubjects(saved.subjects);
        }
      } else {
        // Initialize records from active classroom students
        finalRecords = currentClass.students.map((student) => ({
          studentId: student.id,
          studentName: student.fullName,
          period,
          scores: {},
          conductScore: 'Muy Bueno',
          absences: 0,
        }));
      }

      setRecords(finalRecords);

      // Load incidents from Bitácora for all students in parallel
      const incMap: Record<string, SavedDocument<IncidentLogData>[]> = {};
      await Promise.all(
        currentClass.students.map(async (st) => {
          try {
            const list = await loadIncidentsForStudent(st.fullName);
            if (list.length > 0) {
              incMap[st.id] = list;
            }
          } catch {
            // ignore
          }
        })
      );
      setIncidentsMap(incMap);
    });
  }, [selectedClassroomId, period, classrooms]);

  // Compute student subject score helper
  const getSubjectScore = (record: StudentGradeRecord, subj: string): number | null => {
    const s = record.scores?.[subj];
    if (!s) return null;
    if (typeof s.score === 'number' && !Number.isNaN(s.score)) return s.score;
    if (s.act1 !== undefined || s.act2 !== undefined || s.exam !== undefined) {
      const a1 = s.act1 ?? 0;
      const a2 = s.act2 ?? 0;
      const ex = s.exam ?? 0;
      return Math.round((a1 * 0.35 + a2 * 0.35 + ex * 0.30) * 10) / 10;
    }
    return null;
  };

  // Compute overall average for student
  const getStudentAverage = (record: StudentGradeRecord): number | null => {
    const validScores: number[] = [];
    for (const sub of subjects) {
      const val = getSubjectScore(record, sub);
      if (val !== null) validScores.push(val);
    }
    if (validScores.length === 0) return null;
    const sum = validScores.reduce((acc, v) => acc + v, 0);
    return Math.round((sum / validScores.length) * 10) / 10;
  };

  // Traffic light classification: Green >= 7.0, Yellow 6.0-6.9, Red < 6.0
  const getTrafficStatus = (avg: number | null): 'green' | 'yellow' | 'red' | 'none' => {
    if (avg === null) return 'none';
    if (avg >= 7.0) return 'green';
    if (avg >= 6.0) return 'yellow';
    return 'red';
  };

  // Update direct score for a subject
  const handleScoreChange = (studentId: string, subjectName: string, valueStr: string) => {
    const val = valueStr === '' ? undefined : parseFloat(valueStr);
    const clamped = val !== undefined ? Math.min(10, Math.max(0, val)) : undefined;

    setRecords((prev) =>
      prev.map((rec) => {
        if (rec.studentId !== studentId) return rec;
        const currentScores = { ...(rec.scores || {}) };
        const currentSubj = currentScores[subjectName] || { subjectName };
        currentScores[subjectName] = {
          ...currentSubj,
          score: clamped,
        };
        return {
          ...rec,
          scores: currentScores,
        };
      })
    );
  };

  // Update conduct
  const handleConductChange = (studentId: string, conduct: string) => {
    setRecords((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, conductScore: conduct } : r))
    );
  };

  // Update absences
  const handleAbsencesChange = (studentId: string, absencesStr: string) => {
    const n = parseInt(absencesStr, 10);
    setRecords((prev) =>
      prev.map((r) =>
        r.studentId === studentId ? { ...r, absences: Number.isNaN(n) ? 0 : Math.max(0, n) } : r
      )
    );
  };

  // Add custom subject
  const handleAddSubject = () => {
    const trimmed = newSubjectName.trim();
    if (!trimmed) return;
    if (subjects.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      alert('Esta materia ya se encuentra en la lista.');
      return;
    }
    setSubjects((prev) => [...prev, trimmed]);
    setNewSubjectName('');
    setShowAddSubjectModal(false);
  };

  // Remove subject
  const handleRemoveSubject = (subjectToRemove: string) => {
    if (
      !confirm(
        `¿Eliminar la materia "${subjectToRemove}" de este registro? Las calificaciones registradas en ella se ocultarán.`
      )
    ) {
      return;
    }
    setSubjects((prev) => prev.filter((s) => s !== subjectToRemove));
  };

  // Save gradebook
  const handleSaveGradebook = async () => {
    if (!activeClassroom) return;
    setSaving(true);
    try {
      const gradebookData: ClassroomGradebook = {
        classroomId: activeClassroom.id,
        gradeName: activeClassroom.gradeName,
        section: activeClassroom.section,
        period,
        subjects,
        records,
        updatedAt: new Date().toISOString(),
      };
      await saveGradebook(gradebookData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert('Error al guardar el libro de calificaciones: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!activeClassroom) return;
    const header = [
      'N°',
      'Alumno',
      ...subjects,
      'Promedio',
      'Estado',
      'Conducta',
      'Inasistencias',
      'Incidentes',
    ];

    const rows = records.map((r, idx) => {
      const avg = getStudentAverage(r);
      const status =
        avg === null
          ? 'Sin notas'
          : avg >= 7.0
          ? 'Sobresaliente'
          : avg >= 6.0
          ? 'En Refuerzo'
          : 'Reprobado';
      const incCount = incidentsMap[r.studentId]?.length || 0;

      return [
        idx + 1,
        `"${r.studentName}"`,
        ...subjects.map((sub) => {
          const sc = getSubjectScore(r, sub);
          return sc !== null ? sc.toFixed(1) : '-';
        }),
        avg !== null ? avg.toFixed(1) : '-',
        status,
        `"${r.conductScore || 'Bueno'}"`,
        r.absences || 0,
        incCount > 0 ? `${incCount} reportes` : 'Sin reportes',
      ].join(',');
    });

    const csvContent = '\uFEFF' + [header.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Desempeño_${activeClassroom.gradeName}_${activeClassroom.section}_${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Statistics
  const stats = useMemo(() => {
    let greenCount = 0;
    let yellowCount = 0;
    let redCount = 0;
    let unratedCount = 0;
    const validAverages: number[] = [];

    for (const r of records) {
      const avg = getStudentAverage(r);
      if (avg === null) {
        unratedCount++;
      } else {
        validAverages.push(avg);
        if (avg >= 7.0) greenCount++;
        else if (avg >= 6.0) yellowCount++;
        else redCount++;
      }
    }

    const classAverage =
      validAverages.length > 0
        ? Math.round((validAverages.reduce((a, b) => a + b, 0) / validAverages.length) * 10) / 10
        : null;

    return {
      total: records.length,
      greenCount,
      yellowCount,
      redCount,
      unratedCount,
      classAverage,
    };
  }, [records, subjects]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        if (!r.studentName.toLowerCase().includes(q)) return false;
      }
      if (semaphoreFilter !== 'all') {
        const avg = getStudentAverage(r);
        const status = getTrafficStatus(avg);
        if (status !== semaphoreFilter) return false;
      }
      return true;
    });
  }, [records, searchFilter, semaphoreFilter, subjects]);

  return (
    <div className="space-y-6">
      {/* HEADER & MAIN CONTROLS */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                Módulo 10 · MINEDUCYT
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Normativa de Evaluación Continua (70% actividades / 30% examen)
              </span>
            </div>
            <h2 className="text-xl font-black text-[#003366] mt-1 tracking-tight flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-[#FFA92D]" />
              Control de Desempeño Escolar y Calificaciones
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Administración de notas por materias, semáforo preventivo, conducta e integración con
              la Bitácora de Incidentes (Ley Crecer Juntos).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCSV}
              className="min-h-[42px] px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
              title="Descargar cuadro completo en formato Excel / CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Exportar Excel</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[42px] px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
              title="Imprimir cuadro consolidado de notas"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Imprimir Cuadro</span>
            </button>

            <button
              type="button"
              onClick={() => void handleSaveGradebook()}
              disabled={saving || !activeClassroom}
              className="min-h-[42px] px-5 rounded-xl bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-[#FFA92D]" />
              <span>{saving ? 'Guardando...' : saveSuccess ? '¡Guardado con Éxito!' : 'Guardar Notas'}</span>
            </button>
          </div>
        </div>

        {/* SELECTORS BAR: GRADO & PERIODO */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Seleccionar Grado / Sección
            </label>
            <select
              value={selectedClassroomId}
              onChange={(e) => setSelectedClassroomId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:border-[#003366]"
            >
              {classrooms.length === 0 ? (
                <option value="">No hay grados configurados (Ir a 'Mis Grados')</option>
              ) : (
                classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.gradeName} - Sección "{c.section}" ({c.students?.length || 0} alumnos)
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Periodo / Trimestre Evaluado
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:border-[#003366]"
            >
              {PERIOD_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Buscar Estudiante
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Filtrar por nombre..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-[#003366]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Filtro por Semáforo
            </label>
            <select
              value={semaphoreFilter}
              onChange={(e) => setSemaphoreFilter(e.target.value as any)}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:border-[#003366]"
            >
              <option value="all">Todos los estados ({stats.total})</option>
              <option value="green">🟢 Sobresaliente (≥ 7.0) ({stats.greenCount})</option>
              <option value="yellow">🟡 En Refuerzo (6.0 - 6.9) ({stats.yellowCount})</option>
              <option value="red">🔴 En Riesgo (&lt; 6.0) ({stats.redCount})</option>
            </select>
          </div>
        </div>
      </div>

      {/* STATS & SEMAPHORE SUMMARY BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#003366] flex items-center justify-center font-black text-sm">
            {stats.total}
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Matrícula</div>
            <div className="text-xs font-extrabold text-slate-800">Alumnos en Grado</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-emerald-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-sm">
            🟢 {stats.greenCount}
          </div>
          <div>
            <div className="text-[11px] font-bold text-emerald-700 uppercase">Sobresalientes</div>
            <div className="text-xs font-extrabold text-slate-800">Nota ≥ 7.0</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-amber-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-sm">
            🟡 {stats.yellowCount}
          </div>
          <div>
            <div className="text-[11px] font-bold text-amber-700 uppercase">En Refuerzo</div>
            <div className="text-xs font-extrabold text-slate-800">Nota 6.0 - 6.9</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-rose-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-black text-sm">
            🔴 {stats.redCount}
          </div>
          <div>
            <div className="text-[11px] font-bold text-rose-700 uppercase">En Riesgo / Reprob.</div>
            <div className="text-xs font-extrabold text-slate-800">Nota &lt; 6.0 (MINED)</div>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl p-3.5 border border-indigo-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-800 flex items-center justify-center font-black text-sm">
            {stats.classAverage !== null ? stats.classAverage.toFixed(1) : '-'}
          </div>
          <div>
            <div className="text-[11px] font-bold text-indigo-700 uppercase">Promedio Aula</div>
            <div className="text-xs font-extrabold text-slate-800">
              {stats.classAverage !== null && stats.classAverage >= 7.0
                ? 'Nivel Satisfactorio'
                : stats.classAverage !== null && stats.classAverage >= 6.0
                ? 'Nivel Aceptable'
                : 'Atención Requerida'}
            </div>
          </div>
        </div>
      </div>

      {/* SUBJECTS BAR & MANAGEMENT */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#003366]" />
            <span className="text-xs font-extrabold text-[#003366] uppercase tracking-wider">
              Materias Activas en el Grado ({subjects.length})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowAddSubjectModal(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#003366] text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar Materia Personalizada</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {subjects.map((subj) => (
            <div
              key={subj}
              className="group inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200"
            >
              <span>{subj}</span>
              <button
                type="button"
                onClick={() => handleRemoveSubject(subj)}
                className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                title={`Eliminar ${subj}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN GRADES TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-[#003366]">
              Registro de Calificaciones · {activeClassroom?.gradeName || 'Grado'} (Sección "{activeClassroom?.section || 'A'}") — {period}
            </h3>
            <p className="text-[11px] text-slate-500">
              Ingresa la nota directa (1.0 a 10.0) en cada celda, o haz clic en la nota para desglosar Actividades (35% + 35% + 30%).
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600">
            Mostrando {filteredRecords.length} de {records.length} alumnos
          </span>
        </div>

        {records.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">No hay alumnos en este grado</p>
            <p className="text-xs text-slate-500 mt-1">
              Ve a la pestaña <strong>"Mis Grados"</strong> para configurar los alumnos de este salón.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <th className="p-3 w-10 text-center">N°</th>
                  <th className="p-3 min-w-[200px]">Alumno(a)</th>
                  {subjects.map((s) => (
                    <th key={s} className="p-2.5 text-center min-w-[90px]" title={s}>
                      <div className="truncate max-w-[100px]">{s}</div>
                    </th>
                  ))}
                  <th className="p-3 text-center min-w-[80px] bg-slate-200/60">Promedio</th>
                  <th className="p-3 text-center min-w-[90px]">Semáforo</th>
                  <th className="p-3 min-w-[130px]">Conducta</th>
                  <th className="p-3 text-center w-20">Inasist.</th>
                  <th className="p-3 text-center min-w-[110px]">Reporte</th>
                  <th className="p-3 text-center w-16">Boleta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r, idx) => {
                  const avg = getStudentAverage(r);
                  const traffic = getTrafficStatus(avg);
                  const studentIncidents = incidentsMap[r.studentId] || [];

                  return (
                    <tr
                      key={r.studentId}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        studentIncidents.length > 0 ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                      <td className="p-3 font-semibold text-slate-800">
                        <div className="flex items-center gap-2">
                          <span>{r.studentName}</span>
                          {studentIncidents.length > 0 && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-700 border border-rose-200"
                              title={`${studentIncidents.length} falta(s) en Bitácora`}
                            >
                              ⚠️ {studentIncidents.length}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* SUBJECT CELLS */}
                      {subjects.map((sub) => {
                        const sc = getSubjectScore(r, sub);
                        const isRed = sc !== null && sc < 6.0;
                        const isYellow = sc !== null && sc >= 6.0 && sc < 7.0;

                        return (
                          <td key={sub} className="p-1.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="10"
                                value={sc !== null ? sc : ''}
                                onChange={(e) => handleScoreChange(r.studentId, sub, e.target.value)}
                                placeholder="-"
                                className={`w-14 text-center py-1 rounded-lg border font-bold text-xs transition-colors ${
                                  isRed
                                    ? 'bg-rose-50 border-rose-300 text-rose-700 font-black'
                                    : isYellow
                                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                                    : sc !== null
                                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                                    : 'border-slate-200 bg-white text-slate-700'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingStudentScore({
                                    studentId: r.studentId,
                                    studentName: r.studentName,
                                    subjectName: sub,
                                  })
                                }
                                title="Desglosar Actividades (35% + 35%) y Examen (30%)"
                                className="p-1 text-slate-300 hover:text-[#003366] cursor-pointer"
                              >
                                <Sparkles className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        );
                      })}

                      {/* PROMEDIO */}
                      <td className="p-3 text-center font-black bg-slate-100/50">
                        {avg !== null ? (
                          <span
                            className={`text-sm ${
                              avg >= 7.0
                                ? 'text-emerald-700'
                                : avg >= 6.0
                                ? 'text-amber-700'
                                : 'text-rose-600'
                            }`}
                          >
                            {avg.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">-</span>
                        )}
                      </td>

                      {/* SEMÁFORO BADGE */}
                      <td className="p-3 text-center">
                        {traffic === 'green' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            🟢 Aprobado
                          </span>
                        )}
                        {traffic === 'yellow' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                            🟡 Refuerzo
                          </span>
                        )}
                        {traffic === 'red' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                            🔴 Riesgo
                          </span>
                        )}
                        {traffic === 'none' && (
                          <span className="text-[10px] text-slate-400">Sin notas</span>
                        )}
                      </td>

                      {/* CONDUCTA */}
                      <td className="p-2">
                        <select
                          value={r.conductScore || 'Muy Bueno'}
                          onChange={(e) => handleConductChange(r.studentId, e.target.value)}
                          className="w-full text-[11px] font-semibold p-1 rounded-lg border border-slate-300 bg-white"
                        >
                          {CONDUCT_OPTIONS.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* INASISTENCIAS */}
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={r.absences ?? 0}
                          onChange={(e) => handleAbsencesChange(r.studentId, e.target.value)}
                          className="w-12 text-center py-1 rounded-lg border border-slate-200 text-xs font-semibold"
                        />
                      </td>

                      {/* BOTÓN VER REPORTE DE INCIDENTE / FALTA */}
                      <td className="p-2 text-center">
                        {studentIncidents.length > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedIncidentReport({
                                studentName: r.studentName,
                                incidents: studentIncidents,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-[11px] font-bold flex items-center gap-1 mx-auto cursor-pointer shadow-2xs"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                            <span>Ver reporte</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">Limpio</span>
                        )}
                      </td>

                      {/* BOLETA INDIVIDUAL */}
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => setPrintingStudent(r)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#003366] hover:bg-slate-100 cursor-pointer"
                          title="Ver Boleta de Notas Individual"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: VER REPORTE DE INCIDENTE DE CONDUCTA (LEY CRECER JUNTOS) */}
      {selectedIncidentReport && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-rose-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-950">
                    Historial de Incidentes · {selectedIncidentReport.studentName}
                  </h3>
                  <p className="text-xs text-rose-700">
                    Registrado en Bitácora bajo directrices de la Ley Crecer Juntos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIncidentReport(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {selectedIncidentReport.incidents.map((inc, i) => {
                const data = inc.data as IncidentLogData;
                return (
                  <div
                    key={inc.id || i}
                    className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[#003366]">
                        Fecha del Suceso: {data.fecha || inc.date}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 text-rose-800">
                        {data.clasificacionFalta || 'Falta Registrada'}
                      </span>
                    </div>

                    <div>
                      <span className="font-bold text-slate-700 block">Hechos Objetivos:</span>
                      <p className="text-slate-600 whitespace-pre-wrap mt-0.5 bg-white p-2.5 rounded-lg border border-slate-200">
                        {data.descripcionHechos || 'Sin descripción detallada.'}
                      </p>
                    </div>

                    {data.medidasFormativas && (
                      <div>
                        <span className="font-bold text-slate-700 block">
                          Medida Formativa / Restaurativa (Sin castigos corporales o humillantes):
                        </span>
                        <p className="text-slate-600 bg-white p-2 rounded-lg border border-slate-200 mt-0.5">
                          {data.medidasFormativas}
                        </p>
                      </div>
                    )}

                    {(data.acuerdosCompromisos || data.comunicacionPadresDetalle) && (
                      <div>
                        <span className="font-bold text-slate-700 block">
                          Compromiso con el Padre / Tutor:
                        </span>
                        <p className="text-slate-600 bg-white p-2 rounded-lg border border-slate-200 mt-0.5">
                          {data.acuerdosCompromisos || data.comunicacionPadresDetalle}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedIncidentReport(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 cursor-pointer"
              >
                Cerrar Reporte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DESGLOSE DE NOTAS (ACTIVIDADES 70% + EXAMEN 30%) */}
      {editingStudentScore && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-black text-[#003366]">
                  Desglose de Calificación · MINEDUCYT
                </h3>
                <p className="text-xs text-slate-500">
                  {editingStudentScore.studentName} — {editingStudentScore.subjectName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudentScore(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const currentRec = records.find((r) => r.studentId === editingStudentScore.studentId);
              const scoreObj = currentRec?.scores?.[editingStudentScore.subjectName] || {
                subjectName: editingStudentScore.subjectName,
              };

              const updatePart = (field: 'act1' | 'act2' | 'exam', valStr: string) => {
                const num = valStr === '' ? undefined : parseFloat(valStr);
                const clamped = num !== undefined ? Math.min(10, Math.max(0, num)) : undefined;

                setRecords((prev) =>
                  prev.map((rec) => {
                    if (rec.studentId !== editingStudentScore.studentId) return rec;
                    const scs = { ...(rec.scores || {}) };
                    const current = scs[editingStudentScore.subjectName] || {
                      subjectName: editingStudentScore.subjectName,
                    };
                    const updated = { ...current, [field]: clamped };
                    // auto calculate total
                    const a1 = updated.act1 ?? 0;
                    const a2 = updated.act2 ?? 0;
                    const ex = updated.exam ?? 0;
                    updated.score = Math.round((a1 * 0.35 + a2 * 0.35 + ex * 0.30) * 10) / 10;
                    scs[editingStudentScore.subjectName] = updated;
                    return { ...rec, scores: scs };
                  })
                );
              };

              const totalScore = scoreObj.score ?? 0;

              return (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Actividad Integradora 1 (35%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={scoreObj.act1 ?? ''}
                      onChange={(e) => updatePart('act1', e.target.value)}
                      placeholder="0.0 a 10.0"
                      className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Actividad Integradora 2 / Tareas (35%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={scoreObj.act2 ?? ''}
                      onChange={(e) => updatePart('act2', e.target.value)}
                      placeholder="0.0 a 10.0"
                      className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Examen de Periodo / Prueba Objetiva (30%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={scoreObj.exam ?? ''}
                      onChange={(e) => updatePart('exam', e.target.value)}
                      placeholder="0.0 a 10.0"
                      className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                    />
                  </div>

                  <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-sky-800 uppercase">
                        Nota Ponderada Calculada:
                      </span>
                      <p className="text-[10px] text-sky-600">
                        (Act1 × 0.35) + (Act2 × 0.35) + (Examen × 0.30)
                      </p>
                    </div>
                    <span className="text-xl font-black text-[#003366]">
                      {totalScore > 0 ? totalScore.toFixed(1) : '-'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditingStudentScore(null)}
                    className="w-full py-2.5 rounded-xl bg-[#003366] text-white text-xs font-bold hover:bg-[#002244] cursor-pointer"
                  >
                    Aceptar y Cerrar
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR MATERIA */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-black text-[#003366]">Agregar Nueva Materia</h3>
            <p className="text-xs text-slate-500 mt-1">
              Ingresa el nombre de la materia o área de formación para agregarla a este grado.
            </p>
            <input
              type="text"
              autoFocus
              placeholder="Ej. Robótica, Francés, Oratoria..."
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddSubject();
              }}
              className="w-full mt-3 p-2.5 rounded-xl border border-slate-300 text-xs font-semibold"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddSubjectModal(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddSubject}
                disabled={!newSubjectName.trim()}
                className="px-4 py-2 rounded-xl bg-[#003366] text-white text-xs font-bold hover:bg-[#002244] cursor-pointer disabled:opacity-40"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BOLETA INDIVIDUAL DE NOTAS (IMPRIMIBLE) */}
      {printingStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-300">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-black text-[#003366]">Boleta de Calificaciones</h3>
                <p className="text-xs text-slate-500">
                  {config.schoolName} · {period}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPrintingStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <div>
                  <strong>Alumno(a):</strong> {printingStudent.studentName}
                </div>
                <div>
                  <strong>Grado:</strong> {activeClassroom?.gradeName} - Sección "{activeClassroom?.section}"
                </div>
                <div>
                  <strong>Conducta:</strong> {printingStudent.conductScore || 'Muy Bueno'}
                </div>
                <div>
                  <strong>Inasistencias del Periodo:</strong> {printingStudent.absences || 0}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2">Materia</th>
                      <th className="p-2 text-center">Nota</th>
                      <th className="p-2 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subjects.map((sub) => {
                      const sc = getSubjectScore(printingStudent, sub);
                      return (
                        <tr key={sub}>
                          <td className="p-2 font-medium">{sub}</td>
                          <td className="p-2 text-center font-bold">
                            {sc !== null ? sc.toFixed(1) : '-'}
                          </td>
                          <td className="p-2 text-center">
                            {sc !== null ? (
                              sc >= 6.0 ? (
                                <span className="text-emerald-700 font-bold">Aprobada</span>
                              ) : (
                                <span className="text-rose-600 font-bold">Refuerzo</span>
                              )
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-between">
                <span className="font-extrabold text-[#003366]">Promedio General:</span>
                <span className="text-lg font-black text-[#003366]">
                  {getStudentAverage(printingStudent)?.toFixed(1) || '-'}
                </span>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPrintingStudent(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-[#003366] text-white text-xs font-bold hover:bg-[#002244] flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Boleta</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
