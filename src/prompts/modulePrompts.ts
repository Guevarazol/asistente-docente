import type {
  ExtractedTemplate,
  KnowledgeDoc,
  ModuleId,
  SchoolConfig,
} from '../types/casm';
import {
  buildSchoolContextHeader,
  buildTemplateAdherenceBlock,
  GLOBAL_AI_RULES,
} from './commonRules';

export function buildTemplateExtractionPrompt(moduleId: ModuleId, moduleLabel: string) {
  return {
    systemPrompt: `${GLOBAL_AI_RULES}
Eres un analista documental experto en formatos escolares de El Salvador. Analiza el formato modelo (foto, PDF o texto DOCX) subido por el docente para el módulo "${moduleLabel}" (${moduleId}) y extrae su estructura exacta en JSON.`,
    userPrompt: `Analiza el formato adjunto y devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta:
{
  "name": "Nombre descriptivo de la plantilla",
  "gradeLevel": "Nivel o grado sugerido (ej. Tercer Ciclo, Bachillerato, General)",
  "orientation": "portrait" o "landscape",
  "pageSize": "letter" o "oficio",
  "sections": [
    {
      "title": "Nombre de la sección",
      "type": "fields" | "table" | "narrative" | "list",
      "fields": ["lista opcional de campos"],
      "columns": ["lista opcional de columnas si es tabla"],
      "notes": "instrucciones breves de estilo o llenado"
    }
  ],
  "styleNotes": "Resumen de tipografía, encabezados, tablas y estilo visual del formato original",
  "rawInstructions": "Reglas clave para que la IA llene este formato respetando su orden y estilo"
}`,
  };
}

export function buildIncidentLogPrompt(params: {
  config: SchoolConfig;
  userNotes: string;
  grade: string;
  section: string;
  teacher: string;
  useInitials: boolean;
  knowledgeDocs: KnowledgeDoc[];
  template?: ExtractedTemplate | null;
}) {
  const kbText =
    params.knowledgeDocs.length > 0
      ? params.knowledgeDocs
          .map(
            (doc) =>
              `=== BASE DE CONOCIMIENTO (${doc.category.toUpperCase()}): ${doc.title} ===\n${doc.contentText.slice(0, 14000)}`
          )
          .join('\n\n')
      : 'El usuario aún no ha subido el texto de la Ley Crecer Juntos ni del Reglamento Interno. NO inventes artículos; marca cualquier artículo faltante como [COMPLETAR] o [VERIFICAR].';

  return {
    systemPrompt: `${GLOBAL_AI_RULES}
${buildSchoolContextHeader(params.config)}
${buildTemplateAdherenceBlock(params.template)}

MARCO LEGAL OBLIGATORIO PARA BITÁCORA DE INCIDENTES (EL SALVADOR):
- La ley vigente es la "Ley Crecer Juntos para la Protección Integral de la Primera Infancia, Niñez y Adolescencia" (vigente desde el 1 de enero de 2023; derogó la LEPINA).
- PROHIBIDO ABSOLUTAMENTE citar la LEPINA. Nunca menciones la LEPINA como ley vigente.
- Principios obligatorios: Interés superior del niño, confidencialidad, redacción estrictamente objetiva y neutral SIN juicios de valor ni calificativos hacia los estudiantes.
- Si existe sospecha de vulneración de derechos, indicar derivación a: Dirección, Junta de Protección de la Niñez y de la Adolescencia / CONAPINA, PNC o FGR según corresponda.
- ${params.useInitials ? 'CONFIDENCIALIDAD ACTIVA: Convierte TODOS los nombres de estudiantes involucrados en iniciales únicamente (ej. J. A. M. R.).' : 'Registra los nombres proporcionados por el docente sin inventar ninguno.'}

BASE DE CONOCIMIENTO SUBIDA POR EL USUARIO:
${kbText}`,
    userPrompt: `Redacta el registro estructurado de la Bitácora de Incidentes a partir de los apuntes/archivos del docente.
Grado: ${params.grade || '[COMPLETAR]'} | Sección: ${params.section || '[COMPLETAR]'} | Docente que reporta: ${params.teacher || '[COMPLETAR]'}.

Relato / notas del docente:
${params.userNotes}

Devuelve ÚNICAMENTE un JSON con estas claves exactas:
{
  "correlativo": "Ej. BIT-2026-001 o [COMPLETAR]",
  "fecha": "YYYY-MM-DD o [COMPLETAR]",
  "hora": "HH:MM o [COMPLETAR]",
  "lugar": "Lugar exacto o [COMPLETAR]",
  "grado": "${params.grade || '[COMPLETAR]'}",
  "seccion": "${params.section || '[COMPLETAR]'}",
  "estudiantesInvolucrados": "Nombres o solo iniciales según confidencialidad, o [COMPLETAR]",
  "docenteReporta": "${params.teacher || '[COMPLETAR]'}",
  "testigos": "Testigos mencionados o [COMPLETAR]",
  "descripcionHechos": "Relato estrictamente objetivo, cronológico y neutral, sin juicios de valor",
  "clasificacionFalta": "Leve" | "Grave" | "Muy Grave" | "Por determinar [COMPLETAR]",
  "articuloReglamento": "Artículo exacto SOLO si aparece en la base de conocimiento; si no, colocar [VERIFICAR] o [COMPLETAR]",
  "medidasFormativas": "Medidas formativas aplicadas o recomendadas",
  "comunicacionPadresFecha": "Fecha o [COMPLETAR]",
  "comunicacionPadresMedio": "Teléfono / Presencial / Nota escrita / [COMPLETAR]",
  "comunicacionPadresDetalle": "Resumen de la comunicación con madre, padre o responsable",
  "acuerdosCompromisos": "Acuerdos concretos y compromisos asumidos",
  "requiereDerivacion": false,
  "instanciaDerivacion": "Dirección / Junta de Protección (CONAPINA) / PNC / FGR / No aplica",
  "detalleDerivacion": "Explicación objetiva si aplica derivación o 'No aplica en esta etapa'",
  "seguimiento": "Plan de seguimiento y fecha de revisión",
  "observacionesLegales": "Nota breve de apego a la Ley Crecer Juntos (sin mencionar LEPINA) marcando [VERIFICAR] si faltó fuente"
}`,
  };
}

