import type { CaptureLine } from './types';

export const docTypes = [
  { value: 'JV', label: 'JV — Journal voucher' },
  { value: 'BV', label: 'BV — Bank voucher' },
  { value: 'CV', label: 'CV — Cash voucher' },
  { value: 'PV', label: 'PV — Payment voucher' },
  { value: 'RV', label: 'RV — Receipt voucher' },
  { value: 'CN', label: 'CN — Credit note' },
  { value: 'DN', label: 'DN — Debit note' },
];

export const amountPattern = /^(?=.*[1-9])\d+(\.\d{1,2})?$/;

let lineIdCounter = 1;

export const blankLine = (
  overrides: Partial<Omit<CaptureLine, 'id'>> = {},
): CaptureLine => ({
  id: lineIdCounter++,
  accountCode: '',
  accountName: '',
  amount: '',
  transactionType: 'DB',
  remarks: '',
  ...overrides,
});

export function today() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (name: string) => parts.find((item) => item.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function toCents(value: string): number {
  const raw = String(value || '0');
  const negative = raw.startsWith('-');
  const [whole, fraction = ''] = raw.replace(/^[+-]/, '').split('.');
  const cents = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
  return negative ? -cents : cents;
}

export function money(value: string | number | undefined) {
  return formatCents(toCents(String(value ?? '0')));
}

export function formatCents(cents: number) {
  const abs = Math.abs(cents);
  const grouped = `${String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${String(abs % 100).padStart(2, '0')}`;
  return cents < 0 ? `(${grouped})` : grouped;
}
