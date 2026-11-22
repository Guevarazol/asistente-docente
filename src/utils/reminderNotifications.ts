import type { ReminderAlert, ReminderCategory } from '../types/casm';

export type BrowserNotificationPermission = NotificationPermission | 'unsupported';

export const REMINDER_CATEGORY_LABELS: Record<ReminderCategory, string> = {
  planificacion: 'Entrega de planificación',
  cierre_notas: 'Cierre de notas',
  otro: 'Otro recordatorio docente',
};

export const REMINDER_ADVANCE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'A la hora exacta' },
  { value: 60, label: '1 hora antes' },
  { value: 1440, label: '1 día antes' },
  { value: 2880, label: '2 días antes' },
  { value: 4320, label: '3 días antes' },
];

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): BrowserNotificationPermission {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

export function computeDueTimestamp(dueDate: string, dueTime: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const safeTime = /^\d{2}:\d{2}$/.test(dueTime) ? dueTime : '08:00';
  const [year, month, day] = dueDate.split('-').map(Number);
  const [hour, minute] = safeTime.split(':').map(Number);
  const dt = new Date(year, month - 1, day, hour, minute, 0, 0);
  const ms = dt.getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function computeTriggerTimestamp(reminder: ReminderAlert): number | null {
  const dueMs = computeDueTimestamp(reminder.dueDate, reminder.dueTime);
  if (dueMs === null) return null;
  const advanceMs = Math.max(0, Number(reminder.advanceMinutes) || 0) * 60_000;
  return dueMs - advanceMs;
}

export function getAdvanceLabel(minutes: number): string {
  const found = REMINDER_ADVANCE_OPTIONS.find((opt) => opt.value === minutes);
  if (found) return found.label;
  if (minutes >= 1440) {
    const days = Math.round(minutes / 1440);
    return `${days} ${days === 1 ? 'día' : 'días'} antes`;
  }
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60);
    return `${hours} ${hours === 1 ? 'hora' : 'horas'} antes`;
  }
  return 'A la hora exacta';
}

export function formatDueDateSpanish(dueDate: string, dueTime: string): string {
  const dueMs = computeDueTimestamp(dueDate, dueTime);
  if (dueMs === null) return `${dueDate} ${dueTime}`;
  return new Date(dueMs).toLocaleString('es-SV', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function buildReminderBody(reminder: ReminderAlert): string {
  const categoryLabel = REMINDER_CATEGORY_LABELS[reminder.category] || 'Recordatorio';
  const dueStr = formatDueDateSpanish(reminder.dueDate, reminder.dueTime);
  const extra = reminder.notes?.trim() ? ` · ${reminder.notes.trim()}` : '';
  return `${categoryLabel} — Fecha límite: ${dueStr}${extra}`;
}

export async function dispatchBrowserNotification(
  title: string,
  body: string,
  tag?: string
): Promise<boolean> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const options: NotificationOptions = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag,
    lang: 'es-SV',
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, options);
        return true;
      }
    }
  } catch {
    // Fallback to window Notification constructor below
  }

  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