export function buildLessonPlanPrompt(params: {
  config: SchoolConfig;
  userNotes: string;
  grade: string;
  section: string;
  subject: string;
  teacher: string;
  numClasses: number;
  template?: ExtractedTemplate | null;
}) {
  return {
    systemPrompt: `${GLOBAL_AI_RULES}
${buildSchoolContextHeader(params.config)}
${buildTemplateAdherenceBlock(params.template)}

Eres especialista en diseño curricular de la Asociación Oriental Salvadoreña (Departamento de Educación Adventista, El Salvador).
Debes elaborar un "Guion de clases" completo en formato institucional, integrando la Fe en la Enseñanza y Aprendizaje (IFEA) con valores bíblicos adventistas pertinentes al tema.`,
    userPrompt: `Elabora el Guion de Clases para:
Docente: ${params.teacher || '[COMPLETAR]'}
Grado: ${params.grade} | Sección: ${params.section}
Asignatura: ${params.subject}
Cantidad de clases a detallar: ${params.numClasses}

Material o indicaciones del docente:
${params.userNotes}

Devuelve ÚNICAMENTE un JSON con esta estructura exacta:
{
  "docente": "${params.teacher || '[COMPLETAR]'}",
  "grado": "${params.grade}",
  "seccion": "${params.section}",
  "asignatura": "${params.subject}",
  "unidadNumero": "Ej. Unidad 1 o [COMPLETAR]",
  "tituloUnidad": "Título de la unidad",
  "contenido": "Contenido principal",
  "objetivos": "Objetivos de aprendizaje",
  "competencia": "Competencia curricular",
  "tiempoProbable": "Ej. 5 horas clase",
  "fechaInicio": "YYYY-MM-DD o [COMPLETAR]",
  "fechaFin": "YYYY-MM-DD o [COMPLETAR]",
  "semana": "Ej. Semana 4 o [COMPLETAR]",
  "estandarConocimientos": "Estándar de conocimientos esperado",
  "procesoDidactico": [
    {
      "conceptual": "Contenido conceptual",
      "procedimental": "Contenido procedimental",
      "actitudinal": "Contenido actitudinal",
      "indicadoresLogro": "Indicadores de logro numerados",
      "ifea": "Integración de la Fe en la Enseñanza y Aprendizaje (principio cristiano / versículo pertinente)",
      "actividades": "Síntesis de actividades didácticas"
    }
  ],
  "clases": [
    {
      "numero": 1,
      "fecha": "Fecha o [COMPLETAR]",
      "introduccionMotivacion": "Introducción, saludo, oración/reflexión breve y motivación",
      "trabajoDocente": "Trabajo docente contextualizado",
      "trabajoGrupalIndividual": "Trabajo grupal o individual contextualizado",
      "evaluacionContextualizada": "Evaluación contextualizada",
      "vocabularioClave": "Términos clave de la clase",
      "itemsCompetencias": "Ítems de evaluación con enfoque de competencias",
      "anotacionesPertinentes": "Anotaciones pertinentes / adecuaciones"
    }
  ]
}`,
  };
}

