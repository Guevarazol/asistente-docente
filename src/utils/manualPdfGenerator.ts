import { jsPDF } from 'jspdf';
import type { SchoolConfig } from '../types/casm';

export interface ManualSection {
  id: string;
  chapterNum: string;
  title: string;
  badge?: string;
  summary: string;
  content: string[];
  tips?: string[];
  fictionalExample?: {
    title: string;
    description: string;
    details: string[];
  };
}

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: 'intro',
    chapterNum: '01',
    title: 'Introducción y Filosofía del Sistema',
    badge: 'Arquitectura y Privacidad',
    summary: 'Conozca los principios de seguridad, autonomía pedagógica y soberanía total de datos que rigen a Asistente Docente.',
    content: [
      'Asistente Docente es una solución informática de alta eficiencia desarrollada y respaldada por Corporación Médica Integral RENOVA y su división tecnológica RENOVA NEXUS. Su propósito central es liberar al educador de la sobrecarga administrativa repetitiva, permitiéndole concentrarse en la excelencia de la enseñanza y en la atención formativa de cada estudiante.',
      'Soberanía Local y Privacidad Absoluta de Datos: A diferencia de las plataformas centralizadas en la nube donde los expedientes de menores de edad se transmiten y almacenan en servidores foráneos, Asistente Docente funciona bajo el estándar de privacidad en el borde (Local-First). Toda la información de nóminas, calificaciones, notas disciplinarias y actas reside exclusivamente en el almacenamiento interno de su navegador (IndexedDB y LocalStorage).',
      'Cumplimiento con la Ley Crecer Juntos: La normativa vigente sobre niñez y adolescencia exige la máxima reserva y confidencialidad en los registros académicos y personales. Al operar de manera local y sin intermediarios de datos, tanto el docente como la dirección escolar mantienen el dominio legal y ético irrevocable de todos los expedientes.',
      'Funcionamiento Híbrido Autónomo (Offline / Online): La aplicación está optimizada para operar 100% desconectada de internet en salones de clase, laboratorios, zonas rurales o en el hogar. La conectividad únicamente se utiliza de manera puntual si el usuario desea emplear las funciones de Inteligencia Artificial (Gemini API) o instalar actualizaciones de software.',
    ],
    tips: [
      'Sus datos están resguardados en este navegador: efectúe con regularidad un "Respaldo JSON" desde el menú superior para asegurar una copia externa en su memoria USB o computadora.',
      'La interfaz se adapta con fluidez tanto a computadoras de escritorio y laptops portátiles como a tabletas y teléfonos móviles.',
    ],
  },
  {
    id: 'instalacion',
    chapterNum: '02',
    title: 'Instalación Local y Modalidades de Uso',
    badge: 'PWA y Archivo Autocontenido',
    summary: 'Guía para instalar la aplicación en su sistema operativo o utilizarla directamente mediante el archivo HTML independiente.',
    content: [
      'Modalidad 1: Aplicación Web Progresiva (PWA de Escritorio y Móvil):',
      'En navegadores Google Chrome o Microsoft Edge, presione el botón "Instalar App" ubicado en la barra de navegación superior (o el ícono con forma de pantalla presente a la derecha de la barra de direcciones). Al aceptar, la plataforma se integra a su sistema operativo como una aplicación nativa con acceso directo en el Escritorio y Menú Inicio, funcionando a ventana completa sin elementos distractores de navegación web.',
      'En dispositivos Android con Chrome, acceda al menú de opciones del navegador (tres puntos) y elija "Instalar aplicación" o "Agregar a la pantalla principal". En dispositivos Apple iOS (Safari), pulse el botón Compartir y seleccione "Añadir a pantalla de inicio".',
      'Modalidad 2: Archivo Único Autocontenido (Asistente_Docente.html):',
      'Para educadores que no disponen de privilegios de instalación o que laboran en computadoras compartidas, se distribuye el archivo independiente Asistente_Docente.html (14 MB). Este archivo contiene todos los módulos, tipografías, íconos y librerías de cálculo embebidas de forma estricta. Basta con hacer doble clic sobre él para abrir el sistema al instante en cualquier equipo sin conexión a internet.',
    ],
    tips: [
      'El archivo Asistente_Docente.html puede transportarse cómodamente en cualquier memoria USB y ejecutarse de inmediato en cualquier aula o sala de maestros sin requerir permisos de administrador.',
    ],
  },
  {
    id: 'configuracion',
    chapterNum: '03',
    title: 'Identidad Institucional y Perfil del Docente',
    badge: 'Ajustes de Portada y Membrete',
    summary: 'Aprenda a personalizar el nombre del colegio, ciudad, logotipos, versículo oficial y el tratamiento formal de Profesora o Profesor.',
    content: [
      'Acceso a la configuración: Diríjase a la pestaña "Configuración" situada en la barra de navegación principal.',
      'Parámetros de la Institución Educativa:',
      '- Nombre Oficial: Indique el nombre legal del centro escolar, colegio o instituto.',
      '- Ciudad y País: Establezca la ubicación geográfica para el encabezado de actas e informes oficiales.',
      '- Subtítulo y Niveles: Detalle los niveles atendidos (ejemplo: Parvularia, Básica y Bachillerato).',
      '- Año Lectivo y Lema Institucional: Programe el periodo escolar vigente y el versículo o lema axiológico que aparecerá en diplomas, temarios y guiones.',
      'Logotipos Institucionales Reemplazables:',
      'Permite subir sus propios archivos de imagen (PNG o JPG) para reemplazar el logotipo institucional, el escudo patrio y los sellos de validación. La imagen se dimensiona y memoriza automáticamente en el almacenamiento local.',
      'Perfil Docente y Tratamiento de Género:',
      '- Tratamiento / Sexo: Seleccione entre "Profesora (Femenino)" o "Profesor (Masculino)". Esta preferencia ajusta de inmediato la portada principal ("PROFESORA" o "PROFESOR") y los cargos en diplomas ("Maestra Guía" o "Maestro Guía").',
      '- Nombre completo: Ingrese su nombre con los títulos académicos respectivos.',
      '- Fotografía del Educador: Capture su fotografía en tiempo real mediante la cámara web de su dispositivo o suba un retrato desde sus archivos locales.',
    ],
    tips: [
      'Haciendo clic sobre la fotografía o sobre su nombre en la portada principal se despliega una ventana de acceso rápido para actualizar su retrato o tratamiento en cualquier momento.',
    ],
    fictionalExample: {
      title: 'Ejemplo de Configuración Institucional Genérica:',
      description: 'Datos modelo aplicables a un centro educativo de referencia:',
      details: [
        'Institución: Colegio Modelo Bicentenario',
        'Ubicación: San Salvador, El Salvador · Año Lectivo 2026',
        'Niveles: Educación Inicial, Tercer Ciclo y Bachillerato General',
        'Docente de Ejemplo: Licda. Sofía Elena Carranza (Tratamiento: Profesora)',
        'Lema Institucional: "Instruye al niño en su camino, y aun cuando fuere viejo no se apartará de él" (Proverbios 22:6)',
      ],
    },
  },
  {
    id: 'modulo1_grados',
    chapterNum: '04',
    title: 'Módulo 1 — Mis Grados y Alumnos',
    badge: 'Administración de Nóminas',
    summary: 'Gestione aulas asignadas, nóminas oficiales, cálculo automático de edades, alertas de cumpleaños y enlace directo a WhatsApp.',
    content: [
      'Creación y Organización de Aulas: El docente puede dar de alta las diferentes secciones a su cargo (ejemplo: 7.° Grado Sección A, 8.° Grado Sección B). Cada aula almacena su nómina de alumnos, datos de acudientes y estadísticas particulares de forma independiente.',
      'Métodos para Incorporar Estudiantes a la Nómina:',
      '1. Importación rápida desde Excel o CSV: Mediante el botón "Importar Excel", cargue la lista oficial provista por la secretaría o el sistema ministerial SIGES. El sistema clasifica de forma automática apellidos, nombres, encargados y números telefónicos.',
      '2. Captura Óptica por Foto o Documento (Asistida por IA): Si dispone de una lista impresa en papel o fotografiada con su celular, presione "Foto / Documento (IA)". La inteligencia artificial extraerá los nombres completos y los registrará en la nómina sin requerir digitación manual.',
      '3. Registro Manual Individual: Presione "+ Nuevo Alumno" para crear fichas personalizadas una por una.',
      'Ficha Integral del Alumno y Cálculo Cronológico de Edades:',
      'Cada registro contiene: Nombre Completo, Fecha de Nacimiento, Nombre del Encargado, Celular y Dirección domiciliar. Al digitar la fecha de nacimiento, el sistema calcula de inmediato la edad exacta en años y meses, e integra al estudiante al monitor de alertas de cumpleaños.',
      'Comunicación Directa con la Familia por WhatsApp:',
      'Cada alumno con número de encargado cuenta con un botón directo de WhatsApp que genera un enlace seguro con mensaje de cortesía pre-redactado citando el nombre del alumno y de la institución.',
    ],
    tips: [
      'Los nombres registrados en Mis Grados alimentan de forma transparente a los módulos de Desempeño Escolar y Diplomas de Graduación, eliminando la duplicación de trabajo.',
    ],
    fictionalExample: {
      title: 'Ejemplo de Ficha Estudiantil Modelo:',
      description: 'Estructura de registro de un estudiante ficticio en el sistema:',
      details: [
        'Aula Asignada: 7.° Grado Sección "A" (Total: 28 alumnos)',
        'Alumno: Mateo Alejandro Rivera Henríquez (Fecha Nac: 12/05/2013 · Edad: 12 años y 6 meses)',
        'Encargada: Sra. Carmen Henríquez de Rivera · Teléfono: 7890-1234',
        'Estado: Ficha Completa · Alerta de Cumpleaños programada automáticamente para el 12 de mayo',
      ],
    },
  },
  {
    id: 'modulo2_desempeno',
    chapterNum: '05',
    title: 'Módulo 2 — Desempeño Escolar y Calificaciones',
    badge: 'Evaluación y Ponderaciones',
    summary: 'Registro sistemático de notas por asignatura, ponderación oficial 70/30, semáforo preventivo de rendimiento y boletas individuales.',
    content: [
      'Selección de Grado y Administración de Asignaturas: Seleccione el aula a evaluar. El sistema cargará los estudiantes de la nómina oficial. Puede añadir, editar o remover asignaturas curriculares (Matemática, Lenguaje, Ciencias, Estudios Sociales, Inglés, Educación Física, etc.).',
      'Ponderaciones Oficiales Normativas (MINEDUCYT El Salvador):',
      'La evaluación trimestral o por periodos procesa las calificaciones respetando la directriz oficial:',
      '- 70% Evaluaciones Formativas y Continuas: Actividades integradoras, laboratorios, cuadernos y tareas grupales.',
      '- 30% Evaluación Sumativa: Examen de periodo o prueba objetiva trimestral.',
      'Semáforo Preventivo de Rendimiento Académico:',
      'El motor de cálculo clasifica en tiempo real a cada estudiante en una escala visual de tres niveles:',
      '- Nivel Satisfactorio [Verde]: Promedio de 7.0 a 10.0 (o 70% a 100%). Demuestra dominio cabal de las competencias.',
      '- Alerta Preventiva [Amarillo]: Promedio de 6.0 a 6.9. Requiere refuerzo académico antes del cierre del periodo.',
      '- Riesgo Crítico [Rojo]: Promedio inferior a 6.0. Alerta inmediata para citación de padres y plan pedagógico remedial.',
      'Boletas Individuales de Calificaciones:',
      'Permite imprimir la boleta de calificaciones por estudiante con membrete institucional, firmas del docente y dirección, y cuadro de observaciones.',
    ],
    tips: [
      'Utilice los filtros del semáforo para visualizar en un solo clic a los alumnos en semáforo amarillo y rojo, facilitando el diseño de jornadas de refuerzo antes de los exámenes.',
    ],
    fictionalExample: {
      title: 'Ejemplo de Calificación Ponderada 70/30:',
      description: 'Cálculo del promedio trimestral en la asignatura de Matemática:',
      details: [
        'Alumno: Mateo Alejandro Rivera Henríquez',
        'Evaluación Continua (70%): Actividades y tareas = Nota 8.5 (Aporte: 5.95)',
        'Examen de Periodo (30%): Prueba trimestral = Nota 9.0 (Aporte: 2.70)',
        'Promedio Final de Periodo: 8.65 -> 8.7 (Clasificación: Nivel Satisfactorio - Verde)',
      ],
    },
  },
  {
    id: 'modulo3_jornalizacion',
    chapterNum: '06',
    title: 'Módulo 3 — Jornalización Docente',
    badge: 'Distribución Calendario',
    summary: 'Planificación anual y periódica de unidades, cálculo de horas efectivas de clase, feriados y semanas lectivas.',
    content: [
      'La Jornalización Docente permite secuenciar las unidades didácticas y competencias a lo largo del año lectivo, asegurando la cobertura del programa de estudios.',
      'Funcionalidades destacadas:',
      '- Cálculo exacto de horas de clase hábiles, deduciendo periodos vacacionales (Semana Santa, Fiestas Agostinas) y días de asueto oficial.',
      '- Distribución por periodos lectivos (Trimestres en Básica o Periodos en Educación Media).',
      '- Asignación anticipada de fechas para exámenes trimestrales y semanas de refuerzo.',
      '- Exportación formal en formato PDF e impresión lista para supervisión pedagógica.',
    ],
    fictionalExample: {
      title: 'Ejemplo de Jornalización Ficticia:',
      description: 'Distribución de Unidad Didáctica para 7.° Grado:',
      details: [
        'Asignatura: Ciencia y Tecnología · Docente: Prof. Gabriel Antonio Montes',
        'Unidad 1: "La materia y sus transformaciones" · Duración estimada: 6 semanas (24 horas clase)',
        'Inicio: 26 de enero de 2026 · Cierre: 06 de marzo de 2026 · Evaluación formativa en semana 4',
      ],
    },
  },
  {
    id: 'modulo4_planificacion',
    chapterNum: '07',
    title: 'Módulo 4 — Planificación y Guion de Clases',
    badge: 'Diseño Didáctico',
    summary: 'Construcción de planes de lección por competencias siguiendo el proceso didáctico estructurado en cinco momentos.',
    content: [
      'Elaboración ágil de guiones didácticos con enfoque constructivista e integración formativa de valores:',
      'Momentos del Proceso Didáctico:',
      '1. Fase Inicial: Activación de conocimientos previos, preguntas generadoras y conexión reflexiva.',
      '2. Exploración y Problematización: Planteamiento de situaciones problémicas del entorno cotidiano.',
      '3. Construcción del Conocimiento: Desarrollo de conceptos guiado con ejemplos claros y modelado.',
      '4. Práctica Guiada e Independiente: Trabajo colaborativo, resolución de guías y ejercicios prácticos.',
      '5. Evaluación y Metacognición: Cierre de la clase, preguntas de consolidación y verificación de aprendizajes.',
    ],
    fictionalExample: {
      title: 'Ejemplo de Guion Didáctico:',
      description: 'Plan de clase para 90 minutos de clase:',
      details: [
        'Tema: Ecuaciones lineales en situaciones cotidianas · 8.° Grado Sección "A"',
        'Indicador de Logro: Resuelve problemas modelando relaciones mediante ecuaciones de primer grado.',
        'Valores Integrados: Responsabilidad personal y perseverancia en la resolución de desafíos.',
      ],
    },
  },
  {
    id: 'modulo5_guias',
    chapterNum: '08',
    title: 'Módulo 5 — Guías de Aprendizaje por Clase',
    badge: 'Material del Alumno',
    summary: 'Diseño de guías didácticas para sesiones de 45 o 90 minutos, con ejercicios resueltos y rúbricas de evaluación.',
    content: [
      'Estructuración de material impreso o digital para entrega directa a los estudiantes:',
      '- Pestañas diferenciadas para periodos de 45 minutos (bloque sencillo) o 90 minutos (bloque doble).',
      '- Sección de conceptos clave y ejercicios resueltos para estudio autónomo en el aula o en casa.',
      '- Indicaciones claras de entrega y criterios transparentes de valoración mediante rúbrica.',
    ],
  },
  {
    id: 'modulo6_temarios',
    chapterNum: '09',
    title: 'Módulo 6 — Temarios de Examen',
    badge: 'Orientación a la Familia',
    summary: 'Notificación anticipada de contenidos evaluables, ponderaciones y recomendaciones de estudio para los hogares.',
    content: [
      'Documento formal que se remite a padres y alumnos previo a las semanas de exámenes:',
      '- Dosificación de contenidos teóricos, temas prácticos y páginas específicas del texto guía.',
      '- Fecha, hora y ponderación porcentual asignada a la prueba.',
      '- Lista de útiles requeridos para el examen (calculadora, juego de geometría, lápiz, etc.).',
      '- Recomendaciones pedagógicas dirigidas a los padres para acompañar el horario de estudio en casa.',
    ],
  },
  {
    id: 'modulo7_examenes',
    chapterNum: '10',
    title: 'Módulo 7 — Exámenes y Claves de Respuestas',
    badge: 'Instrumentos Evaluativos',
    summary: 'Generador de pruebas con banco de reactivos, escalas configurables y hoja de claves de respuestas separada.',
    content: [
      'Elaboración de exámenes objetivos con rigor técnico y presentación profesional:',
      '- Variedad de reactivos: Opción múltiple, correspondencia/pareamiento, respuesta breve, falso/verdadero y problemas prácticos.',
      '- Escala de calificación configurable: Escala de 0 a 10 o escala porcentual de 0 a 100%.',
      '- Clave de Respuestas en Hoja Separada: El sistema genera una segunda página con las soluciones correctas y criterios de puntuación para el docente.',
      '- Inclusión del versículo lema y membrete institucional en el encabezado oficial.',
    ],
  },
  {
    id: 'modulo8_bitacora',
    chapterNum: '11',
    title: 'Módulo 8 — Bitácora de Incidentes',
    badge: 'Convivencia y Legalidad',
    summary: 'Registro objetivo de situaciones de convivencia escolar, apego estricto a la Ley Crecer Juntos y acuerdos formativos.',
    content: [
      'Marco Legal y Protección Integral:',
      'El registro disciplinario se realiza con objetividad documental, sin adjetivos peyorativos ni estigmatizaciones, garantizando el respeto irrestricto a los derechos de la niñez y adolescencia.',
      'Elementos del Registro de Incidencia:',
      '- Fecha, hora y lugar del hecho reportado.',
      '- Tipificación conforme al Reglamento Interno (Falta Leve, Grave o Muy Grave).',
      '- Relato objetivo de los hechos comprobados y versión o descargo del estudiante.',
      '- Medidas formativas pedagógicas y acciones restaurativas acordadas.',
      '- Firma de compromisos de padre/madre, estudiante y docente tutor.',
      '- Registro de derivación si el caso amerita intervención de Orientación Escolar o Psicología.',
    ],
    fictionalExample: {
      title: 'Ejemplo de Registro en Bitácora:',
      description: 'Resolución restaurativa de un desacuerdo entre pares:',
      details: [
        'Alumno involucrado: Lucas Gabriel Benítez Orellana (8.° Grado Sección "B")',
        'Descripción: Desacuerdo verbal durante el receso escolar sobre turno de juego.',
        'Acción Formativa: Mediación dialogada, disculpa recíproca y acuerdo de convivencia.',
        'Compromiso: Seguimiento conductual positivo durante dos semanas con apoyo del docente guía.',
      ],
    },
  },
  {
    id: 'modulo9_actas',
    chapterNum: '12',
    title: 'Módulo 9 — Actas Institucionales',
    badge: 'Documentación Oficial',
    summary: 'Siete formatos tipificados de actas para reuniones con padres de familia, compromisos académicos y acuerdos de consejo.',
    content: [
      'Formatos jurídicos y administrativos listos para redactar, guardar e imprimir:',
      '1. Acta de Reunión Ordinaria de Padres de Familia.',
      '2. Acta de Compromiso Académico por Bajo Rendimiento.',
      '3. Acta de Compromiso Conductual y Convivencia Escolar.',
      '4. Acta de Citación Individual a Padre / Madre o Encargado.',
      '5. Acta de Consejo de Profesores y Evaluación de Periodo.',
      '6. Acta de Entrega Oficial de Calificaciones.',
      '7. Acta de Justificación de Inasistencias Médicas Prolongadas.',
      'Cada formato incluye fecha redactada en letras, cuerpo expositivo, acuerdos numerados y casillas formales para las firmas correspondientes.',
    ],
  },
  {
    id: 'modulo10_diplomas',
    chapterNum: '13',
    title: 'Módulo 10 — Diplomas de Graduación y Honor',
    badge: 'Certificación de Mérito',
    summary: 'Diplomas en formato Oficio (8.5×13"), orla clásica dorada y azul, sellos heráldicos y descarga masiva en ZIP.',
    content: [
      'Estándar estético de distinción para actos de graduación y premiación académica:',
      '- Proporción exacta en Papel Oficio (8.5 × 13 pulgadas / 215.9 × 330.2 mm).',
      '- Marco heráldico en colores corporativos azul marino (#003366) y oro real (#C89B3C).',
      '- Escudo nacional y sello institucional conmemorativo grabado con las siglas del centro educativo.',
      '- Cuadro reservado para fotografía formal del graduando (opcional).',
      '- Importación directa de la lista de alumnos desde el Módulo 1 con casillas de selección múltiple.',
      '- Normalización ortográfica automática de tildes y mayúsculas en los nombres.',
      '- Generación en PDF individual o descarga en paquete comprimido (ZIP) con un archivo por cada estudiante.',
    ],
    fictionalExample: {
      title: 'Ejemplo de Diploma Generado:',
      description: 'Certificación ficticia de culminación de ciclo educativo:',
      details: [
        'Graduando: Mateo Alejandro Rivera Henríquez',
        'Mérito: Culminación satisfactoria del Tercer Ciclo de Educación Básica',
        'Otorgado por: Colegio Modelo Bicentenario · San Salvador, El Salvador',
        'Fecha en Letras: A los veinticinco días del mes de noviembre del año dos mil veintiséis',
      ],
    },
  },
  {
    id: 'respaldos_seguridad',
    chapterNum: '14',
    title: 'Respaldos de Seguridad, Exportación e Importación',
    badge: 'Protección y Portabilidad',
    summary: 'Mecanismos para resguardar su información en copias JSON cifradas, exportar a Excel y migrar entre computadoras.',
    content: [
      'Menú de Respaldo en la Barra Superior:',
      '1. Descargar Respaldo JSON: Descarga un archivo integral con todas las aulas, nóminas, notas, historial de documentos, plantillas y fotografías. Consérvelo en su computadora o correo electrónico.',
      '2. Restaurar Respaldo JSON: Permite cargar un archivo de respaldo previo para restablecer su entorno de trabajo en caso de cambio de equipo o mantenimiento del sistema.',
      '3. Exportar Nómina a Excel / CSV: Genera una hoja de cálculo con la lista de alumnos y promedios para reportes ante la secretaría escolar.',
      '4. Limpieza o Reinicio de Datos: Función controlada para limpiar datos de demostración e iniciar un nuevo año lectivo desde cero.',
    ],
    tips: [
      'Se recomienda realizar una descarga de Respaldo JSON al cierre de cada periodo trimestral para conservar un histórico permanente e inalterable.',
    ],
  },
  {
    id: 'asistencia_ia',
    chapterNum: '15',
    title: 'Asistencia Inteligente con Gemini API',
    badge: 'Productividad Inteligente',
    summary: 'Configuración opcional de clave de inteligencia artificial para extracción óptica de nóminas y auxilio pedagógico.',
    content: [
      'Configuración Segura de la Clave API:',
      'Presione el botón "Clave IA" en el encabezado superior. Digite su clave personal de Google Gemini (obtenida sin costo en Google AI Studio). La clave se almacena cifrada únicamente en su dispositivo y nunca se envía a servidores externos.',
      'Capacidades disponibles con IA:',
      '- Reconocimiento óptico de listas: Extrae automáticamente nombres y apellidos desde fotos de listas en papel.',
      '- Sugerencias pedagógicas para la redacción de momentos didácticos en planificaciones y fundamentación en actas disciplinarias.',
    ],
  },
  {
    id: 'licenciamiento_temporal',
    chapterNum: '16',
    title: 'Sistema de Licenciamiento y Periodos de Vigencia',
    badge: 'Control Administrativo',
    summary: 'Modalidades de uso: Periodo de prueba de 7 días, licencias periódicas programables y Licencia Vitalicia Permanente.',
    content: [
      'Asistente Docente cuenta con un motor de licencias gestionado por el Administrador Institucional a través de un panel restringido protegido por PIN maestro:',
      'Modalidades de Licenciamiento Disponibles:',
      '- Periodo de Prueba (7 Días): Permite a centros educativos y docentes evaluar todas las funciones avanzadas durante una semana completa antes de adquirir la licencia formal.',
      '- Licencias Periódicas (Meses o Años): Temporizador programable por el administrador (ejemplo: 30 días, 3 meses, 6 meses, 1 año o 2 años). La aplicación informa al docente sobre el tiempo restante de vigencia.',
      '- Licencia Vitalicia Permanente: Modalidad de acceso definitivo sin fecha de expiración ni temporizadores de bloqueo. Ideal para adquisiciones institucionales permanentes.',
      'Pantalla de Bloqueo por Vencimiento:',
      'Al llegar la fecha límite configurada, la aplicación se bloquea de forma segura mediante una pantalla completa que protege los datos estudiantiles. Para reactivarla, se introduce el código de licencia provisto por el administrador (código predeterminado: 1978), permitiendo asignar una nueva vigencia o transformarla en vitalicia.',
    ],
    tips: [
      'Para abrir el panel oculto de administración de licencias, presione el atajo de teclado Ctrl + Shift + L, o haga 5 clics consecutivos sobre el texto "RENOVA NEXUS" en la barra superior o pie de página.',
    ],
  },
  {
    id: 'contacto_corporativo',
    chapterNum: '17',
    title: 'Contacto Ejecutivo y Soporte Institucional',
    badge: 'Dirección Corporativa',
    summary: 'Información directa de adquisición de licencias, renovaciones, capacitaciones docentes y soporte técnico oficial.',
    content: [
      'Corporación Médica Integral RENOVA y su división tecnológica RENOVA NEXUS ponen a disposición de los centros educativos, directores y docentes los canales directos de atención institucional:',
      'Dirección Ejecutiva Corporativa:',
      '- Titular: Dr. Oscar Alexander Guevara',
      '- Cargo: CEO — Corporación Médica Integral',
      '- División Tecnológica: RENOVA NEXUS',
      '- Teléfono Directo y WhatsApp: 71405449 (+503 7140-5449)',
      '- Sede Operativa: San Miguel, El Salvador · Centroamérica',
      'Servicios Disponibles:',
      '- Adquisición de Licencias Institucionales: Periodos de prueba de 7 días, planes anuales y Licencias Vitalicias.',
      '- Asesoría Técnica y Capacitación Pedagógica: Talleres de implementación para colegios, centros escolares e institutos nacionales.',
      '- Soporte de Migración y Respaldo de Datos: Orientación personalizada para migración de nóminas y cuadros de notas.',
    ],
  },
];

