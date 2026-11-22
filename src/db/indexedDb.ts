import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  ClassroomGrade,
  ClassroomGradebook,
  ExtractedTemplate,
  IncidentLogData,
  KnowledgeDoc,
  ModuleId,
  SavedDocument,
  SchoolConfig,
} from '../types/casm';

interface CasmDocenteDB extends DBSchema {
  settings: {
    key: string;
    value: SchoolConfig;
  };
  documents: {
    key: string;
    value: SavedDocument;
    indexes: {
      'by-module': ModuleId;
      'by-updated': string;
    };
  };
  templates: {
    key: string;
    value: ExtractedTemplate;
    indexes: {
      'by-module': ModuleId;
    };
  };
  knowledgeBase: {
    key: string;
    value: KnowledgeDoc;
    indexes: {
      'by-module': ModuleId;
    };
  };
}

const DB_NAME = 'casm_docente_local_db';
const DB_VERSION = 1;

export const DEFAULT_SCHOOL_CONFIG: SchoolConfig = {
  id: 'school_config',
  schoolName: 'Colegio Adventista San Miguel',
  schoolCity: 'San Miguel, El Salvador',
  schoolPhone: '2661-7260',
  schoolSubtitle: 'Parvularia, Básica y Bachillerato · Selecciona un módulo para generar, editar o imprimir.',
  primaryColor: '#003366',
  accentColor: '#FFA92D',
  verse: 'Jesús le dijo: Si puedes creer, al que cree todo le es posible',
  academicYear: '2026',
  gradingScale: 'points',
  casmLogo: '/assets/casm-logo.png',
  renovaLogo: '/assets/aistudio/Logo_largo_renova_5b497c22.png',
  nationalShield: '/assets/escudo-elsalvador.png',
  directorName: 'Lic. Berenice Salvador de Herrera',
  directorSignature: '',
  userProfile: {
    name: '',
    gender: 'femenino',
    specialty: '',
    signatureDataUrl: '',
    photoUrl: '',
  },
  teachers: [
    { id: 't-1', name: 'Lic. Berenice Salvador de Herrera', role: 'Directora' },
    { id: 't-2', name: 'Prof. Ana María Zelaya', role: 'Docente de Educación Básica' },
    { id: 't-3', name: 'Prof. Carlos Eduardo Martínez', role: 'Docente de Tercer Ciclo' },
    { id: 't-4', name: 'Lic. Rosa Elena Vásquez', role: 'Docente de Bachillerato' },
  ],
  grades: [
    'Kinder 4',
    'Kinder 5',
    'Preparatoria',
    '1.º Grado',
    '2.º Grado',
    '3.º Grado',
    '4.º Grado',
    '5.º Grado',
    '6.º Grado',
    '7.º Grado',
    '8.º Grado',
    '9.º Grado',
    '1.º Año Bachillerato General',
    '2.º Año Bachillerato General',
    '1.º Año Bachillerato Técnico',
    '2.º Año Bachillerato Técnico',
    '3.º Año Bachillerato Técnico',
  ],
  sections: ['A', 'B', 'C', 'Única'],
  subjects: [
    'Lenguaje y Literatura',
    'Matemática',
    'Ciencia y Tecnología',
    'Estudios Sociales y Cívica',
    'Biblia y Valores Cristianos',
    'Inglés',
    'Informática',
    'Educación Física',
    'Educación Artística',
    'Moral, Urbanidad y Cívica',
    'Seminario / Módulo Técnico',
  ],
  calendarEvents: [
    {
      id: 'ev-1',
      name: 'Semana Santa (Vacaciones)',
      startDate: '2026-03-30',
      endDate: '2026-04-05',
      type: 'vacacion',
    },
    {
      id: 'ev-2',
      name: 'Día del Trabajo',
      startDate: '2026-05-01',
      endDate: '2026-05-01',
      type: 'feriado',
    },
    {
      id: 'ev-3',
      name: 'Fiestas Agostinas',
      startDate: '2026-08-01',
      endDate: '2026-08-06',
      type: 'vacacion',
    },
    {
      id: 'ev-4',
      name: 'Día de la Independencia',
      startDate: '2026-09-15',
      endDate: '2026-09-15',
      type: 'feriado',
    },
    {
      id: 'ev-5',
      name: 'Exámenes de Periodo I',
      startDate: '2026-03-16',
      endDate: '2026-03-20',
      type: 'evaluacion',
    },
  ],
  reminders: [],
  diploma: {
    ministryHeader:
      'MINISTERIO DE EDUCACIÓN, CIENCIA Y TECNOLOGÍA\nREPÚBLICA DE EL SALVADOR, C.A.\nDIRECCIÓN GENERAL DE EDUCACIÓN',
    templateText:
      'Ha finalizado satisfactoriamente sus estudios de [NIVEL] y presentado con éxito los exámenes correspondientes, la Dirección de este Centro Educativo le confiere el presente DIPLOMA. Como un recuerdo y con el profundo anhelo de que sus acciones futuras vayan acorde con los sólidos principios morales que esta institución le inculcó, representando dignamente a nuestro Creador y a la institución que lo formó. Dado en la ciudad de San Miguel, a los [FECHA EN LETRAS].',
    levelMap: {
      kinder: 'Educación Parvularia',
      sexto: 'Segundo Ciclo de Educación Básica',
      noveno: 'Educación Básica',
      bachillerato: 'Educación Media',
    },
    homeroomTeachers: {
      'Preparatoria': 'Prof. Ana María Zelaya',
      '6.º Grado': 'Prof. Ana María Zelaya',
      '9.º Grado': 'Prof. Carlos Eduardo Martínez',
      '2.º Año Bachillerato General': 'Lic. Rosa Elena Vásquez',
      '3.º Año Bachillerato Técnico': 'Lic. Rosa Elena Vásquez',
    },
  },
};

