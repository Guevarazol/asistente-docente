export type LicenseUnit = 'days' | 'months' | 'years' | 'lifetime';

export interface LicenseConfig {
  activatedAt: string; // ISO string
  expiresAt: string | null; // ISO string, or null for lifetime
  durationValue: number;
  durationUnit: LicenseUnit;
  isLifetime?: boolean;
  licenseCode: string; // Default: '1978'
  lastCheckedAt?: string;
}

const STORAGE_KEY = 'renova_nexus_license_config_v1';
export const DEFAULT_LICENSE_CODE = '1978';

/**
 * Calculates a future expiration date from a starting date, value, and unit.
 */
export function calculateExpirationDate(
  startDate: Date,
  value: number,
  unit: LicenseUnit
): Date | null {
  if (unit === 'lifetime') {
    return null;
  }
  const result = new Date(startDate.getTime());
  if (unit === 'days') {
    result.setDate(result.getDate() + value);
  } else if (unit === 'months') {
    result.setMonth(result.getMonth() + value);
  } else if (unit === 'years') {
    result.setFullYear(result.getFullYear() + value);
  }
  return result;
}

/**
 * Retrieves the current stored license configuration, or initializes a default one.
 */
export function getLicenseConfig(): LicenseConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LicenseConfig;
      if (parsed.licenseCode) {
        if (parsed.isLifetime || parsed.durationUnit === 'lifetime' || parsed.expiresAt === null) {
          return {
            ...parsed,
            expiresAt: null,
            durationUnit: 'lifetime',
            isLifetime: true,
          };
        }
        if (parsed.expiresAt) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.error('Error al leer configuración de licencia:', e);
  }

  // Default initial license: 365 days from now
  const now = new Date();
  const defaultExp = calculateExpirationDate(now, 1, 'years');
  const initialConfig: LicenseConfig = {
    activatedAt: now.toISOString(),
    expiresAt: defaultExp ? defaultExp.toISOString() : null,
    durationValue: 1,
    durationUnit: 'years',
    isLifetime: false,
    licenseCode: DEFAULT_LICENSE_CODE,
  };

  saveLicenseConfig(initialConfig);
  return initialConfig;
}

/**
 * Persists the license configuration to LocalStorage.
 */
export function saveLicenseConfig(config: LicenseConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Error al guardar configuración de licencia:', e);
  }
}

export interface LicenseStatus {
  isExpired: boolean;
  isLifetime: boolean;
  isTrial: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  formattedExpiresAt: string;
  expiresAt: Date | null;
  activatedAt: Date;
  config: LicenseConfig;
}

/**
 * Computes the live license status and remaining time.
 */
export function checkLicenseStatus(): LicenseStatus {
  const config = getLicenseConfig();
  const now = new Date();
  const isLifetime = Boolean(config.isLifetime || config.durationUnit === 'lifetime' || config.expiresAt === null);

  if (isLifetime) {
    return {
      isExpired: false,
      isLifetime: true,
      isTrial: false,
      daysRemaining: 999999,
      hoursRemaining: 0,
      formattedExpiresAt: 'Licencia Vitalicia (Permanente · Sin Vencimiento)',
      expiresAt: null,
      activatedAt: new Date(config.activatedAt),
      config,
    };
  }

  const exp = new Date(config.expiresAt!);
  const diffMs = exp.getTime() - now.getTime();
  const isExpired = diffMs <= 0;

  const totalHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  const daysRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const hoursRemaining = totalHours % 24;

  const isTrial = config.durationUnit === 'days' && config.durationValue <= 7;

  const formattedExpiresAt = exp.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    isExpired,
    isLifetime: false,
    isTrial,
    daysRemaining,
    hoursRemaining,
    formattedExpiresAt,
    expiresAt: exp,
    activatedAt: new Date(config.activatedAt),
    config,
  };
}

/**
 * Updates the license duration from now.
 */
export function setLicenseDuration(
  value: number,
  unit: LicenseUnit,
  newCode?: string
): LicenseConfig {
  const current = getLicenseConfig();
  const now = new Date();
  const isLifetime = unit === 'lifetime';
  const expiresAt = isLifetime ? null : calculateExpirationDate(now, value, unit);

  const updated: LicenseConfig = {
    activatedAt: now.toISOString(),
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    durationValue: isLifetime ? 1 : value,
    durationUnit: unit,
    isLifetime,
    licenseCode: (newCode || current.licenseCode || DEFAULT_LICENSE_CODE).trim(),
  };

  saveLicenseConfig(updated);
  return updated;
}

/**
 * Verifies if an input code matches the stored license code (or the master code 1978).
 */
export function verifyLicenseCode(inputCode: string): boolean {
  const current = getLicenseConfig();
  const clean = inputCode.trim();
  return clean === current.licenseCode || clean === DEFAULT_LICENSE_CODE;
}

/**
 * Simulates immediate license expiration for admin testing.
 */
export function simulateImmediateExpiration(): LicenseConfig {
  const current = getLicenseConfig();
  const past = new Date(Date.now() - 60 * 1000); // 1 minute in the past
  const updated: LicenseConfig = {
    ...current,
    expiresAt: past.toISOString(),
    durationUnit: 'days',
    isLifetime: false,
  };
  saveLicenseConfig(updated);
  return updated;
}
