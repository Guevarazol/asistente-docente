import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Cake,
  Calendar,
  Camera,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  FileUp,
  GraduationCap,
  HeartHandshake,
  ImagePlus,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  RotateCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import type { ClassroomGrade, SchoolConfig, StudentProfile } from '../types/casm';
import { loadClassroomsRegistry, saveClassroomsRegistry } from '../db/indexedDb';
import { fileToImageDataUrl, parseNamesFromSpreadsheet, parseUploadedFile } from '../utils/fileReader';
import { callGeminiAi, parseAiJsonResponse } from '../services/aiService';
import { buildGraduateNamesExtractionPrompt } from '../prompts/modulePrompts';

interface MyGradesModuleProps {
  config: SchoolConfig;
}

export function calculateAge(birthDateStr?: string): { years: number; months: number; text: string } | null {
  if (!birthDateStr) return null;
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) {
    months--;
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  const text = years > 0 ? `${years} años${months > 0 ? ` y ${months} m` : ''}` : `${months} meses`;
  return { years, months, text };
}

export function getBirthdayAlert(
  birthDateStr?: string
): { isBirthdayToday: boolean; isSoon: boolean; daysRemaining: number } | null {
  if (!birthDateStr) return null;
  const parts = birthDateStr.split('-');
  if (parts.length < 3) return null;
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const now = new Date();
  const currentYear = now.getFullYear();

  let nextBirthday = new Date(currentYear, month, day);
  const today = new Date(currentYear, now.getMonth(), now.getDate());

  if (nextBirthday < today) {
    nextBirthday = new Date(currentYear + 1, month, day);
  }

  const diffMs = nextBirthday.getTime() - today.getTime();
  const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

  return {
    isBirthdayToday: daysRemaining === 0,
    isSoon: daysRemaining > 0 && daysRemaining <= 7,
    daysRemaining,
  };
}

function formatWhatsAppLink(phone?: string, studentName?: string, schoolName?: string): string | null {
  if (!phone) return null;
  const cleanDigits = phone.replace(/\D/g, '');
  if (cleanDigits.length < 8) return null;
  // If 8 digits (El Salvador local), prepend 503
  const fullNumber = cleanDigits.length === 8 ? `503${cleanDigits}` : cleanDigits;
  const institution = schoolName?.trim() || 'la institución educativa';
  const greeting = encodeURIComponent(
    `Estimado padre o encargado de ${studentName || 'el/la estudiante'}, le saluda su docente de ${institution}.`
  );
  return `https://wa.me/${fullNumber}?text=${greeting}`;
}