let dbPromise: Promise<IDBPDatabase<CasmDocenteDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<CasmDocenteDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('documents')) {
          const docStore = db.createObjectStore('documents', { keyPath: 'id' });
          docStore.createIndex('by-module', 'module');
          docStore.createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('templates')) {
          const tplStore = db.createObjectStore('templates', { keyPath: 'id' });
          tplStore.createIndex('by-module', 'module');
        }
        if (!db.objectStoreNames.contains('knowledgeBase')) {
          const kbStore = db.createObjectStore('knowledgeBase', { keyPath: 'id' });
          kbStore.createIndex('by-module', 'module');
        }
      },
    });
  }
  return dbPromise;
}

/* ================= SETTINGS ================= */

export async function loadSchoolConfig(): Promise<SchoolConfig> {
  const db = await getDb();
  const saved = await db.get('settings', 'school_config');
  if (!saved) {
    await db.put('settings', DEFAULT_SCHOOL_CONFIG);
    return DEFAULT_SCHOOL_CONFIG;
  }
  const resolvedRenovaLogo =
    !saved.renovaLogo || saved.renovaLogo === '/assets/renova-logo.png'
      ? DEFAULT_SCHOOL_CONFIG.renovaLogo
      : saved.renovaLogo;
  return {
    ...DEFAULT_SCHOOL_CONFIG,
    ...saved,
    renovaLogo: resolvedRenovaLogo,
    userProfile: {
      name: '',
      specialty: '',
      signatureDataUrl: '',
      ...(saved.userProfile || {}),
    },
    diploma: {
      ...DEFAULT_SCHOOL_CONFIG.diploma,
      ...(saved.diploma || {}),
      levelMap: {
        ...DEFAULT_SCHOOL_CONFIG.diploma.levelMap,
        ...(saved.diploma?.levelMap || {}),
      },
      homeroomTeachers: {
        ...DEFAULT_SCHOOL_CONFIG.diploma.homeroomTeachers,
        ...(saved.diploma?.homeroomTeachers || {}),
      },
    },
  };
}

export async function saveSchoolConfig(config: SchoolConfig): Promise<void> {
  const db = await getDb();
  await db.put('settings', { ...config, id: 'school_config' });
}

