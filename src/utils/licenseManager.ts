export type LicenseUnit = 'days' | 'months' | 'years' | 'lifetime';
export type DeviceSlot = 'slot_1' | 'slot_2';

export interface LicenseConfig {
  activatedAt: string; // ISO string
  expiresAt: string | null; // ISO string, or null for lifetime
  durationValue: number;
  durationUnit: LicenseUnit;
  isLifetime?: boolean;
  licenseCode: string; // Default: '1978'
  lastCheckedAt?: string;
}

export interface DeviceBindingState {
  machineId: string;
  assignedSlot: DeviceSlot | null;
  isAuthorized: boolean;
  isPortableUsbMode: boolean;
  registeredAt: string | null;
  slot1MachineId: string | null;
  slot2MachineId: string | null;
}

const STORAGE_KEY = 'renova_nexus_license_config_v1';
const DEVICE_STORAGE_KEY = 'renova_nexus_device_binding_v2';
const MACHINE_ID_KEY = 'renova_nexus_machine_id_v2';

export const DEFAULT_LICENSE_CODE = '1978';
export const MAX_AUTHORIZED_DEVICES = 2;
export const SUPPORT_PHONE = '71405449';
export const SUPPORT_PHONE_FULL = '+503 7140-5449';
export const SUPPORT_CEO = 'Dr. Oscar Alexander Guevara';

/**
 * Generates or retrieves a persistent, deterministic Hardware/Environment Token (Machine ID).
 * Combines hardware concurrency, screen dimensions, platform, language, canvas hash and local salt.
 */
export function getMachineId(): string {
  if (typeof window === 'undefined') {
    return 'RNX-PC-0000-0000';
  }
  try {
    const existing = localStorage.getItem(MACHINE_ID_KEY);
    if (existing && existing.startsWith('RNX-PC-')) {
      return existing;
    }

    // Generate environment fingerprint
    let canvasHash = 0;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 30;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#003366';
        ctx.fillText('RENOVA-NEXUS-2026', 2, 2);
        const imgData = ctx.getImageData(0, 0, 10, 10).data;
        for (let i = 0; i < imgData.length; i++) {
          canvasHash = ((canvasHash << 5) - canvasHash) + imgData[i];
          canvasHash |= 0;
        }
      }
    } catch {
      canvasHash = 98765;
    }

    const screenInfo = window.screen ? `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}` : '1920x1080x24';
    const cores = navigator.hardwareConcurrency || 4;
    const lang = navigator.language || 'es-SV';
    const platform = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || 'Win32';

    // Fast, robust Fowler-Noll-Vo / DJB2 mix hash
    const rawString = `${screenInfo}|${cores}|${lang}|${platform}|${canvasHash}`;
    let h1 = 0x811c9dc5;
    for (let i = 0; i < rawString.length; i++) {
      h1 ^= rawString.charCodeAt(i);
      h1 = Math.imul(h1, 0x01000193);
    }

    // Add a machine-specific random seed so identical screen specs on two machines stay unique
    const randPart = Math.floor(Math.random() * 0xffff);
    const hexPart1 = (Math.abs(h1) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
    const hexPart2 = (randPart & 0xffff).toString(16).toUpperCase().padStart(4, '0');

    const generatedId = `RNX-PC-${hexPart1}-${hexPart2}`;
    localStorage.setItem(MACHINE_ID_KEY, generatedId);
    return generatedId;
  } catch (e) {
    console.error('Error al generar ID de equipo:', e);
    return 'RNX-PC-9A1F-38C2';
  }
}

/**
 * Calculates a unique, cryptographically-salted activation key for a given Machine ID and Slot.
 * Format: RNX-XXXX-YYYY
 */
export function generateActivationKeyForMachine(machineId: string, slot: DeviceSlot): string {
  const cleanId = machineId.trim().toUpperCase();
  const salt = `RENOVA_NEXUS_${slot.toUpperCase()}_2026_CMI_KEY`;
  const combined = cleanId + '|' + salt;

  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash) + combined.charCodeAt(i);
    hash |= 0;
  }

  const p1 = Math.abs(hash & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const p2 = Math.abs((hash >> 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `RNX-${p1}-${p2}`;
}

/**
 * Retrieves the device binding state from LocalStorage.
 */
export function getDeviceBindingState(): DeviceBindingState {
  const machineId = getMachineId();
  try {
    const raw = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DeviceBindingState>;
      return {
        machineId,
        assignedSlot: parsed.assignedSlot || null,
        isAuthorized: Boolean(parsed.isAuthorized),
        isPortableUsbMode: Boolean(parsed.isPortableUsbMode),
        registeredAt: parsed.registeredAt || null,
        slot1MachineId: parsed.slot1MachineId || null,
        slot2MachineId: parsed.slot2MachineId || null,
      };
    }
  } catch (e) {
    console.error('Error al leer estado de vinculación de equipo:', e);
  }

  // Initial unbound state
  const initial: DeviceBindingState = {
    machineId,
    assignedSlot: null,
    isAuthorized: false,
    isPortableUsbMode: false,
    registeredAt: null,
    slot1MachineId: null,
    slot2MachineId: null,
  };
  saveDeviceBindingState(initial);
  return initial;
}

/**
 * Persists device binding state to LocalStorage.
 */
export function saveDeviceBindingState(state: DeviceBindingState): void {
  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Error al guardar estado de vinculación de equipo:', e);
  }
}

