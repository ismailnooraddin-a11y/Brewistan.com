import { HttpError } from './http.ts';

export function asciiDigits(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (c) => {
    const n = c.charCodeAt(0); return String(n >= 0x06f0 ? n - 0x06f0 : n - 0x0660);
  });
}
export function normalizePhone(value: unknown): string {
  return asciiDigits(value).replace(/[^0-9]/g, '');
}

/** A legacy client must retain its queue, not delete rows after a per-event rejection. */
export function requireCurrentQueueFormat(events: readonly unknown[]): void {
  if (events.some((raw) => {
    if (!raw || typeof raw !== 'object') return true;
    const e = raw as Record<string, unknown>;
    return ['staffId','scannerDeviceId','snapshot'].some(k => typeof e[k] !== 'string' || !e[k]);
  })) throw new HttpError(426, 'client_upgrade_required', 'Keep this offline queue. Upgrade and contact support to reconcile legacy scans; do not clear app data.');
}
