export type ModuleId =
  | 'bitacora'
  | 'planificacion'
  | 'examenes'
  | 'jornalizacion'
  | 'actas'
  | 'guias'
  | 'temarios'
  | 'diplomas'
  | 'grados'
  | 'desempeno';

export type PageOrientation = 'portrait' | 'landscape';
export type PageSize = 'letter' | 'oficio' | 'legal' | 'a4';

export type DiplomaFormatStyle =
  | 'clasico_institucional'
  | 'elegante_pergamino'
  | 'moderno_geometrico'
  | 'infantil_preescolar'
  | 'merito_academico'
  | 'personalizado_ia';

export interface TeacherProfile {
  id: string;
  name: string;
  role: string;
  signatureDataUrl?: string;
}

export interface HolidayOrEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  type: 'feriado' | 'evaluacion' | 'vacacion';
}

export interface DiplomaSettings {
  ministryHeader: string;
  templateText: string;
  levelMap: {
    kinder: string;
    sexto: string;
    noveno: string;
    bachillerato: string;
  };
  homeroomTeachers: Record<string, string>;
}

export type ReminderCategory = 'planificacion' | 'cierre_notas' | 'otro';

export interface ReminderAlert {
  id: string;
  title: string;
  category: ReminderCategory;
  dueDate: string;
  dueTime: string;
  advanceMinutes: number;
  notes?: string;
  enabled: boolean;
  notifiedAt?: string;
}

export interface UserProfile {
  name: string;
  gender?: 'femenino' | 'masculino';
  specialty: string;
  signatureDataUrl?: string;
  photoUrl?: string;
}

export interface SchoolConfig {
  id: 'school_config';
  schoolName: string;
  schoolCity: string;
  schoolPhone: string;
  schoolSubtitle?: string;
  primaryColor: string;
  accentColor: string;
  verse: string;
  academicYear: string;
  gradingScale: 'points' | 'percentage';
  casmLogo: string;
  renovaLogo: string;
  nationalShield: string;
  directorName: string;
  directorSignature: string;
  userProfile?: UserProfile;
  teachers: TeacherProfile[];
  grades: string[];
  sections: string[];
  subjects: string[];
  calendarEvents: HolidayOrEvent[];
  reminders?: ReminderAlert[];
  diploma: DiplomaSettings;
  pinHash?: string;
  pinSalt?: string;
  hasSeenTutorial?: boolean;
}

export interface ExtractedTemplate {
  id: string;
  module: ModuleId;
  name: string;
  gradeLevel: string;
  orientation: PageOrientation;
  pageSize: PageSize;
  sections: Array<{
    title: string;
    type: 'fields' | 'table' | 'narrative' | 'list';
    columns?: string[];
    fields?: string[];
    notes?: string;
  }>;
  styleNotes: string;
  rawInstructions: string;
  createdAt: string;
}

export interface KnowledgeDoc {
  id: string;
  module: ModuleId;
  title: string;
  category: 'ley_crecer_juntos' | 'reglamento_interno' | 'manual_convivencia' | 'otro';
  contentText: string;
  fileName: string;
  uploadedAt: string;
}

export interface SavedDocument<T = unknown> {
  id: string;
  module: ModuleId;
  title: string;
  grade: string;
  section: string;
  subject: string;
  period: string;
  date: string;
  orientation: PageOrientation;
  pageSize: PageSize;
  data: T;
  createdAt: string;
  updatedAt: string;
}

export interface UploadedAttachment {
  id: string;
  name: string;
  kind: 'image' | 'pdf' | 'text';
  mimeType: string;
  base64?: string;
  previewUrl?: string;
  extractedText?: string;
}

/* ================= MODULE DATA SCHEMAS ================= */

