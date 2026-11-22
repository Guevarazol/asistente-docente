# CASM Docente — PWA (RENOVA NEXUS)

Aplicación Web Progresiva (PWA) móvil-primero y compatible con computadora, diseñada para los docentes del **Colegio Adventista San Miguel (CASM)**, San Miguel, El Salvador (Kinder 4 hasta Bachillerato).

## Características Principales

- **8 Módulos Docentes Completos**:
  1. **Bitácora de Incidentes**: Marco legal **Ley Crecer Juntos** (vigente desde el 1 de enero de 2023; nunca cita LEPINA), base de conocimiento local (Ley, Reglamento Interno, Manual de Convivencia), confidencialidad por iniciales y lista de verificación obligatoria antes de exportar.
  2. **Planificación (Guion de clases)**: Formato horizontal tamaño carta de la Asociación Oriental Salvadoreña (Departamento de Educación), incluyendo IFEA y detalle por clase.
  3. **Exámenes**: Encabezado institucional en tabla, versículo editable, escala global uniforme (puntos escala 10 o porcentaje %), modo visual para Kinder y Primer Ciclo, y **Clave de Respuestas** automática en hoja aparte.
  4. **Jornalización Docente**: Distribución semanal por periodo integrada al calendario escolar configurable (feriados, evaluaciones y vacaciones) y compatible con planificaciones guardadas.
  5. **Actas**: 7 tipos de actas escolares formales con agenda, desarrollo, acuerdos numerados con responsables/plazos y bloque de firmas.
  6. **Guías por Clase**: Dos pestañas independientes (**Tercer Ciclo** y **Bachillerato**), selector de duración (45 o 90 minutos) y rúbricas de evaluación.
  7. **Temarios de Examen**: Generables directamente desde la Planificación o la Jornalización guardada para mantener coherencia curricular.
  8. **Diplomas de Graduación**: Tamaño **Oficio 8.5 × 13 pulgadas** vertical (300 ppp), marco azul marino y dorado, fecha automática en letras, tabla previa de revisión de tildes con confirmación obligatoria, y exportación en lote (todos en un PDF o individuales en ZIP).
- **Entrada Multimodal**: Lectura directa de PDF e imágenes/fotos por Gemini, cámara móvil múltiple (`capture="environment"`), lectura de Word (`.docx` con `mammoth`), Excel/CSV (`.xlsx`/`.csv` con `read-excel-file`), TXT y dictado por voz (Web Speech API).
- **Exportación Unificada**: Descargar PDF, Descargar Word (`.docx`), Imprimir (`@media print` WYSIWYG), Enviar por WhatsApp (`navigator.share` nativo con archivo PDF en celular o descarga + enlace `wa.me`), Guardar en historial local y Duplicar.
- **Privacidad Local**: Todos los documentos, historial, plantillas, base de conocimiento y PIN de acceso (4–6 dígitos con hash SHA-256) se almacenan exclusivamente en **IndexedDB** del dispositivo. No se guardan datos de estudiantes en servidores externos.

---

## Estructura del Proyecto

```text
/
├── public/
│   ├── assets/
│   │   ├── renova-logo.png         # Logo RENOVA (encabezado de la app)
│   │   ├── casm-logo.png           # Logo Colegio Adventista San Miguel (documentos)
│   │   └── escudo-elsalvador.png   # Escudo Nacional de El Salvador (diplomas)
│   ├── pwa-192x192.png             # Icono PWA 192x192
│   ├── pwa-512x512.png             # Icono PWA 512x512
│   ├── pwa-maskable-512x512.png    # Icono adaptativo Android (safe zone)
│   ├── apple-touch-icon.png        # Icono iOS Safari 180x180
│   └── icon.svg                    # Favicon vectorial
├── server.ts                       # Servidor Express + proxy seguro a Gemini API (@google/genai)
├── src/
│   ├── prompts/
│   │   ├── commonRules.ts          # Reglas globales de la IA ([COMPLETAR], [VERIFICAR], cero invenciones)
│   │   └── modulePrompts.ts        # Prompts separados de los 8 módulos, plantillas y nombres de graduandos
│   ├── db/
│   │   └── indexedDb.ts            # Motor IndexedDB (configuración, historial, plantillas, normativa, PIN)
│   ├── utils/
│   │   ├── exportEngine.ts         # Motor común de PDF (Carta/Oficio), Word (.docx), Print, WhatsApp y ZIP
│   │   ├── fileReader.ts           # Lectura multimodal (PDF/Fotos) + Mammoth (DOCX) + SheetJS (XLSX/CSV)
│   │   └── spanishDateToWords.ts   # Conversor de fechas a letras en español e iniciales de confidencialidad
│   ├── services/
│   │   └── aiService.ts            # Cliente hacia el endpoint /api/ai/generate
│   ├── components/                 # Encabezado RENOVA, PIN, entrada de contenido, barra de acciones, historial, ajustes
│   └── modules/                    # Los 8 módulos funcionales independientes
```

---

## Cómo Reemplazar Logos, Plantillas y Prompts

### 1. Reemplazar los Logos
Puedes reemplazarlos de dos formas:
- **Desde la app (sin tocar código)**: Abre **Configuración → 2. Logos Reemplazables** y sube el nuevo archivo PNG/JPG (se guarda en IndexedDB).
- **A nivel de archivos del proyecto**: Sustituye directamente los archivos manteniendo el mismo nombre en `public/assets/`:
  - `public/assets/renova-logo.png` (Logo RENOVA para la interfaz de la app)
  - `public/assets/casm-logo.png` (Logo del Colegio Adventista San Miguel para documentos impresos)
  - `public/assets/escudo-elsalvador.png` (Escudo Nacional para Diplomas de Graduación)

### 2. Agregar o Cambiar Plantillas Modelo
- Dentro de cualquier módulo (o en la pestaña **Plantillas**), pulsa **"Subir formato modelo (DOCX/PDF/Foto)"**.
- Gemini extraerá automáticamente las secciones, tablas, campos y orientación del documento original y lo guardará como plantilla reutilizable en IndexedDB.
- Al seleccionar esa plantilla antes de generar, la IA respetará exactamente su orden y estructura.

### 3. Ajustar los Prompts de la IA
Todos los prompts están centralizados y separados de la interfaz en:
- `src/prompts/commonRules.ts`: Reglas transversales (no inventar datos, marcar `[COMPLETAR]` y `[VERIFICAR]`, contexto del colegio).
- `src/prompts/modulePrompts.ts`: Un constructor de prompt por módulo (`buildIncidentLogPrompt`, `buildLessonPlanPrompt`, `buildExamPrompt`, `buildPacingGuidePrompt`, `buildMinutesPrompt`, `buildClassGuidePrompt`, `buildSyllabusPrompt`, `buildGraduateNamesExtractionPrompt`).

Modifica el texto de cualquier función en `src/prompts/` para afinar el estilo pedagógico o la redacción sin alterar los componentes de la interfaz.