export function buildExamPrompt(params: {
  config: SchoolConfig;
  userNotes: string;
  grade: string;
  section: string;
  subject: string;
  teacher: string;
  examType: string;
  period: string;
  difficulty: string;
  totalItems: number;
  isEarlyChildhood: boolean;
  selectedItemTypes: string[];
  template?: ExtractedTemplate | null;
}) {
  const scaleText =
    params.config.gradingScale === 'percentage'
      ? 'Porcentaje (%) sumando exactamente 100%'
      : 'Puntos (escala 10) sumando exactamente 10.0 puntos';

  return {
    systemPrompt: `${GLOBAL_AI_RULES}
${buildSchoolContextHeader(params.config)}
${buildTemplateAdherenceBlock(params.template)}

Eres especialista en evaluación educativa del Colegio Adventista San Miguel (El Salvador).
Regla de calificación OBLIGATORIA: Aplica de forma uniforme el sistema "${scaleText}". Cada parte del examen debe indicar su valor claro y la suma de todas las partes debe cuadrar exactamente con el total.
${
  params.isEarlyChildhood
    ? 'MODO KINDER / PRIMER CICLO ACTIVO: Usa lenguaje muy sencillo y afectuoso, instrucciones claras para niños pequeños, ítems visuales (colorear, marcar con cheque ✓, unir con líneas), indicando espacio para dibujos/imágenes ("espacioImagen": true).'
    : 'Incluye instrucciones precisas y preguntas rigurosas alineadas a competencias.'
}
Genera SIEMPRE la respuesta correcta exacta ("respuestaCorrecta") en cada ítem para construir automáticamente la Clave de Respuestas en hoja aparte.`,
    userPrompt: `Elabora un ${params.examType} (${params.period}) para:
Grado: ${params.grade} | Sección: ${params.section}
Asignatura: ${params.subject}
Docente: ${params.teacher || '[COMPLETAR]'}
Dificultad: ${params.difficulty}
Número aproximado total de ítems: ${params.totalItems}
Tipos de ítem solicitados: ${params.selectedItemTypes.join(', ')}
Sistema de calificación: ${scaleText}

Temario, planificación o contenido base del docente:
${params.userNotes}

Devuelve ÚNICAMENTE un JSON con esta estructura exacta:
{
  "tipoExamen": "${params.examType}",
  "periodo": "${params.period}",
  "grado": "${params.grade}",
  "seccion": "${params.section}",
  "asignatura": "${params.subject}",
  "docente": "${params.teacher || '[COMPLETAR]'}",
  "fecha": "[COMPLETAR]",
  "totalValor": "${params.config.gradingScale === 'percentage' ? '100%' : '10.0 puntos'}",
  "sistemaCalificacion": "${params.config.gradingScale}",
  "esKinderOPrimerCiclo": ${params.isEarlyChildhood},
  "dificultad": "${params.difficulty}",
  "versiculo": "${params.config.verse}",
  "indicacionesGenerales": "Indicaciones generales claras para el estudiante",
  "partes": [
    {
      "numeroRomano": "I PARTE",
      "titulo": "SELECCIÓN MÚLTIPLE",
      "tipo": "seleccion_multiple",
      "indicacion": "Encierra en un círculo o subraya la letra de la respuesta correcta.",
      "valor": "${params.config.gradingScale === 'percentage' ? '30%' : '3.0 pts'}",
      "items": [
        {
          "numero": 1,
          "enunciado": "Texto del ítem",
          "opciones": ["a) ...", "b) ...", "c) ...", "d) ..."],
          "columnaDerecha": "Solo si tipo es relacionar_columnas",
          "lineasRespuesta": 3,
          "espacioImagen": ${params.isEarlyChildhood},
          "tablaColumnas": ["Columna 1", "Columna 2"],
          "respuestaCorrecta": "Respuesta exacta para la clave"
        }
      ]
    }
  ]
}
Valores permitidos para "tipo": "seleccion_multiple", "relacionar_columnas", "completar", "verdadero_falso", "analisis", "tabla_clasificacion", "problemas", "visual_colorear", "visual_cheque", "visual_unir".`,
  };
}