export interface IncidentLogData {
  correlativo: string;
  fecha: string;
  hora: string;
  lugar: string;
  grado: string;
  seccion: string;
  usarSoloIniciales: boolean;
  estudiantesInvolucrados: string;
  docenteReporta: string;
  testigos: string;
  descripcionHechos: string;
  clasificacionFalta: 'Leve' | 'Grave' | 'Muy Grave' | 'Por determinar [COMPLETAR]';
  articuloReglamento: string;
  medidasFormativas: string;
  comunicacionPadresFecha: string;
  comunicacionPadresMedio: string;
  comunicacionPadresDetalle: string;
  acuerdosCompromisos: string;
  requiereDerivacion: boolean;
  instanciaDerivacion: string;
  detalleDerivacion: string;
  seguimiento: string;
  observacionesLegales: string;
}

export interface LessonClassSession {
  numero: number;
  fecha: string;
  introduccionMotivacion: string;
  trabajoDocente: string;
  trabajoGrupalIndividual: string;
  evaluacionContextualizada: string;
  vocabularioClave: string;
  itemsCompetencias: string;
  anotacionesPertinentes: string;
}

export interface LessonPlanData {
  docente: string;
  grado: string;
  seccion: string;
  asignatura: string;
  unidadNumero: string;
  tituloUnidad: string;
  contenido: string;
  objetivos: string;
  competencia: string;
  tiempoProbable: string;
  fechaInicio: string;
  fechaFin: string;
  semana: string;
  estandarConocimientos: string;
  procesoDidactico: Array<{
    conceptual: string;
    procedimental: string;
    actitudinal: string;
    indicadoresLogro: string;
    ifea: string;
    actividades: string;
  }>;
  clases: LessonClassSession[];
}

export type ExamItemType =
  | 'seleccion_multiple'
  | 'relacionar_columnas'
  | 'completar'
  | 'verdadero_falso'
  | 'analisis'
  | 'tabla_clasificacion'
  | 'problemas'
  | 'visual_colorear'
  | 'visual_cheque'
  | 'visual_unir';

export interface ExamPart {
  numeroRomano: string;
  titulo: string;
  tipo: ExamItemType;
  indicacion: string;
  valor: string;
  items: Array<{
    numero: number;
    enunciado: string;
    opciones?: string[];
    columnaDerecha?: string;
    lineasRespuesta?: number;
    espacioImagen?: boolean;
    tablaColumnas?: string[];
    respuestaCorrecta: string;
  }>;
}

export interface ExamData {
  tipoExamen: 'Examen Mensual' | 'Examen de Periodo' | 'Examen Final';
  periodo: string;
  grado: string;
  seccion: string;
  asignatura: string;
  docente: string;
  fecha: string;
  totalValor: string;
  sistemaCalificacion: 'points' | 'percentage';
  esKinderOPrimerCiclo: boolean;
  dificultad: 'Básico' | 'Intermedio' | 'Avanzado';
  versiculo: string;
  indicacionesGenerales: string;
  partes: ExamPart[];
}

export interface PacingRow {
  semana: string;
  fechas: string;
  unidad: string;
  contenido: string;
  indicadoresLogro: string;
  actividadesEvaluacion: string;
  observaciones: string;
}

export interface PacingGuideData {
  docente: string;
  grado: string;
  seccion: string;
  asignatura: string;
  periodo: string;
  anioLectivo: string;
  filas: PacingRow[];
}

export type MinutesType =
  | 'Reunión de Padres de Familia'
  | 'Compromiso Conductual'
  | 'Compromiso Académico'
  | 'Reunión de Docentes / Consejo'
  | 'Entrega de Notas'
  | 'Acuerdos con Estudiantes'
  | 'Otra';

export interface MinutesData {
  tipoActa: MinutesType;
  tipoPersonalizado: string;
  numeroActa: string;
  lugar: string;
  fecha: string;
  horaInicio: string;
  horaCierre: string;
  grado: string;
  seccion: string;
  asistentes: string;
  agenda: string[];
  desarrollo: string;
  acuerdos: Array<{
    numero: number;
    descripcion: string;
    responsable: string;
    plazo: string;
  }>;
  firmantes: Array<{
    nombre: string;
    cargo: string;
  }>;
}