/**
 * Strips emoji characters and unsupported unicode that may cause UTF-8/encoding errors in standard PDF fonts.
 */
function sanitizePdfText(text: string): string {
  return text
    .replace(/⋮/g, ':')
    .replace(/[—–]/g, '-')
    .replace(/[“”""]/g, '"')
    .replace(/[‘’'']/g, "'")
    .replace(/…/g, '...')
    .replace(/•/g, '-')
    .replace(/🟢/g, '[Verde]')
    .replace(/🟡/g, '[Amarillo]')
    .replace(/🔴/g, '[Rojo]')
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/[^\x00-\xFF]/gu, '')
    .trim();
}

/**
 * Generates an executive, aesthetically pleasing, multi-page vector PDF user manual.
 */
export function generateUserManualPdf(config?: SchoolConfig): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = 215.9;
  const pageHeight = 279.4;
  const marginX = 20;
  const contentWidth = pageWidth - marginX * 2;
  let cursorY = 25;

  const primaryBlue: [number, number, number] = [0, 51, 102]; // #003366
  const darkNavy: [number, number, number] = [0, 31, 63]; // #001f3f
  const goldAccent: [number, number, number] = [218, 165, 32]; // Goldenrod
  const goldLight: [number, number, number] = [255, 248, 225];
  const textDark: [number, number, number] = [30, 41, 59]; // slate-800
  const textMuted: [number, number, number] = [71, 85, 105]; // slate-600
  const borderLight: [number, number, number] = [226, 232, 240];

  function addHeaderAndFooter(pageNum: number) {
    // Top banner bar
    doc.setFillColor(...primaryBlue);
    doc.rect(0, 0, pageWidth, 7, 'F');
    doc.setFillColor(...goldAccent);
    doc.rect(0, 7, pageWidth, 1.2, 'F');

    // Header text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('ASISTENTE DOCENTE · MANUAL OFICIAL DE USO Y REFERENCIA', marginX, 14);
    doc.setFont('helvetica', 'normal');
    doc.text('CORPORACIÓN MÉDICA INTEGRAL RENOVA · RENOVA NEXUS', pageWidth - marginX, 14, {
      align: 'right',
    });

    // Divider under header
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.3);
    doc.line(marginX, 16, pageWidth - marginX, 16);

    // Footer bottom bar
    doc.setFillColor(...darkNavy);
    doc.rect(0, pageHeight - 11, pageWidth, 11, 'F');
    doc.setFillColor(...goldAccent);
    doc.rect(0, pageHeight - 12, pageWidth, 1, 'F');

    // Footer text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(241, 245, 249);
    doc.text(
      '© 2026 Corporación Médica Integral RENOVA · Dr. Oscar Alexander Guevara · Tel. 71405449',
      marginX,
      pageHeight - 4.5
    );
    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${pageNum}`, pageWidth - marginX, pageHeight - 4.5, { align: 'right' });
  }

  function checkPageBreak(neededSpaceMm: number) {
    if (cursorY + neededSpaceMm > pageHeight - 18) {
      doc.addPage();
      const currentPages = doc.getNumberOfPages();
      addHeaderAndFooter(currentPages);
      cursorY = 24;
    }
  }

  // ==========================================
  // PÁGINA 1: PORTADA OFICIAL Y PRESENTACIÓN
  // ==========================================
  addHeaderAndFooter(1);

  // Big Banner Box
  doc.setFillColor(...primaryBlue);
  doc.roundedRect(marginX, 25, contentWidth, 68, 3, 3, 'F');

  // Golden accent bar inside banner
  doc.setFillColor(...goldAccent);
  doc.roundedRect(marginX + 8, 34, 46, 6.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...darkNavy);
  doc.text('EDICIÓN OFICIAL 2026', marginX + 31, 38.3, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(23);
  doc.setTextColor(255, 255, 255);
  doc.text('ASISTENTE DOCENTE', marginX + 8, 52);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(224, 242, 254);
  doc.text(
    'Manual Integral de Operación Pedagógica, Administrativa y Normativa',
    marginX + 8,
    61
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...goldAccent);
  doc.text(
    'CORPORACIÓN MÉDICA INTEGRAL RENOVA · RENOVA NEXUS',
    marginX + 8,
    72
  );

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.8);
  doc.setTextColor(203, 213, 225);
  doc.text(
    'Plataforma Local-First Autónoma · 100% Offline · Compatible con PWA y Archivo HTML Único',
    marginX + 8,
    81
  );

  cursorY = 102;

  // Institutional Presentation Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, cursorY, contentWidth, 42, 2, 2, 'FD');

  // Left stripe
  doc.setFillColor(...primaryBlue);
  doc.roundedRect(marginX, cursorY, 3.5, 42, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...primaryBlue);
  doc.text('PRESENTACIÓN INSTITUCIONAL', marginX + 8, cursorY + 7.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...textDark);
  const introPara1 =
    'Este documento constituye el Manual Oficial y Guía de Referencia Operativa de Asistente Docente, software diseñado para optimizar de forma integral la gestión académica, normativa y administrativa de los educadores en los niveles de Educación Parvularia, Básica y Bachillerato.';
  const introPara2 =
    'El sistema ha sido concebido bajo los más rigurosos principios de privacidad de datos (Ley Crecer Juntos), garantizando que toda la información estudiantil permanezca exclusivamente en el dispositivo del docente sin intermediarios ni almacenamiento foráneo.';

  const linesP1 = doc.splitTextToSize(introPara1, contentWidth - 14);
  doc.text(linesP1, marginX + 8, cursorY + 14);

  const linesP2 = doc.splitTextToSize(introPara2, contentWidth - 14);
  doc.text(linesP2, marginX + 8, cursorY + 26);

  cursorY += 50;

  // Key Pillars Grid (2x2)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryBlue);
  doc.text('PILARES ESTRUCTURALES DEL SISTEMA', marginX, cursorY);
  cursorY += 4.5;

  doc.setDrawColor(...goldAccent);
  doc.setLineWidth(0.8);
  doc.line(marginX, cursorY, marginX + 60, cursorY);
  cursorY += 6;

  const pillars = [
    {
      title: 'Soberanía de Datos (Local-First)',
      desc: 'Almacenamiento exclusivo en la memoria local del navegador (IndexedDB). Sin riesgo de filtraciones en la nube.',
    },
    {
      title: 'Cumplimiento Legal (Ley Crecer Juntos)',
      desc: 'Bitácoras objetivas no estigmatizantes y reserva absoluta en expedientes confidenciales de menores.',
    },
    {
      title: 'Autonomía Total (100% Desconectado)',
      desc: 'Operación completa sin necesidad de internet en el aula, laboratorio o áreas con conectividad limitada.',
    },
    {
      title: 'Flexibilidad de Licenciamiento',
      desc: 'Periodos de prueba de 7 días, licencias anuales programables y Licencia Vitalicia Permanente sin vencimiento.',
    },
  ];

  const colWidth = (contentWidth - 6) / 2;
  pillars.forEach((pil, idx) => {
    const isCol2 = idx % 2 === 1;
    const colX = isCol2 ? marginX + colWidth + 6 : marginX;
    const cardY = cursorY + Math.floor(idx / 2) * 22;

    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(colX, cardY, colWidth, 19, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(...primaryBlue);
    doc.text(pil.title, colX + 4, cardY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(...textMuted);
    const descLines = doc.splitTextToSize(pil.desc, colWidth - 8);
    doc.text(descLines, colX + 4, cardY + 10.5);
  });

  cursorY += 50;

  // Cover Page Bottom Contact Seal
  doc.setFillColor(...darkNavy);
  doc.roundedRect(marginX, cursorY, contentWidth, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(255, 255, 255);
  doc.text('DIRECCIÓN CORPORATIVA RENOVA NEXUS:', marginX + 6, cursorY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text('Dr. Oscar Alexander Guevara · CEO Corporación Médica Integral', marginX + 6, cursorY + 10.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...goldAccent);
  doc.text('Teléfono / WhatsApp: 71405449', pageWidth - marginX - 6, cursorY + 8.5, { align: 'right' });

  // ==========================================
  // PÁGINA 2: ÍNDICE GENERAL DE MATERIAS (ESPACIOSO)
  // ==========================================
  doc.addPage();
  addHeaderAndFooter(2);
  cursorY = 24;

  // Title Box
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(...primaryBlue);
  doc.setLineWidth(0.5);
  doc.roundedRect(marginX, cursorY, contentWidth, 16, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...primaryBlue);
  doc.text('ÍNDICE GENERAL DE MATERIAS', marginX + 8, cursorY + 7.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(...textMuted);
  doc.text('Estructura temática y guía de referencia de los 17 capítulos y módulos del sistema', marginX + 8, cursorY + 12.5);

  cursorY += 22;

  // Clean, spacious list of all 17 chapters
  MANUAL_SECTIONS.forEach((sec, idx) => {
    // Row background on hover/alternating
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(marginX, cursorY - 3.5, contentWidth, 10.5, 1, 1, 'F');
    }

    // Chapter badge / number pill
    doc.setFillColor(...primaryBlue);
    doc.roundedRect(marginX + 2, cursorY - 2.5, 9, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(sec.chapterNum, marginX + 6.5, cursorY + 1.6, { align: 'center' });

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...primaryBlue);
    const cleanTitle = sanitizePdfText(sec.title);
    doc.text(cleanTitle, marginX + 14, cursorY + 1.6);

    // Badge on the right
    if (sec.badge) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(180, 83, 9);
      doc.text(sanitizePdfText(sec.badge), pageWidth - marginX - 4, cursorY + 1.6, { align: 'right' });
    }

    // Dotted leader line
    const titleWidth = doc.getTextWidth(cleanTitle);
    const startDotsX = marginX + 16 + titleWidth;
    const endDotsX = pageWidth - marginX - 42;
    if (endDotsX > startDotsX) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(203, 213, 225);
      const dotsCount = Math.floor((endDotsX - startDotsX) / 2.5);
      const dotsStr = '. '.repeat(Math.max(1, dotsCount));
      doc.text(dotsStr, startDotsX, cursorY + 1.6);
    }

    cursorY += 11.2;
  });

  // Note at the bottom of Table of Contents
  cursorY += 2;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text(
    '* Cada módulo incluye generalidades operativas, ejemplos prácticos ficticios y recomendaciones normativas.',
    marginX + 2,
    cursorY
  );

  // ==========================================
  // PÁGINA 3+: CAPÍTULOS Y MÓDULOS DETALLADOS
  // ==========================================
  doc.addPage();
  addHeaderAndFooter(doc.getNumberOfPages());
  cursorY = 24;

  MANUAL_SECTIONS.forEach((section) => {
    checkPageBreak(42);

    // Chapter Header Card
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.roundedRect(marginX, cursorY, contentWidth, 14, 2, 2, 'FD');

    // Left vertical accent stripe
    doc.setFillColor(...primaryBlue);
    doc.roundedRect(marginX, cursorY, 3.5, 14, 1, 1, 'F');

    // Chapter badge pill
    if (section.badge) {
      const badgeText = sanitizePdfText(section.badge.toUpperCase());
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(180, 83, 9);
      doc.text(badgeText, marginX + 7, cursorY + 4.5);
    }

    // Chapter Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...primaryBlue);
    doc.text(`${section.chapterNum}. ${sanitizePdfText(section.title)}`, marginX + 7, cursorY + 10.2);
    cursorY += 18;

    // Summary Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    const cleanSummary = sanitizePdfText(section.summary);
    const summaryLines = doc.splitTextToSize(cleanSummary, contentWidth - 10);
    const summaryBoxHeight = summaryLines.length * 4.4 + 4;
    doc.roundedRect(marginX, cursorY, contentWidth, summaryBoxHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.2);
    doc.setTextColor(...textMuted);
    doc.text(summaryLines, marginX + 5, cursorY + 4.8);
    cursorY += summaryBoxHeight + 5;

    // Content Paragraphs (CRISP LEFT-ALIGNED TEXT — NO BROKEN JUSTIFY)
    section.content.forEach((paragraph) => {
      const cleanPara = sanitizePdfText(paragraph);
      const isBullet = cleanPara.startsWith('-') || cleanPara.startsWith('•');
      const isNumbered = /^[0-9]+\./.test(cleanPara);

      if (isBullet || isNumbered) {
        const indent = 6.5;
        const bulletText = isBullet ? cleanPara.replace(/^[-•]\s*/, '') : cleanPara;
        const textLines = doc.splitTextToSize(bulletText, contentWidth - indent - 4);
        checkPageBreak(textLines.length * 4.6 + 2);

        if (isBullet) {
          doc.setFillColor(...goldAccent);
          doc.circle(marginX + 2.8, cursorY + 1.8, 0.85, 'F');
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.4);
        doc.setTextColor(...textDark);
        doc.text(textLines, marginX + indent, cursorY + 2.6);
        cursorY += textLines.length * 4.6 + 2.5;
      } else {
        // Standard body paragraph: Clean Left-Aligned with exact split text
        const textLines = doc.splitTextToSize(cleanPara, contentWidth - 4);
        checkPageBreak(textLines.length * 4.6 + 2.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.4);
        doc.setTextColor(...textDark);
        doc.text(textLines, marginX + 2, cursorY + 2.6);
        cursorY += textLines.length * 4.6 + 3.2;
      }
    });

    // Fictional Practical Example Box
    if (section.fictionalExample) {
      checkPageBreak(32);
      const ex = section.fictionalExample;
      const exTitle = sanitizePdfText(ex.title);
      const exDesc = sanitizePdfText(ex.description);
      const exDetails = ex.details.map((d) => sanitizePdfText(d));

      let totalDetailLines = 0;
      const detailLinesArray: string[][] = [];
      exDetails.forEach((d) => {
        const lines = doc.splitTextToSize(`- ${d}`, contentWidth - 14);
        detailLinesArray.push(lines);
        totalDetailLines += lines.length;
      });

      const boxHeight = 12 + totalDetailLines * 4.5;
      doc.setFillColor(240, 249, 255); // Sky-50
      doc.setDrawColor(186, 230, 253); // Sky-200
      doc.setLineWidth(0.3);
      doc.roundedRect(marginX + 1, cursorY, contentWidth - 2, boxHeight, 2, 2, 'FD');

      // Top title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(3, 105, 161); // Sky-700
      doc.text(exTitle, marginX + 6, cursorY + 5.5);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.6);
      doc.setTextColor(14, 116, 144);
      doc.text(exDesc, marginX + 6, cursorY + 9.8);

      let curDetailY = cursorY + 14.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(12, 74, 96);

      detailLinesArray.forEach((lines) => {
        doc.text(lines, marginX + 7, curDetailY);
        curDetailY += lines.length * 4.5;
      });

      cursorY += boxHeight + 5;
    }

    // Tips or Recommendations Box (Dynamically sized to prevent overflow)
    if (section.tips && section.tips.length > 0) {
      const tipLinesArray: string[][] = [];
      let totalTipLines = 0;

      section.tips.forEach((tip) => {
        const cleanTip = sanitizePdfText(`* ${tip}`);
        const lines = doc.splitTextToSize(cleanTip, contentWidth - 14);
        tipLinesArray.push(lines);
        totalTipLines += lines.length;
      });

      const boxHeight = 11 + totalTipLines * 4.5;
      checkPageBreak(boxHeight + 6);

      doc.setFillColor(254, 252, 232); // Amber-50
      doc.setDrawColor(254, 240, 138); // Amber-200
      doc.setLineWidth(0.3);
      doc.roundedRect(marginX + 1, cursorY, contentWidth - 2, boxHeight, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.6);
      doc.setTextColor(180, 83, 9); // Amber-700
      doc.text('CONSEJO PRÁCTICO / RECOMENDACIÓN:', marginX + 6, cursorY + 5.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(113, 63, 18); // Amber-900

      let tipY = cursorY + 10.2;
      tipLinesArray.forEach((lines) => {
        doc.text(lines, marginX + 6, tipY);
        tipY += lines.length * 4.5;
      });

      cursorY += boxHeight + 6;
    }

    cursorY += 5;
  });

  // ==========================================
  // BLOQUE FINAL DE CIERRE Y CONTACTO EJECUTIVO
  // ==========================================
  checkPageBreak(52);
  doc.setFillColor(...darkNavy);
  doc.roundedRect(marginX, cursorY, contentWidth, 44, 3, 3, 'F');

  doc.setFillColor(...goldAccent);
  doc.roundedRect(marginX + 8, cursorY + 6, contentWidth - 16, 1, 0.5, 0.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('CORPORACIÓN MÉDICA INTEGRAL RENOVA', marginX + contentWidth / 2, cursorY + 13, {
    align: 'center',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...goldAccent);
  doc.text('DIVISIÓN TECNOLÓGICA · RENOVA NEXUS', marginX + contentWidth / 2, cursorY + 19, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(224, 242, 254);
  doc.text('Dr. Oscar Alexander Guevara · CEO Corporación Médica Integral', marginX + contentWidth / 2, cursorY + 27, {
    align: 'center',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Contacto Directo y WhatsApp: Tel. 71405449', marginX + contentWidth / 2, cursorY + 34, {
    align: 'center',
  });

  return doc;
}