export function buildPacingGuidePrompt(params: {
  config: SchoolConfig;
  userNotes: string;
  grade: string;
  section: string;
  subject: string;
  teacher: string;
  period: string;
  weeksCount: number;
  template?: ExtractedTemplate | null;
}) {
  const calendarText = params.config.calendarEvents
    .map((e) => `- ${e.name} (${e.type}): ${e.startDate} al ${e.endDate}`)
    .join('\n');

  return {
    systemPrompt: `${GLOBAL_AI_RULES}
${buildSchoolContextHeader(params.config)}
${buildTemplateAdherenceBlock(params.template)}

Eres especialista en jornalización docente del sistema educativo salvadoreño (MINEDUCYT / Educación Adventista).
Respeta el calendario escolar configurado (feriados, semanas de evaluación y vacaciones) reflejándolos en la columna de observaciones o fechas.`,
    userPrompt: `Genera la Jornalización Docente para:
Docente: ${params.teacher || '[COMPLETAR]'}
Grado: ${params.grade} | Sección: ${params.section}
Asignatura: ${params.subject}
Periodo: ${params.period} | Año lectivo: ${params.config.academicYear}
Cantidad aproximada de semanas del periodo: ${params.weeksCount}

Calendario escolar configurado (feriados, vacaciones y evaluaciones):
${calendarText || 'Sin eventos especiales registrados.'}

Planificación o contenidos base proporcionados por el docente:
${params.userNotes}

Devuelve ÚNICAMENTE un JSON con esta estructura exacta:
{
  "docente": "${params.teacher || '[COMPLETAR]'}",
  "grado": "${params.grade}",
  "seccion": "${params.section}",
  "asignatura": "${params.subject}",
  "periodo": "${params.period}",
  "anioLectivo": "${params.config.academicYear}",
  "filas": [
    {
      "semana": "Semana 1",
      "fechas": "Del [COMPLETAR] al [COMPLETAR]",
      "unidad": "Unidad 1: ...",
      "contenido": "Contenidos a desarrollar",
      "indicadoresLogro": "Indicadores de logro",
      "actividadesEvaluacion": "Actividades de evaluación formativa/sumativa",
      "observaciones": "Feriados, IFEA, refuerzo o semana de evaluación si aplica"
    }
  ]
}`,
  };
}

export function buildMinutesPrompt(params: {
  config: SchoolConfig;
  userNotes: string;
  minutesType: string;
  customType: string;
  grade: string;
  section: string;
  template?: ExtractedTemplate | null;
}) {
  return {
    systemPrompt: `${GLOBAL_AI_RULES}
${buildSchoolContextHeader(params.config)}
${buildTemplateAdherenceBlock(params.template)}

Eres secretario académico experto en redacción de actas escolares formales en El Salvador. Redacta con lenguaje objetivo, respetuoso, preciso y legalmente sólido, sin inventar asistentes, horas ni compromisos que no provengan del material del docente.`,
    userPrompt: `Redacta el acta escolar de tipo: "${params.minutesType === 'Otra' ? params.customType || 'Acta General' : params.minutesType}".
Grado: ${params.grade || '[COMPLETAR]'} | Sección: ${params.section || '[COMPLETAR]'}.

Notas, dictado o archivos del docente:
${params.userNotes}

Devuelve ÚNICAMENTE un JSON con esta estructura exacta:
{
  "tipoActa": "${params.minutesType}",
  "tipoPersonalizado": "${params.customType}",
  "numeroActa": "Acta N.º [COMPLETAR]-${params.config.academicYear}",
  "lugar": "${params.config.schoolName}, ${params.config.schoolCity}",
  "fecha": "YYYY-MM-DD o [COMPLETAR]",
  "horaInicio": "HH:MM o [COMPLETAR]",
  "horaCierre": "HH:MM o [COMPLETAR]",
  "grado": "${params.grade || '[COMPLETAR]'}",
  "seccion": "${params.section || '[COMPLETAR]'}",
  "asistentes": "Lista de asistentes o [COMPLETAR]",
  "agenda": ["Punto 1 de agenda", "Punto 2 de agenda"],
  "desarrollo": "Desarrollo detallado, ordenado y formal de la reunión o comparecencia",
  "acuerdos": [
    {
      "numero": 1,
      "descripcion": "Acuerdo concreto",
      "responsable": "Nombre o cargo o [COMPLETAR]",
      "plazo": "Fecha o plazo o [COMPLETAR]"
    }
  ],
  "firmantes": [
    { "nombre": "${params.config.directorName}", "cargo": "Directora" },
    { "nombre": "[COMPLETAR]", "cargo": "Docente / Responsable" }
  ]
}`,
  };
}