export interface ClassGuideData {
  nivelTab: 'tercer_ciclo' | 'bachillerato';
  asignatura: string;
  grado: string;
  seccion: string;
  docente: string;
  unidad: string;
  tema: string;
  fecha: string;
  duracionMinutos: 45 | 90;
  objetivoIndicador: string;
  saberesPrevios: string;
  desarrolloContenido: string;
  ejemplosResueltos: string;
  actividades: string;
  evaluacion: string;
  rubrica?: Array<{
    criterio: string;
    excelente: string;
    satisfactorio: string;
    enProceso: string;
    ponderacion: string;
  }>;
  tarea: string;
  referencias: string;
}

export interface SyllabusData {
  asignatura: string;
  grado: string;
  seccion: string;
  docente: string;
  periodo: string;
  tipoPrueba: string;
  fechaPrueba: string;
  ponderacion: string;
  contenidos: Array<{
    unidad: string;
    tema: string;
    subtemas: string;
    paginaORecurso: string;
  }>;
  recomendacionesEstudio: string[];
  observacionesPadres: string;
}

export interface GraduateRecord {
  id: string;
  fullName: string;
  photoDataUrl?: string;
}

export interface DiplomaBatchData {
  grado: string;
  nivelTexto: string;
  fechaEmision: string;
  fechaEnLetras: string;
  directoraNombre: string;
  directoraCargo?: string;
  maestraGuiaNombre: string;
  maestraGuiaCargo?: string;
  maestraGuiaFirma?: string;
  ministryHeader: string;
  bodyTextTemplate: string;
  graduates: GraduateRecord[];
  namesConfirmed: boolean;
  // Personalización avanzada de diseño y formato:
  pageSize?: PageSize;
  orientation?: PageOrientation;
  formatStyle?: DiplomaFormatStyle;
  diplomaTitle?: string;
  introPhrase?: string;
  verseOrMotto?: string;
  institutionSubtitle?: string;
  leftLogoUrl?: string;
  rightLogoUrl?: string;
  centerSealUrl?: string;
  showPhotoBox?: boolean;
  showCenterSeal?: boolean;
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: 'serif' | 'sans' | 'formal';
}

/* ================= MIS GRADOS & ESTUDIANTES ================= */

export interface StudentProfile {
  id: string;
  fullName: string;
  birthDate?: string; // YYYY-MM-DD
  guardianName?: string;
  guardianPhone?: string; // WhatsApp
  address?: string;
  photoDataUrl?: string;
  notes?: string;
  isConfirmed?: boolean;
}

export interface ClassroomGrade {
  id: string;
  gradeName: string; // e.g. "9.º Grado"
  section: string; // e.g. "A"
  academicYear: string; // e.g. "2026"
  homeroomTeacher?: string;
  students: StudentProfile[];
  createdAt: string;
  updatedAt: string;
}

export interface MyGradesData {
  attendedGrades: string[];
  classrooms: ClassroomGrade[];
}

/* ================= DESEMPEÑO ESCOLAR & NOTAS ================= */

export interface StudentSubjectScore {
  subjectName: string;
  act1?: number; // 35%
  act2?: number; // 35%
  exam?: number; // 30%
  score?: number; // Nota final del periodo (1.0 a 10.0)
}

export interface StudentGradeRecord {
  studentId: string;
  studentName: string;
  period: string; // e.g. "Trimestre 1", "Trimestre 2", "Trimestre 3"
  scores: Record<string, StudentSubjectScore>; // subjectName -> StudentSubjectScore
  conductScore?: 'Excelente' | 'Muy Bueno' | 'Bueno' | 'En Proceso' | 'Necesita Mejorar' | string;
  conductObservation?: string;
  absences?: number; // Inasistencias
  hasIncidentReport?: boolean;
  incidentSummary?: string;
}

export interface ClassroomGradebook {
  classroomId: string;
  gradeName: string;
  section: string;
  period: string; // e.g. "Trimestre 1"
  subjects: string[];
  records: StudentGradeRecord[];
  updatedAt: string;
}
