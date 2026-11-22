import type { ExtractedTemplate, SchoolConfig } from '../types/casm';

export const GLOBAL_AI_RULES = `
REGLAS OBLIGATORIAS PARA LA IA (COLEGIO ADVENTISTA SAN MIGUEL - EL SALVADOR):
1. Idioma: Redacta SIEMPRE en español formal y claro, adecuado al contexto educativo de El Salvador.
2. Cero invenciones: NUNCA inventes datos, fechas, nombres de personas, hechos, calificaciones ni números de artículos de ley o reglamento.
3. Datos faltantes: Cuando falte cualquier dato concreto que el docente no haya proporcionado, coloca exactamente la marca [COMPLETAR] en ese campo.
4. Normativa y leyes: Si se requiere citar un artículo de ley, reglamento o manual, cita ÚNICAMENTE el texto que el usuario haya adjuntado o subido a la base de conocimiento. Si no cuentas con la fuente exacta proporcionada por el usuario, agrega la marca [VERIFICAR] junto a la referencia.
5. Fidelidad de estructura: Devuelve estrictamente el JSON solicitado sin explicaciones adicionales fuera del JSON.
`.trim();

export function buildSchoolContextHeader(config: SchoolConfig): string {
  return `Institución: ${config.schoolName}, ${config.schoolCity}. Teléfono: ${config.schoolPhone}. Año lectivo: ${config.academicYear}. Directora: ${config.directorName}. Sistema de calificación institucional: ${
    config.gradingScale === 'percentage' ? 'Porcentaje (%)' : 'Puntos (escala 10)'
  }.`;
}

export function buildTemplateAdherenceBlock(template?: ExtractedTemplate | null): string {
  if (!template) return '';
  const sectionList = template.sections
    .map(
      (s, idx) =>
        `${idx + 1}. ${s.title} (${s.type})${
          s.fields?.length ? ` — Campos: ${s.fields.join(', ')}` : ''
        }${s.columns?.length ? ` — Columnas: ${s.columns.join(' | ')}` : ''}${
          s.notes ? ` — Notas: ${s.notes}` : ''
        }`
    )
    .join('\n');

  return `
PLANTILLA MODELO SELECCIONADA POR EL DOCENTE: "${template.name}" (${template.gradeLevel || 'General'})
Debes respetar estrictamente la estructura, el orden de secciones y el estilo del formato original del docente:
${sectionList}
Notas de estilo: ${template.styleNotes || 'Formato institucional limpio'}
Instrucciones extraídas: ${template.rawInstructions || 'Seguir exactamente el orden anterior.'}
`.trim();
}