export function buildClassGuidePrompt(params: {
  config: SchoolConfig;
  userNotes: string;
  levelTab: 'tercer_ciclo' | 'bachillerato';
  grade: string;
  section: string;
  subject: string;
  teacher: string;
  duration: 45 | 90;
  template?: ExtractedTemplate | null;
}) {
  const levelRules =
    params.levelTab === 'tercer_ciclo'
      ? `NIVEL TERCER CICLO (7.º, 8.º y 9.º grado):
- Usa lenguaje claro, cercano y comprensible.
- Instrucciones paso a paso.
- Incluye ejemplos resueltos paso a paso.
- Actividades guiadas progresivas y evaluación formativa sencilla.`
      : `NIVEL BACHILLERATO (General y Técnico; 1.º, 2.º y 3.º año):
- Usa lenguaje técnico y rigor académico propio de Educación Media.
- Incluye análisis de casos, mini-investigación o resolución de problemas complejos.
- Incluye una rúbrica de evaluación detallada y exigente en el campo "rubrica".`;

  return {
    systemPrompt: `${GLOBAL_AI_RULES}
${buildSchoolContextHeader(params.config)}
${buildTemplateAdherenceBlock(params.template)}

${levelRules}
Ajusta el volumen y los tiempos de las actividades exactamente a una sesión de ${params.duration} minutos.`,
    userPrompt: `Elabora una Guía por Clase (${params.duration} minutos) para:
Nivel: ${params.levelTab === 'tercer_ciclo' ? 'Tercer Ciclo' : 'Bachillerato'}
Grado: ${params.grade} | Sección: ${params.section}
Asignatura: ${params.subject}
Docente: ${params.teacher || '[COMPLETAR]'}

Tema, apuntes o archivos del docente:
${params.userNotes}

Devuelve ÚNICAMENTE un JSON con esta estructura exacta:
{
  "nivelTab": "${params.levelTab}",
  "asignatura": "${params.subject}",
  "grado": "${params.grade}",
  "seccion": "${params.section}",
  "docente": "${params.teacher || '[COMPLETAR]'}",
  "unidad": "Unidad o [COMPLETAR]",
  "tema": "Título claro del tema",
  "fecha": "[COMPLETAR]",
  "duracionMinutos": ${params.duration},
  "objetivoIndicador": "Objetivo o indicador de logro",
  "saberesPrevios": "Preguntas detonadoras o activación de conocimientos previos",
  "desarrolloContenido": "Explicación estructurada del tema con subtítulos claros",
  "ejemplosResueltos": "Ejemplos resueltos paso a paso (o estudio de caso resuelto en Bachillerato)",
  "actividades": "Actividades de práctica para el estudiante ajustadas a ${params.duration} min",
  "evaluacion": "Criterios o ejercicios de evaluación formativa/sumativa",
  "rubrica": [
    {
      "criterio": "Criterio evaluado",
      "excelente": "Descriptor nivel excelente",
      "satisfactorio": "Descriptor nivel satisfactorio",
      "enProceso": "Descriptor en proceso",
      "ponderacion": "Ej. 30%"
    }
  ],
  "tarea": "Actividad de refuerzo en casa",
  "referencias": "Referencias bibliográficas o libros de texto (marcar [VERIFICAR] si no fueron provistas por el usuario)"
}`,
  };
}