function transformNameOrder(fullName: string, target: 'first_last' | 'last_first'): string {
  const trimmed = fullName.trim();
  if (!trimmed) return '';

  if (trimmed.includes(',')) {
    const [lastnames, firstnames] = trimmed.split(',').map((s) => s.trim());
    if (lastnames && firstnames) {
      return target === 'first_last' ? `${firstnames} ${lastnames}` : `${lastnames}, ${firstnames}`;
    }
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return trimmed;

  if (target === 'last_first') {
    if (parts.length === 4) return `${parts[2]} ${parts[3]}, ${parts[0]} ${parts[1]}`;
    if (parts.length === 3) return `${parts[1]} ${parts[2]}, ${parts[0]}`;
    return `${parts[1]}, ${parts[0]}`;
  } else {
    if (parts.length === 4) return `${parts[2]} ${parts[3]} ${parts[0]} ${parts[1]}`;
    if (parts.length === 3) return `${parts[2]} ${parts[0]} ${parts[1]}`;
    return `${parts[1]} ${parts[0]}`;
  }
}

export const MyGradesModule: React.FC<MyGradesModuleProps> = ({ config }) => {
  const [classrooms, setClassrooms] = useState<ClassroomGrade[]>([]);
  const [activeClassroomId, setActiveClassroomId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Modal: Crear nuevo grado
  const [showAddClassroomModal, setShowAddClassroomModal] = useState(false);
  const [newGradeName, setNewGradeName] = useState(config.grades[7] || '8.º Grado');
  const [newSection, setNewSection] = useState('A');
  const [newHomeroom, setNewHomeroom] = useState(config.userProfile?.name || '');

  // Modal: Editar / Completar datos del alumno
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null);

  // Cargas masivas
  const [extractingFromPhoto, setExtractingFromPhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Cargar registro de aulas al montar
  useEffect(() => {
    loadClassroomsRegistry().then((loaded) => {
      if (loaded.length > 0) {
        setClassrooms(loaded);
        setActiveClassroomId(loaded[0].id);
      } else {
        // Inicializar con dos grados de ejemplo
        const initialAulas: ClassroomGrade[] = [
          {
            id: 'cls-9-a',
            gradeName: '9.º Grado',
            section: 'A',
            academicYear: config.academicYear,
            homeroomTeacher: config.userProfile?.name || 'Prof. Titular',
            students: [
              {
                id: 'std-1',
                fullName: 'Sofía Alejandra Martínez Hernández',
                birthDate: '2011-04-12',
                guardianName: 'Marta Hernández de Martínez',
                guardianPhone: '7788-9900',
                address: 'Colonia Ciudad Jardín, San Miguel',
                isConfirmed: true,
              },
              {
                id: 'std-2',
                fullName: 'Daniel Eduardo Vásquez Romero',
                birthDate: '2011-11-26',
                guardianName: 'Eduardo Vásquez',
                guardianPhone: '7122-3344',
                address: 'Barrio El Centro, San Miguel',
                isConfirmed: true,
              },
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'cls-8-b',
            gradeName: '8.º Grado',
            section: 'B',
            academicYear: config.academicYear,
            homeroomTeacher: config.userProfile?.name || 'Prof. Titular',
            students: [
              {
                id: 'std-3',
                fullName: 'Carlos Andrés Gómez Pérez',
                birthDate: '2012-05-18',
                guardianName: 'Carlos Gómez',
                guardianPhone: '7654-3210',
                address: 'Residencial San Francisco, San Miguel',
                isConfirmed: false,
              },
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
        setClassrooms(initialAulas);
        setActiveClassroomId(initialAulas[0].id);
        void saveClassroomsRegistry(initialAulas);
      }
      setLoading(false);
    });
  }, [config]);

  const activeClassroom = useMemo(() => {
    return classrooms.find((c) => c.id === activeClassroomId) || classrooms[0];
  }, [classrooms, activeClassroomId]);

  const filteredStudents = useMemo(() => {
    if (!activeClassroom) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return activeClassroom.students;
    return activeClassroom.students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        (s.guardianName && s.guardianName.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q))
    );
  }, [activeClassroom, searchQuery]);

  const stats = useMemo(() => {
    if (!activeClassroom) return { total: 0, complete: 0, incomplete: 0, birthdaysToday: 0 };
    const total = activeClassroom.students.length;
    let complete = 0;
    let birthdaysToday = 0;

    activeClassroom.students.forEach((s) => {
      if (s.birthDate && s.guardianName && s.guardianPhone) complete++;
      const bday = getBirthdayAlert(s.birthDate);
      if (bday?.isBirthdayToday) birthdaysToday++;
    });

    return {
      total,
      complete,
      incomplete: total - complete,
      birthdaysToday,
    };
  }, [activeClassroom]);

  /* ---------------- HANDLERS: AULAS ---------------- */

  const handleCreateClassroom = async () => {
    if (!newGradeName) return;
    const newId = `cls-${Date.now()}`;
    const nextClassroom: ClassroomGrade = {
      id: newId,
      gradeName: newGradeName,
      section: newSection,
      academicYear: config.academicYear,
      homeroomTeacher: newHomeroom || config.userProfile?.name || '',
      students: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextList = [...classrooms, nextClassroom];
    setClassrooms(nextList);
    setActiveClassroomId(newId);
    setShowAddClassroomModal(false);
    await saveClassroomsRegistry(nextList);
    setSaveStatus('Grado añadido a tus aulas.');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleDeleteClassroom = async (id: string) => {
    if (classrooms.length <= 1) {
      alert('Debes conservar al menos un grado configurado.');
      return;
    }
    if (!confirm('¿Estás seguro de eliminar este grado y toda su lista de alumnos?')) return;
    const nextList = classrooms.filter((c) => c.id !== id);
    setClassrooms(nextList);
    setActiveClassroomId(nextList[0].id);
    await saveClassroomsRegistry(nextList);
  };

  /* ---------------- HANDLERS: ALUMNOS ---------------- */

  const persistStudents = async (updatedStudents: StudentProfile[]) => {
    if (!activeClassroom) return;
    const nextList = classrooms.map((cls) =>
      cls.id === activeClassroom.id
        ? { ...cls, students: updatedStudents, updatedAt: new Date().toISOString() }
        : cls
    );
    setClassrooms(nextList);
    await saveClassroomsRegistry(nextList);
  };

  const handleAddManualStudent = async () => {
    if (!activeClassroom) return;
    const newStudent: StudentProfile = {
      id: `std-${Date.now()}`,
      fullName: '',
      isConfirmed: false,
    };
    const nextStudents = [newStudent, ...activeClassroom.students];
    await persistStudents(nextStudents);
    setEditingStudent(newStudent);
  };

  const handleDeleteStudent = async (id: string) => {
    if (!activeClassroom) return;
    const nextStudents = activeClassroom.students.filter((s) => s.id !== id);
    await persistStudents(nextStudents);
  };

  const handleSaveStudentDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !activeClassroom) return;
    const nextStudents = activeClassroom.students.map((s) =>
      s.id === editingStudent.id ? editingStudent : s
    );
    await persistStudents(nextStudents);
    setEditingStudent(null);
    setSaveStatus('Ficha del estudiante actualizada.');
    setTimeout(() => setSaveStatus(null), 2500);
  };

  /* ---------------- HANDLERS: CARGA MASIVA DE NOMBRES ---------------- */

  const handleUploadSpreadsheet = async (file: File | null) => {
    if (!file || !activeClassroom) return;
    setUploadError(null);
    try {
      const names = await parseNamesFromSpreadsheet(file);
      if (names.length === 0) throw new Error('No se detectaron nombres en el archivo.');

      const imported: StudentProfile[] = names.map((name, idx) => ({
        id: `std-imp-${Date.now()}-${idx}`,
        fullName: name,
        isConfirmed: false,
      }));

      const merged = [...activeClassroom.students, ...imported];
      await persistStudents(merged);
      setSaveStatus(`Se importaron ${imported.length} alumnos desde la hoja de cálculo.`);
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al procesar archivo.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUploadPhotoOrPdf = async (file: File | null) => {
    if (!file || !activeClassroom) return;
    setUploadError(null);
    setExtractingFromPhoto(true);
    try {
      const att = await parseUploadedFile(file);
      const { systemPrompt, userPrompt } = buildGraduateNamesExtractionPrompt();
      const raw = await callGeminiAi({
        systemPrompt,
        userPrompt,
        attachments: [att],
        expectJson: true,
      });

      const parsed = parseAiJsonResponse<{ names?: string[] }>(raw);
      if (!Array.isArray(parsed.names) || parsed.names.length === 0) {
        throw new Error('No se detectaron nombres en la foto/PDF. Intenta con una imagen más nítida.');
      }

      const imported: StudentProfile[] = parsed.names.map((name, idx) => ({
        id: `std-ocr-${Date.now()}-${idx}`,
        fullName: name.trim(),
        isConfirmed: false,
      }));

      const merged = [...activeClassroom.students, ...imported];
      await persistStudents(merged);
      setSaveStatus(`La IA extrajo ${imported.length} alumnos de la imagen.`);
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al extraer nómina con IA.');
    } finally {
      setExtractingFromPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  /* ---------------- REORDENAR Y CAPITALIZAR ---------------- */

  const handleReorderNames = async (targetOrder: 'first_last' | 'last_first') => {
    if (!activeClassroom) return;
    const reordered = activeClassroom.students.map((s) => ({
      ...s,
      fullName: transformNameOrder(s.fullName, targetOrder),
    }));
    await persistStudents(reordered);
  };

  const handleSortAlphabetically = async () => {
    if (!activeClassroom) return;
    const sorted = [...activeClassroom.students].sort((a, b) =>
      a.fullName.localeCompare(b.fullName, 'es', { sensitivity: 'base' })
    );
    await persistStudents(sorted);
  };

  if (loading) {
    return (
      <div className="min-h-[300px] flex items-center justify-center text-slate-500 text-xs font-semibold">
        Cargando registro de aulas y alumnos...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 1. BARRA SUPERIOR DE AULAS DEL MAESTRO */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-[#003366] flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#FFA92D]" />
              Mis Grados y Aulas
            </h2>
            <p className="text-xs text-slate-500">
              Configura los grados que atiendes, administra la nómina oficial y consulta datos de contacto y cumpleaños.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddClassroomModal(true)}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar nuevo grado</span>
          </button>
        </div>

        {/* SELECTOR EN PESTAÑAS DE GRADOS ACTIVOS */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          {classrooms.map((cls) => {
            const isActive = cls.id === activeClassroom?.id;
            return (
              <div
                key={cls.id}
                className={`flex items-center rounded-xl border transition ${
                  isActive
                    ? 'bg-[#003366] text-white border-[#003366] shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveClassroomId(cls.id)}
                  className="px-3.5 py-2 text-xs font-bold cursor-pointer"
                >
                  {cls.gradeName} {cls.section ? `Secc. ${cls.section}` : ''}
                  <span
                    className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {cls.students.length}
                  </span>
                </button>
                {classrooms.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteClassroom(cls.id)}
                    title="Eliminar este grado"
                    className={`p-1.5 mr-1 rounded-lg hover:text-rose-500 cursor-pointer ${
                      isActive ? 'text-white/60 hover:bg-white/10' : 'text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. TARJETAS DE ESTADÍSTICAS DEL AULA SELECCIONADA */}
      {activeClassroom && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#003366] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500">Total Alumnos</div>
              <div className="text-lg font-black text-slate-900">{stats.total}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500">Fichas Completas</div>
              <div className="text-lg font-black text-emerald-700">{stats.complete}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500">Datos Pendientes</div>
              <div className="text-lg font-black text-amber-700">{stats.incomplete}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
              <Cake className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500">Cumpleaños Hoy</div>
              <div className="text-lg font-black text-purple-700">{stats.birthdaysToday}</div>
            </div>
          </div>
        </div>
      )}

      {/* 3. BARRA DE CARGA Y HERRAMIENTAS DE NÓMINA */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[220px]">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, encargado o dirección..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Subir Excel / CSV */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => void handleUploadSpreadsheet(e.target.files?.[0] || null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Importar Excel</span>
            </button>

            {/* Subir Foto / PDF de lista */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*,.pdf,.docx"
              capture="environment"
              onChange={(e) => void handleUploadPhotoOrPdf(e.target.files?.[0] || null)}
              className="hidden"
            />
            <button
              type="button"
              disabled={extractingFromPhoto}
              onClick={() => photoInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              {extractingFromPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              <span>{extractingFromPhoto ? 'Leyendo nómina...' : 'Foto / Documento (IA)'}</span>
            </button>

            {/* Agregar alumno manual */}
            <button
              type="button"
              onClick={() => void handleAddManualStudent()}
              className="px-3.5 py-2 rounded-xl bg-[#003366] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Nuevo Alumno</span>
            </button>
          </div>
        </div>

        {/* HERRAMIENTAS DE FORMATO Y ORDEN */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <RotateCw className="w-3.5 h-3.5 text-[#003366]" /> Formato de lista:
            </span>
            <button
              type="button"
              onClick={() => void handleReorderNames('first_last')}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Nombres Primero
            </button>
            <button
              type="button"
              onClick={() => void handleReorderNames('last_first')}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Apellidos Primero
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleSortAlphabetically()}
            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Ordenar A-Z
          </button>
        </div>

        {uploadError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
            {uploadError}
          </div>
        )}

        {saveStatus && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{saveStatus}</span>
          </div>
        )}

        {/* 4. LISTADO DETALLADO DE ESTUDIANTES */}
        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
          {filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No hay estudiantes registrados en este grado. Sube un archivo de Excel, toma una foto de la nómina o añade estudiantes manualmente.
            </div>
          ) : (
            filteredStudents.map((std, idx) => {
              const age = calculateAge(std.birthDate);
              const bday = getBirthdayAlert(std.birthDate);
              const waLink = formatWhatsAppLink(std.guardianPhone, std.fullName, config.schoolName);
              const isComplete = Boolean(std.birthDate && std.guardianName && std.guardianPhone);

              return (
                <div
                  key={std.id}
                  className={`p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 transition ${
                    bday?.isBirthdayToday ? 'bg-amber-50/50' : 'bg-white hover:bg-slate-50/70'
                  }`}
                >
                  {/* Info Principal */}
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-6 text-center font-mono font-bold text-xs text-slate-400 pt-1">
                      {idx + 1}
                    </span>
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{std.fullName || '[Sin nombre]'}</span>
                        {bday?.isBirthdayToday && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                            <Cake className="w-3 h-3 text-purple-600" /> ¡Cumpleaños Hoy!
                          </span>
                        )}
                        {bday?.isSoon && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Cumple en {bday.daysRemaining} días
                          </span>
                        )}
                        {!isComplete && (
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-slate-100 text-slate-500">
                            Ficha incompleta
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        {std.birthDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {std.birthDate} ({age?.text || ''})
                          </span>
                        )}
                        {std.guardianName && (
                          <span className="flex items-center gap-1">
                            <HeartHandshake className="w-3 h-3 text-slate-400" />
                            Encargado: <strong className="text-slate-700">{std.guardianName}</strong>
                          </span>
                        )}
                        {std.address && (
                          <span className="flex items-center gap-1 max-w-xs truncate" title={std.address}>
                            <MapPin className="w-3 h-3 text-slate-400" /> {std.address}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones y WhatsApp */}
                  <div className="flex items-center gap-2 shrink-0 ml-9 md:ml-0">
                    {waLink ? (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-bold flex items-center gap-1"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>WhatsApp</span>
                      </a>
                    ) : std.guardianPhone ? (
                      <span className="text-[11px] font-mono text-slate-600 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {std.guardianPhone}
                      </span>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setEditingStudent({ ...std })}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer"
                    >
                      {isComplete ? 'Editar' : 'Completar datos'}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDeleteStudent(std.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Eliminar de la nómina"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL: EDITAR / COMPLETAR DATOS DEL ALUMNO */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-[#003366] flex items-center gap-2">
                <User className="w-4 h-4 text-[#FFA92D]" />
                Ficha del Estudiante
              </h3>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStudentDetails} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre completo del estudiante</label>
                <input
                  type="text"
                  required
                  value={editingStudent.fullName}
                  onChange={(e) => setEditingStudent({ ...editingStudent, fullName: e.target.value })}
                  placeholder="Ej: Sofía Alejandra Martínez Hernández"
                  className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de nacimiento</label>
                  <input
                    type="date"
                    value={editingStudent.birthDate || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, birthDate: e.target.value })}
                    className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 text-xs"
                  />
                  {editingStudent.birthDate && (
                    <span className="text-[10.5px] text-slate-500 font-medium mt-0.5 block">
                      Edad calculada: {calculateAge(editingStudent.birthDate)?.text || ''}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp / Celular del Padre</label>
                  <input
                    type="tel"
                    value={editingStudent.guardianPhone || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, guardianPhone: e.target.value })}
                    placeholder="Ej: 7788-9900"
                    className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del padre, madre o encargado</label>
                <input
                  type="text"
                  value={editingStudent.guardianName || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, guardianName: e.target.value })}
                  placeholder="Ej: Marta Hernández de Martínez"
                  className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección de residencia</label>
                <input
                  type="text"
                  value={editingStudent.address || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, address: e.target.value })}
                  placeholder="Ej: Colonia Ciudad Jardín, Polígono D, San Miguel"
                  className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <p className="text-[11px] text-slate-500 italic">
                * Si no tienes todos los datos en este momento, puedes guardar y completarlos más adelante.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#003366] text-white text-xs font-bold hover:bg-[#002244] cursor-pointer"
                >
                  Guardar Ficha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR NUEVA AULA */}
      {showAddClassroomModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-[#003366]">Añadir Nuevo Grado a Mis Aulas</h3>
              <button
                type="button"
                onClick={() => setShowAddClassroomModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Grado o Nivel</label>
                <select
                  value={newGradeName}
                  onChange={(e) => setNewGradeName(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs bg-white"
                >
                  {config.grades.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Sección</label>
                <select
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs bg-white"
                >
                  {config.sections.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Maestro(a) Guía o Titular</label>
                <input
                  type="text"
                  value={newHomeroom}
                  onChange={(e) => setNewHomeroom(e.target.value)}
                  placeholder="Ej: Prof. Ana Zelaya"
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddClassroomModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreateClassroom()}
                  className="px-4 py-2 rounded-xl bg-[#003366] text-white text-xs font-bold cursor-pointer"
                >
                  Crear Grado
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
