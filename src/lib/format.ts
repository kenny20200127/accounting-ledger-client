export function singular(value: string) {
  return value.endsWith('s') ? value.slice(0, -1) : value;
}

export function humanize(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function formatDate(value: unknown) {
  if (!value) return '—';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
}

export function formatMoney(value: unknown, currency = 'NGN') {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency || 'NGN',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}