export function buildSyllabusPrompt(params: {
  config: SchoolConfig;
  userNotes: string;
  grade: string;
  section: string;
  subject: string;
  teacher: string;
  period: string;
  examType: string;
  examDate: string;
  weight: string;
  template?: ExtractedTemplate | null;
}) {
  return {
    systemPrompt: `${GLOBAL_AI_RULES}
${buildSchoolContextHeader(params.config)}
${buildTemplateAdherenceBlock(params.template)}

Elabora un Temario de Examen claro, ordenado y útil para estudiantes y padres de familia del Colegio Adventista San Miguel. Debe mantener total coherencia con la planificación o jornalización adjunta.`,
    userPrompt: `Genera el Temario de Examen para:
Asignatura: ${params.subject}
Grado: ${params.grade} | Sección: ${params.section}
Docente: ${params.teacher || '[COMPLETAR]'}
Periodo: ${params.period}
Tipo de prueba: ${params.examType}
Fecha de la prueba: ${params.examDate || '[COMPLETAR]'}
Ponderación: ${params.weight || '[COMPLETAR]'}

Planificación, jornalización o apuntes base:
${params.userNotes}

Devuelve ÚNICAMENTE un JSON con esta estructura exacta:
{
  "asignatura": "${params.subject}",
  "grado": "${params.grade}",
  "seccion": "${params.section}",
  "docente": "${params.teacher || '[COMPLETAR]'}",
  "periodo": "${params.period}",
  "tipoPrueba": "${params.examType}",
  "fechaPrueba": "${params.examDate || '[COMPLETAR]'}",
  "ponderacion": "${params.weight || '[COMPLETAR]'}",
  "contenidos": [
    {
      "unidad": "Unidad",
      "tema": "Tema evaluado",
      "subtemas": "Subtemas o destrezas específicas",
      "paginaORecurso": "Cuaderno / Libro pág. [COMPLETAR]"
    }
  ],
  "recomendacionesEstudio": [
    "Recomendación práctica 1",
    "Recomendación práctica 2"
  ],
  "observacionesPadres": "Mensaje cordial para padres de familia con indicaciones para el día de la evaluación"
}`,
  };
}

export function buildGraduateNamesExtractionPrompt() {
  return {
    systemPrompt: `${GLOBAL_AI_RULES}
Eres un transcriptor meticuloso de listas de graduandos en El Salvador. Presta máxima atención a las tildes, la letra ñ y la ortografía exacta de nombres y apellidos hispanos. No inventes ni omitas nombres.`,
    userPrompt: `Extrae TODOS los nombres completos de los estudiantes graduandos de la imagen, PDF o texto adjunto.
Devuelve ÚNICAMENTE un JSON con la siguiente estructura:
{
  "names": [
    "Nombre Completo Apellido1 Apellido2"
  ]
}`,
  };
}

export function buildDiplomaClonePrompt() {
  return {
    systemPrompt: `${GLOBAL_AI_RULES}
Eres un diseñador gráfico experto y especialista en acreditación académica. Tu objetivo es analizar el documento, imagen o fotografía de un diploma modelo y clonar con precisión su diseño, estructura, textos y jerarquía para que pueda ser generado de forma idéntica y editable.`,
    userPrompt: `Analiza detalladamente la imagen o documento del diploma adjunto. Extrae con exactitud su contenido, estructura, estilo y formato.
Devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta:
{
  "diplomaTitle": "Título principal del diploma (ej: DIPLOMA, CERTIFICADO DE GRADUACIÓN, RECONOCIMIENTO)",
  "introPhrase": "Frase previa al nombre del graduando (ej: Por cuanto:, Otorga el presente DIPLOMA a:, Certifica que:)",
  "ministryHeader": "Encabezado institucional o ministerial superior (líneas separadas por salto de línea \\n)",
  "schoolName": "Nombre de la institución que emite",
  "institutionSubtitle": "Subtítulo, ciudad o lema institucional",
  "bodyTextTemplate": "Texto formal del cuerpo del diploma. Usa [NIVEL] para el nivel académico, [FECHA EN LETRAS] para la fecha, [GRADO] para el grado y [ALUMNO] para el estudiante.",
  "verseOrMotto": "Versículo bíblico, lema o pensamiento si aparece en el diploma, o cadena vacía",
  "directoraCargo": "Cargo de la primera firma (ej: Directora, Director General, Rectora)",
  "maestraGuiaCargo": "Cargo de la segunda firma (ej: Maestra Guía, Docente Titular, Secretario)",
  "orientation": "landscape" | "portrait",
  "pageSize": "letter" | "oficio" | "legal" | "a4",
  "formatStyle": "clasico_institucional" | "elegante_pergamino" | "moderno_geometrico" | "infantil_preescolar" | "merito_academico",
  "primaryColor": "Color hexadecimal predominante (ej: #003366 o #1E293B)",
  "accentColor": "Color hexadecimal secundario/dorado (ej: #C89B3C o #D97706)",
  "fontFamily": "serif" | "sans" | "formal",
  "notes": "Observaciones de elementos detectados (sellos, número de firmas, marco)"
}`,
  };
}