/* ================= PIN CRYPTO (LOCAL ONLY) ================= */

export async function hashPin(pin: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt =
    saltHex ||
    Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  const encoded = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const hash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { hash, salt };
}

export async function verifyPin(pin: string, config: SchoolConfig): Promise<boolean> {
  if (!config.pinHash || !config.pinSalt) return false;
  const { hash } = await hashPin(pin, config.pinSalt);
  return hash === config.pinHash;
}

/* ================= DOCUMENTS HISTORY ================= */

export async function saveDocumentToHistory<T>(doc: SavedDocument<T>): Promise<void> {
  const db = await getDb();
  await db.put('documents', doc as SavedDocument);
}

export async function getAllDocuments(): Promise<SavedDocument[]> {
  const db = await getDb();
  const list = await db.getAll('documents');
  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getDocumentsByModule(module: ModuleId): Promise<SavedDocument[]> {
  const db = await getDb();
  const list = await db.getAllFromIndex('documents', 'by-module', module);
  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteDocumentFromHistory(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('documents', id);
}

/* ================= TEMPLATES LIBRARY ================= */

export async function saveTemplate(template: ExtractedTemplate): Promise<void> {
  const db = await getDb();
  await db.put('templates', template);
}

export async function getAllTemplates(): Promise<ExtractedTemplate[]> {
  const db = await getDb();
  const list = await db.getAll('templates');
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getTemplatesByModule(module: ModuleId): Promise<ExtractedTemplate[]> {
  const db = await getDb();
  const list = await db.getAllFromIndex('templates', 'by-module', module);
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('templates', id);
}

/* ================= KNOWLEDGE BASE (LEY CRECER JUNTOS / REGLAMENTO) ================= */

export async function saveKnowledgeDoc(doc: KnowledgeDoc): Promise<void> {
  const db = await getDb();
  await db.put('knowledgeBase', doc);
}

export async function getKnowledgeDocsByModule(module: ModuleId): Promise<KnowledgeDoc[]> {
  const db = await getDb();
  const list = await db.getAllFromIndex('knowledgeBase', 'by-module', module);
  return list.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function deleteKnowledgeDoc(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('knowledgeBase', id);
}

/* ================= FULL LOCAL BACKUP & RESTORE (JSON) ================= */

export interface DatabaseStats {
  documents: number;
  templates: number;
  knowledgeBase: number;
}

export interface DatabaseBackupPayload {
  app: 'CASM Docente' | 'Asistente Docente';
  schemaVersion: number;
  exportedAt: string;
  stores: {
    settings: SchoolConfig | null;
    documents: SavedDocument[];
    templates: ExtractedTemplate[];
    knowledgeBase: KnowledgeDoc[];
  };
}

const VALID_MODULE_IDS = new Set<string>([
  'bitacora',
  'planificacion',
  'examenes',
  'jornalizacion',
  'actas',
  'guias',
  'temarios',
  'diplomas',
  'grados',
  'desempeno',
]);

function stripDangerousKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripDangerousKeys(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      clean[k] = stripDangerousKeys(v);
    }
    return clean as T;
  }
  return value;
}

function mergeWithDefaultConfig(
  incoming: Partial<SchoolConfig> | null | undefined,
  currentConfig: SchoolConfig
): SchoolConfig {
  const safeIncoming = incoming && typeof incoming === 'object' ? incoming : {};
  const merged: SchoolConfig = {
    ...DEFAULT_SCHOOL_CONFIG,
    ...safeIncoming,
    id: 'school_config',
    gradingScale:
      safeIncoming.gradingScale === 'percentage' || safeIncoming.gradingScale === 'points'
        ? safeIncoming.gradingScale
        : DEFAULT_SCHOOL_CONFIG.gradingScale,
    teachers: Array.isArray(safeIncoming.teachers)
      ? safeIncoming.teachers
      : DEFAULT_SCHOOL_CONFIG.teachers,
    grades: Array.isArray(safeIncoming.grades)
      ? safeIncoming.grades.filter((g): g is string => typeof g === 'string' && g.trim().length > 0)
      : DEFAULT_SCHOOL_CONFIG.grades,
    sections: Array.isArray(safeIncoming.sections)
      ? safeIncoming.sections.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : DEFAULT_SCHOOL_CONFIG.sections,
    subjects: Array.isArray(safeIncoming.subjects)
      ? safeIncoming.subjects.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : DEFAULT_SCHOOL_CONFIG.subjects,
    calendarEvents: Array.isArray(safeIncoming.calendarEvents)
      ? safeIncoming.calendarEvents
      : DEFAULT_SCHOOL_CONFIG.calendarEvents,
    reminders: Array.isArray(safeIncoming.reminders)
      ? safeIncoming.reminders
      : DEFAULT_SCHOOL_CONFIG.reminders,
    userProfile: {
      name:
        typeof safeIncoming.userProfile?.name === 'string' ? safeIncoming.userProfile.name : '',
      specialty:
        typeof safeIncoming.userProfile?.specialty === 'string'
          ? safeIncoming.userProfile.specialty
          : '',
      signatureDataUrl:
        typeof safeIncoming.userProfile?.signatureDataUrl === 'string'
          ? safeIncoming.userProfile.signatureDataUrl
          : '',
    },
    diploma: {
      ...DEFAULT_SCHOOL_CONFIG.diploma,
      ...(safeIncoming.diploma && typeof safeIncoming.diploma === 'object' ? safeIncoming.diploma : {}),
      levelMap: {
        ...DEFAULT_SCHOOL_CONFIG.diploma.levelMap,
        ...(safeIncoming.diploma?.levelMap && typeof safeIncoming.diploma.levelMap === 'object'
          ? safeIncoming.diploma.levelMap
          : {}),
      },
      homeroomTeachers: {
        ...DEFAULT_SCHOOL_CONFIG.diploma.homeroomTeachers,
        ...(safeIncoming.diploma?.homeroomTeachers &&
        typeof safeIncoming.diploma.homeroomTeachers === 'object'
          ? safeIncoming.diploma.homeroomTeachers
          : {}),
      },
    },
    // Always preserve this device's active PIN credentials and tutorial flag so restoring never locks the teacher out
    pinHash: currentConfig.pinHash,
    pinSalt: currentConfig.pinSalt,
    hasSeenTutorial: currentConfig.hasSeenTutorial ?? safeIncoming.hasSeenTutorial,
  };
  return merged;
}

export async function getDatabaseStats(): Promise<DatabaseStats> {
  const db = await getDb();
  const tx = db.transaction(['documents', 'templates', 'knowledgeBase'], 'readonly');
  const [documents, templates, knowledgeBase] = await Promise.all([
    tx.objectStore('documents').count(),
    tx.objectStore('templates').count(),
    tx.objectStore('knowledgeBase').count(),
    tx.done,
  ]);
  return { documents, templates, knowledgeBase };
}

export async function exportDatabaseBackup(): Promise<DatabaseBackupPayload> {
  const db = await getDb();
  const tx = db.transaction(['settings', 'documents', 'templates', 'knowledgeBase'], 'readonly');
  const [savedSettings, documents, templates, knowledgeBase] = await Promise.all([
    tx.objectStore('settings').get('school_config'),
    tx.objectStore('documents').getAll(),
    tx.objectStore('templates').getAll(),
    tx.objectStore('knowledgeBase').getAll(),
    tx.done,
  ]);

  let sanitizedSettings: SchoolConfig | null = null;
  if (savedSettings) {
    // Strip PIN hash and salt from exported JSON backup for device security
    const { pinHash: _pinHash, pinSalt: _pinSalt, ...rest } = savedSettings;
    void _pinHash;
    void _pinSalt;
    sanitizedSettings = rest as SchoolConfig;
  }

  return {
    app: 'Asistente Docente',
    schemaVersion: DB_VERSION,
    exportedAt: new Date().toISOString(),
    stores: {
      settings: sanitizedSettings,
      documents,
      templates,
      knowledgeBase,
    },
  };
}

export function validateBackupPayload(raw: unknown): DatabaseBackupPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('El archivo no contiene un objeto JSON válido.');
  }

  const sanitized = stripDangerousKeys(raw) as Record<string, unknown>;
  if (sanitized.app !== 'CASM Docente' && sanitized.app !== 'Asistente Docente') {
    throw new Error('Este archivo no corresponde a un respaldo válido de Asistente Docente.');
  }

  const schemaVersion = Number(sanitized.schemaVersion);
  if (!Number.isFinite(schemaVersion) || schemaVersion < 1 || schemaVersion > DB_VERSION) {
    throw new Error(
      `Versión de respaldo no compatible (versión ${String(sanitized.schemaVersion ?? 'desconocida')}).`
    );
  }

  const stores = sanitized.stores as Record<string, unknown> | undefined;
  if (!stores || typeof stores !== 'object' || Array.isArray(stores)) {
    throw new Error('El respaldo no incluye la estructura de datos esperada.');
  }

  const rawDocs = Array.isArray(stores.documents) ? stores.documents : null;
  const rawTemplates = Array.isArray(stores.templates) ? stores.templates : null;
  const rawKb = Array.isArray(stores.knowledgeBase) ? stores.knowledgeBase : null;

  if (!rawDocs || !rawTemplates || !rawKb) {
    throw new Error('Faltan colecciones requeridas (documentos, plantillas o normativa) en el respaldo.');
  }

  const documents = rawDocs.filter((item): item is SavedDocument => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const rec = item as Record<string, unknown>;
    return (
      typeof rec.id === 'string' &&
      rec.id.trim().length > 0 &&
      typeof rec.module === 'string' &&
      VALID_MODULE_IDS.has(rec.module) &&
      typeof rec.title === 'string'
    );
  });

  const templates = rawTemplates.filter((item): item is ExtractedTemplate => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const rec = item as Record<string, unknown>;
    return (
      typeof rec.id === 'string' &&
      rec.id.trim().length > 0 &&
      typeof rec.module === 'string' &&
      VALID_MODULE_IDS.has(rec.module) &&
      typeof rec.name === 'string'
    );
  });

  const knowledgeBase = rawKb.filter((item): item is KnowledgeDoc => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const rec = item as Record<string, unknown>;
    return (
      typeof rec.id === 'string' &&
      rec.id.trim().length > 0 &&
      typeof rec.module === 'string' &&
      VALID_MODULE_IDS.has(rec.module) &&
      typeof rec.title === 'string' &&
      typeof rec.contentText === 'string'
    );
  });

  const rawSettings =
    stores.settings && typeof stores.settings === 'object' && !Array.isArray(stores.settings)
      ? (stores.settings as SchoolConfig)
      : null;

  return {
    app: 'Asistente Docente',
    schemaVersion,
    exportedAt:
      typeof sanitized.exportedAt === 'string' ? sanitized.exportedAt : new Date().toISOString(),
    stores: {
      settings: rawSettings,
      documents,
      templates,
      knowledgeBase,
    },
  };
}

