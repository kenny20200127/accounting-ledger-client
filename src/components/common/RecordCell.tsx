import { formatDate, formatMoney } from '../../lib/format';

export function RecordCell({ column, value }: { column: string; value: unknown }) {
  if (value === null || value === undefined || value === '')
    return <span className="text-muted">—</span>;

  if (column.toLowerCase().includes('date')) return <>{formatDate(value)}</>;

  if (/amount|balance|cost|limit/i.test(column))
    return <span>{formatMoney(value)}</span>;

  if (typeof value === 'boolean')
    return (
      <span className={`bool ${value ? 'yes' : 'no'}`}>
        {value ? 'Active' : 'No'}
      </span>
    );

  if (column.toLowerCase() === 'status')
    return (
      <span className={`status ${String(value).toLowerCase()}`}>
        {String(value).replaceAll('_', ' ')}
      </span>
    );

  return (
    <span className={/name|number|code/i.test(column) ? 'primary-cell' : ''}>
      {String(value)}
    </span>
  );
}