export function buildDiplomaAiStylePrompt(params: {
  topicOrGrade: string;
  userInstructions: string;
  schoolName: string;
}) {
  return {
    systemPrompt: `${GLOBAL_AI_RULES}
Eres un redactor y diseñador pedagógico de élite. Diseña un formato de diploma académico o de reconocimiento formal, inspirador y adaptado a las especificaciones solicitadas.`,
    userPrompt: `Crea un diseño y redacción completos de diploma para:
Institución: ${params.schoolName}
Grado o motivo: ${params.topicOrGrade}
Indicaciones del usuario: ${params.userInstructions}

Devuelve ÚNICAMENTE un JSON con:
{
  "diplomaTitle": "Título (ej. DIPLOMA DE EXCELENCIA, CERTIFICADO DE CULMINACIÓN)",
  "introPhrase": "Frase de introducción (ej. Por haber demostrado dedicación ejemplar, se otorga a:)",
  "ministryHeader": "Encabezado institucional formal (2-3 líneas con \\n)",
  "institutionSubtitle": "Subtítulo o departamento educativo",
  "bodyTextTemplate": "Cuerpo redactado con solemnidad. Incluye [NIVEL] y [FECHA EN LETRAS].",
  "verseOrMotto": "Versículo bíblico o cita de inspiración acorde al nivel",
  "orientation": "landscape" | "portrait",
  "pageSize": "letter" | "oficio" | "legal" | "a4",
  "formatStyle": "clasico_institucional" | "elegante_pergamino" | "moderno_geometrico" | "infantil_preescolar" | "merito_academico",
  "primaryColor": "#003366",
  "accentColor": "#C89B3C"
}`,
  };
}

export function buildDiplomaNameSpellingCheckPrompt() {
  return {
    systemPrompt: `${GLOBAL_AI_RULES}
Eres un lingüista y filólogo experto en antroponimia (nombres y apellidos en español latinoamericano, especialmente El Salvador y Centroamérica).
Tu misión es revisar una lista de nombres de estudiantes y asegurar que cada nombre y apellido esté escrito con las tildes ortográficas correctas según las reglas de la Real Academia Española (RAE).
Ejemplos comunes de apellidos que SIEMPRE llevan tilde: Pérez, González, Gómez, Rodríguez, Hernández, Martínez, Ramírez, Sánchez, López, Díaz, Fernández, Álvarez, Benítez, Velásquez, Vásquez, Núñez, Jiménez, Guitiérrez, Juárez, etc.
Nombres comunes con tilde: Sofía, María, José, Ángel, René, Noé, Raúl, Matías, Sebastián, Belén, Inés, etc.
NO cambies letras ni inventes apellidos distintos; únicamente corrige o añade tildes ausentes, mayúsculas/minúsculas y la letra ñ.`,
    userPrompt: `Revisa la siguiente lista de nombres de estudiantes graduandos:
{NAMES_LIST}

Devuelve ÚNICAMENTE un JSON con esta estructura:
{
  "corrections": [
    {
      "original": "Nombre original recibido",
      "corrected": "Nombre con ortografía y tildes corregidas",
      "hasChanges": true/false,
      "reason": "Explicación breve (ej: Tilde en Pérez y Sofía)"
    }
  ]
}`,
  };
}