export async function importDatabaseBackup(
  raw: unknown,
  mode: 'merge' | 'replace' = 'merge'
): Promise<{ config: SchoolConfig; counts: DatabaseStats }> {
  const payload = validateBackupPayload(raw);
  const currentConfig = await loadSchoolConfig();
  const nextConfig = payload.stores.settings
    ? mergeWithDefaultConfig(payload.stores.settings, currentConfig)
    : currentConfig;

  const db = await getDb();
  const tx = db.transaction(['settings', 'documents', 'templates', 'knowledgeBase'], 'readwrite');

  const settingsStore = tx.objectStore('settings');
  const docStore = tx.objectStore('documents');
  const tplStore = tx.objectStore('templates');
  const kbStore = tx.objectStore('knowledgeBase');

  if (mode === 'replace') {
    await Promise.all([docStore.clear(), tplStore.clear(), kbStore.clear()]);
  }

  await settingsStore.put(nextConfig);

  await Promise.all([
    ...payload.stores.documents.map((doc) => docStore.put(doc)),
    ...payload.stores.templates.map((tpl) => tplStore.put(tpl)),
    ...payload.stores.knowledgeBase.map((kb) => kbStore.put(kb)),
  ]);

  const [documents, templates, knowledgeBase] = await Promise.all([
    docStore.count(),
    tplStore.count(),
    kbStore.count(),
  ]);

  await tx.done;

  return {
    config: nextConfig,
    counts: { documents, templates, knowledgeBase },
  };
}

