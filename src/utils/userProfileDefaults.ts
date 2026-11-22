import type { SchoolConfig } from '../types/casm';

function normalizeName(value?: string): string {
  return (value || '').trim().toLowerCase();
}

/**
 * Returns 'Profesor' or 'Profesora' according to the user's profile gender.
 */
export function getDefaultTeacherTitle(config: SchoolConfig): string {
  return config.userProfile?.gender === 'masculino' ? 'Profesor' : 'Profesora';
}

/**
 * Returns the logged-in user's profile name when configured,
 * falling back to the school's teacher directory.
 */
export function getDefaultTeacherName(config: SchoolConfig, fallbackIndex = 1): string {
  const profileName = config.userProfile?.name?.trim();
  if (profileName) return profileName;
  return config.teachers[fallbackIndex]?.name || config.teachers[0]?.name || '[COMPLETAR]';
}

/**
 * Returns the user's configured specialty as the default subject for new documents.
 * Matches existing configured subjects case-insensitively when possible.
 */
export function getDefaultSubject(config: SchoolConfig, fallbackIndex = 0): string {
  const specialty = config.userProfile?.specialty?.trim();
  if (specialty) {
    const exactMatch = config.subjects.find(
      (s) => normalizeName(s) === normalizeName(specialty)
    );
    return exactMatch || specialty;
  }
  return config.subjects[fallbackIndex] || config.subjects[0] || 'Lenguaje y Literatura';
}

/**
 * Builds deduplicated subject options for <select> inputs, ensuring the user's
 * custom specialty and current document subject remain selectable.
 */
export function getSubjectOptions(config: SchoolConfig, currentValue?: string): string[] {
  const seen = new Set<string>();
  const list: string[] = [];

  const pushUnique = (val?: string) => {
    const clean = (val || '').trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      list.push(clean);
    }
  };

  pushUnique(config.userProfile?.specialty);
  for (const subject of config.subjects) {
    pushUnique(subject);
  }
  pushUnique(currentValue);

  return list;
}

/**
 * Returns a clean role label using the user's specialty when configured.
 */
export function getDefaultTeacherRole(
  config: SchoolConfig,
  fallbackRole = 'Docente Guía'
): string {
  const specialty = config.userProfile?.specialty?.trim();
  if (config.userProfile?.name?.trim() && specialty) {
    return `Docente — ${specialty}`;
  }
  return fallbackRole;
}

/**
 * Resolves a scanned signature PNG data URL for a given person's name:
 * 1) Active user profile signature (if name matches)
 * 2) Director signature (if name matches directorName)
 * 3) Teacher directory signature (if name matches)
 */
export function resolveTeacherSignature(
  config: SchoolConfig,
  personName: string
): string | undefined {
  const target = normalizeName(personName);
  if (!target) return undefined;

  if (
    config.userProfile?.signatureDataUrl &&
    normalizeName(config.userProfile.name) === target
  ) {
    return config.userProfile.signatureDataUrl;
  }

  if (config.directorSignature && normalizeName(config.directorName) === target) {
    return config.directorSignature;
  }

  return config.teachers.find((t) => normalizeName(t.name) === target)?.signatureDataUrl;
}