/**
 * Verifies and activates a device slot using an activation key or master PIN.
 */
export function activateDeviceSlot(
  slot: DeviceSlot,
  inputKey: string
): { success: boolean; message: string; state: DeviceBindingState } {
  const current = getDeviceBindingState();
  const cleanInput = inputKey.trim().toUpperCase();
  const machineId = current.machineId;

  const validSlotKey = generateActivationKeyForMachine(machineId, slot);
  const isMasterCode = cleanInput === DEFAULT_LICENSE_CODE || cleanInput === getLicenseConfig().licenseCode.trim();
  const isValidMachineKey = cleanInput === validSlotKey;

  if (!isMasterCode && !isValidMachineKey) {
    return {
      success: false,
      message: 'Clave de activación inválida para este equipo y slot seleccionado. Verifique con el Dr. Oscar Alexander Guevara.',
      state: current,
    };
  }

  const now = new Date().toISOString();
  const updated: DeviceBindingState = {
    ...current,
    assignedSlot: slot,
    isAuthorized: true,
    isPortableUsbMode: false,
    registeredAt: now,
    slot1MachineId: slot === 'slot_1' ? machineId : current.slot1MachineId,
    slot2MachineId: slot === 'slot_2' ? machineId : current.slot2MachineId,
  };

  saveDeviceBindingState(updated);
  return {
    success: true,
    message: `¡Equipo vinculado y activado con éxito como ${slot === 'slot_1' ? 'Equipo 1 (Principal)' : 'Equipo 2 (Secundario)'}!`,
    state: updated,
  };
}

/**
 * Activates Portable USB Mode directly (for use while running from the USB pendrive).
 */
export function activatePortableUsbMode(inputKey: string): { success: boolean; message: string; state: DeviceBindingState } {
  const current = getDeviceBindingState();
  const cleanInput = inputKey.trim();
  const isMasterCode = cleanInput === DEFAULT_LICENSE_CODE || cleanInput === getLicenseConfig().licenseCode.trim();

  if (!isMasterCode) {
    return {
      success: false,
      message: 'Código de administrador incorrecto para activar el Modo Portátil USB.',
      state: current,
    };
  }

  const updated: DeviceBindingState = {
    ...current,
    isAuthorized: true,
    isPortableUsbMode: true,
    registeredAt: new Date().toISOString(),
  };

  saveDeviceBindingState(updated);
  return {
    success: true,
    message: '¡Modo Portátil USB activado! La aplicación se ejecutará directamente desde la memoria USB.',
    state: updated,
  };
}

/**
 * Unbinds the current machine slot, liberating it so it can be re-bound to another computer.
 */
export function unbindCurrentDevice(): DeviceBindingState {
  const current = getDeviceBindingState();
  const slot = current.assignedSlot;

  const updated: DeviceBindingState = {
    ...current,
    assignedSlot: null,
    isAuthorized: false,
    isPortableUsbMode: false,
    registeredAt: null,
    slot1MachineId: slot === 'slot_1' ? null : current.slot1MachineId,
    slot2MachineId: slot === 'slot_2' ? null : current.slot2MachineId,
  };

  saveDeviceBindingState(updated);
  return updated;
}

/**
 * Resets all device slots (Administrator function).
 */
export function resetAllDeviceSlots(): DeviceBindingState {
  const machineId = getMachineId();
  const fresh: DeviceBindingState = {
    machineId,
    assignedSlot: null,
    isAuthorized: false,
    isPortableUsbMode: false,
    registeredAt: null,
    slot1MachineId: null,
    slot2MachineId: null,
  };
  saveDeviceBindingState(fresh);
  return fresh;
}

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
  deviceBinding: DeviceBindingState;
}

/**
 * Computes the live license status, device binding, and remaining time.
 */
export function checkLicenseStatus(): LicenseStatus {
  const config = getLicenseConfig();
  const deviceBinding = getDeviceBindingState();
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
      deviceBinding,
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
    deviceBinding,
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