/* ================= MIS GRADOS & DESEMPEÑO ESCOLAR HELPERS ================= */

export async function loadClassroomsRegistry(): Promise<ClassroomGrade[]> {
  const db = await getDb();
  const doc = await db.get('documents', 'classroom_grades_registry');
  if (doc && doc.data && Array.isArray((doc.data as any).classrooms)) {
    return (doc.data as any).classrooms as ClassroomGrade[];
  }
  return [];
}

export async function saveClassroomsRegistry(classrooms: ClassroomGrade[]): Promise<void> {
  const db = await getDb();
  // Auto-mirror to localStorage for instant local backup
  try {
    localStorage.setItem('casm_classrooms_registry_backup', JSON.stringify(classrooms));
  } catch {
    // ignore
  }

  await db.put('documents', {
    id: 'classroom_grades_registry',
    module: 'grados',
    title: `Registro de Grados y Alumnos (${classrooms.length} aulas)`,
    grade: 'Todos',
    section: 'General',
    subject: 'Aulas',
    period: '2026',
    date: new Date().toISOString().slice(0, 10),
    orientation: 'portrait',
    pageSize: 'letter',
    data: { classrooms },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function loadGradebook(
  classroomId: string,
  period: string
): Promise<ClassroomGradebook | null> {
  const db = await getDb();
  const doc = await db.get('documents', `gradebook-${classroomId}-${period}`);
  if (doc && doc.data) {
    return doc.data as ClassroomGradebook;
  }
  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(`casm_gradebook_${classroomId}_${period}`);
    if (raw) return JSON.parse(raw) as ClassroomGradebook;
  } catch {
    // ignore
  }
  return null;
}

export async function saveGradebook(gradebook: ClassroomGradebook): Promise<void> {
  const db = await getDb();
  // Auto-mirror to localStorage for instant local backup
  try {
    localStorage.setItem(
      `casm_gradebook_${gradebook.classroomId}_${gradebook.period}`,
      JSON.stringify(gradebook)
    );
  } catch {
    // ignore
  }

  await db.put('documents', {
    id: `gradebook-${gradebook.classroomId}-${gradebook.period}`,
    module: 'desempeno',
    title: `Libro de Calificaciones — ${gradebook.gradeName} ${gradebook.section} (${gradebook.period})`,
    grade: gradebook.gradeName,
    section: gradebook.section,
    subject: 'Desempeño Integral',
    period: gradebook.period,
    date: new Date().toISOString().slice(0, 10),
    orientation: 'landscape',
    pageSize: 'letter',
    data: gradebook,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

/* ================= RESPALDO, RESTAURACIÓN Y EXPORTACIÓN COMPLETA ================= */

export async function exportFullBackupJSON(): Promise<void> {
  const db = await getDb();
  const allDocs = await db.getAll('documents');
  const allSettings = await db.getAll('settings');
  const allTemplates = await db.getAll('templates');

  const localDump: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('casm') || key.startsWith('CASM') || key.startsWith('asistente') || key.startsWith('ASISTENTE'))) {
      localDump[key] = localStorage.getItem(key) || '';
    }
  }

  const payload = {
    app: 'ASISTENTE_DOCENTE',
    version: 2,
    exportedAt: new Date().toISOString(),
    documents: allDocs,
    settings: allSettings,
    templates: allTemplates,
    localStorage: localDump,
  };

  const jsonStr =
    'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
  const dl = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  dl.href = jsonStr;
  dl.download = `Asistente_Docente_Respaldo_Completo_${dateStr}.json`;
  document.body.appendChild(dl);
  dl.click();
  dl.remove();
}

export async function importFullBackupJSON(file: File): Promise<void> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const db = await getDb();

  if (Array.isArray(parsed.documents)) {
    const tx = db.transaction('documents', 'readwrite');
    for (const doc of parsed.documents) {
      await tx.store.put(doc);
    }
    await tx.done;
  }

  const configList = Array.isArray(parsed.settings) ? parsed.settings : Array.isArray(parsed.config) ? parsed.config : null;
  if (configList) {
    const tx = db.transaction('settings', 'readwrite');
    for (const c of configList) {
      await tx.store.put(c);
    }
    await tx.done;
  }

  if (Array.isArray(parsed.templates)) {
    const tx = db.transaction('templates', 'readwrite');
    for (const t of parsed.templates) {
      await tx.store.put(t);
    }
    await tx.done;
  }

  if (parsed.localStorage && typeof parsed.localStorage === 'object') {
    for (const [k, v] of Object.entries(parsed.localStorage)) {
      if (typeof v === 'string') localStorage.setItem(k, v);
    }
  }

  window.location.reload();
}

export async function exportRosterAndGradesCSV(): Promise<void> {
  const classrooms = await loadClassroomsRegistry();
  if (classrooms.length === 0) {
    alert('No hay grados ni alumnos registrados para exportar.');
    return;
  }
  const cls = classrooms[0];
  const gb = await loadGradebook(cls.id, 'Trimestre 1');
  const subjects = gb?.subjects || [
    'Lenguaje y Literatura',
    'Matemática',
    'Ciencia y Tecnología',
    'Estudios Sociales',
    'Inglés',
  ];

  const headers = ['N°', 'Alumno(a)', ...subjects, 'Promedio', 'Conducta', 'Inasistencias'];
  const rows = cls.students.map((st, i) => {
    const rec = gb?.records?.find((r) => r.studentId === st.id);
    const subScores = subjects.map((s) => {
      const sc = rec?.scores?.[s]?.score;
      return sc !== undefined ? sc.toFixed(1) : '-';
    });
    return [
      i + 1,
      `"${st.fullName}"`,
      ...subScores,
      '8.5',
      `"${rec?.conductScore || 'Muy Bueno'}"`,
      rec?.absences || 0,
    ].join(',');
  });

  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Nomina_y_Notas_${cls.gradeName}_${cls.section}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function promptResetAllData(): Promise<void> {
  const choice = prompt(
    '¿Deseas reiniciar los datos de Asistente Docente?\n\n' +
      '- Escribe "DEMO" para recargar datos y ejemplos de prueba.\n' +
      '- Escribe "BLANCO" para vaciar todo e iniciar desde cero.\n\n' +
      '(Presiona Cancelar para salir sin hacer cambios):',
    'DEMO'
  );

  if (!choice) return;

  const db = await getDb();
  await db.clear('documents');
  await db.clear('templates');

  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && (k.startsWith('casm') || k.startsWith('CASM') || k.startsWith('asistente') || k.startsWith('ASISTENTE'))) {
      localStorage.removeItem(k);
    }
  }

  if (choice.toUpperCase() === 'BLANCO') {
    alert('Sistema vaciado con éxito.');
  } else {
    alert('Datos de prueba reiniciados.');
  }
  window.location.reload();
}

export async function loadIncidentsForStudent(
  studentFullName: string
): Promise<SavedDocument<IncidentLogData>[]> {
  const db = await getDb();
  const allIncidents = await db.getAllFromIndex('documents', 'by-module', 'bitacora');
  const normalized = studentFullName.toLowerCase().trim();
  if (!normalized) return [];

  return (allIncidents as SavedDocument<IncidentLogData>[]).filter((doc) => {
    const data = doc.data;
    if (!data) return false;
    const est = (data.estudiantesInvolucrados || '').toLowerCase();
    const desc = (data.descripcionHechos || '').toLowerCase();
    return est.includes(normalized) || desc.includes(normalized);
  });
}

