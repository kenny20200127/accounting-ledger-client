import { Activity, ArrowUpRight, Download, FileChartColumnIncreasing, Pencil, Plus, Search, Settings2, Trash2, X } from 'lucide-react';
import type { Page } from '../../types';
import { humanize, singular } from '../../lib/format';
import { RecordCell } from '../common/RecordCell';

function readCell(row: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value && typeof value === 'object')
      return (value as Record<string, unknown>)[key];
    return undefined;
  }, row);
}

function columnLabel(path: string): string {
  const parts = path.split('.');
  return parts
    .slice(-2)
    .map((part) => humanize(part))
    .join(' ');
}

function columnLeaf(path: string): string {
  return path.split('.').pop() ?? path;
}

type RecordsViewProps = {
  page: Page;
  companyName?: string;
  rows: Record<string, unknown>[];
  loading: boolean;
  error: string;
  search: string;
  isPaginated: boolean;
  pageSize: number;
  listPageNumber: number;
  listTotal: number;
  listTotalPages: number;
  pdfBusyId: string;
  canEdit: boolean;
  canDelete: boolean;
  onSearch: (value: string) => void;
  onRefresh: () => void;
  onCreate: () => void;
  onEdit: (row: Record<string, unknown>) => void;
  onDelete: (row: Record<string, unknown>) => void;
  onDismissError: () => void;
  onPageSizeChange: (size: number) => void;
  onPageChange: (page: number) => void;
  onDownloadPdf: (row: Record<string, unknown>) => void;
  onOpenReport?: () => void;
};

export function RecordsView({
  page,
  companyName,
  rows,
  loading,
  error,
  search,
  isPaginated,
  pageSize,
  listPageNumber,
  listTotal,
  listTotalPages,
  pdfBusyId,
  canEdit,
  canDelete,
  onSearch,
  onRefresh,
  onCreate,
  onEdit,
  onDelete,
  onDismissError,
  onPageSizeChange,
  onPageChange,
  onDownloadPdf,
  onOpenReport,
}: RecordsViewProps) {
  const visibleRows = isPaginated
    ? rows
    : rows.filter((row) =>
        JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
      );

  return (
    <>
      <div className="page-heading">
        <div>
          <small className="eyebrow">
            {companyName ?? 'ACCOUNTING OPERATIONS'}
          </small>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </div>
        <div className="heading-actions">
          {onOpenReport && (
            <button className="btn btn-light" onClick={onOpenReport}>
              <FileChartColumnIncreasing size={15} />
              Report
            </button>
          )}
          <button className="btn btn-light" onClick={onRefresh}>
            <Activity size={15} />
            Refresh
          </button>
          {page.fields && (
            <button className="btn btn-primary" onClick={onCreate}>
              <Plus size={16} />
              New {singular(page.title)}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={onDismissError} aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      )}

      <section className="table-panel">
        <div className="table-toolbar">
          <div className="count">
            <b>{loading ? '…' : visibleRows.length}</b> records
          </div>
          <label className="search">
            <Search size={15} />
            <input
              value={search}
              maxLength={isPaginated ? 100 : undefined}
              onChange={(event) => onSearch(event.target.value)}
              placeholder={`Search ${page.title.toLowerCase()}`}
            />
          </label>
          <button className="slide-toggle-btn" title="Filters">
            <Settings2 size={16} />
          </button>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {(page.columns ?? []).map((column) => (
                  <th key={column}>{columnLabel(column)}</th>
                ))}
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="empty" colSpan={(page.columns?.length ?? 0) + 1}>
                    Loading records…
                  </td>
                </tr>
              ) : visibleRows.length ? (
                visibleRows.map((row, index) => (
                  <tr
                    key={String(
                      row.companyId ??
                        row.userId ??
                        row.customerId ??
                        row.invoiceId ??
                        row.expenseId ??
                        row.accountId ??
                        row.mainAccountId ??
                        row.balanceSheetId ??
                        row.accountSubtypeId ??
                        row.accountTypeId ??
                        row.bankAccountId ??
                        row.fiscalYearId ??
                        row.periodId ??
                        row.journalEntryId ??
                        row.supplierId ??
                        index,
                    )}
                  >
                    {page.columns?.map((column) => (
                      <td key={column}>
                        <RecordCell
                          column={columnLeaf(column)}
                          value={readCell(row, column)}
                        />
                      </td>
                    ))}
                    <td>
                      <div className="row-actions">
                        <button className="row-open" title="Open record">
                          <ArrowUpRight size={14} />
                        </button>
                        {page.editFields && canEdit ? (
                          <button
                            className="row-open"
                            title="Edit record"
                            onClick={() => onEdit(row)}
                          >
                            <Pencil size={14} />
                          </button>
                        ) : null}
                        {page.deletable &&
                        canDelete &&
                        page.idField &&
                        typeof row[page.idField] === 'string' ? (
                          <button
                            className="row-open danger"
                            title="Delete record"
                            onClick={() => onDelete(row)}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                        {page.pdfDownload &&
                        typeof row[page.pdfDownload.idField] === 'string' ? (
                          <button
                            className="row-open"
                            title="Download PDF"
                            disabled={pdfBusyId === row[page.pdfDownload.idField]}
                            onClick={() => onDownloadPdf(row)}
                          >
                            <Download size={14} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="empty" colSpan={(page.columns?.length ?? 0) + 1}>
                    <Search size={19} />
                    <b>
                      {error ? 'Could not load records' : 'Nothing here yet'}
                    </b>
                    <span>
                      {error
                        ? 'Check permissions and API availability.'
                        : 'Records for this company will appear here.'}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span aria-live="polite">
            {loading
              ? 'Loading records…'
              : isPaginated
                ? `Showing ${rows.length ? (listPageNumber - 1) * pageSize + 1 : 0}–${rows.length ? (listPageNumber - 1) * pageSize + rows.length : 0} of ${listTotal}`
                : `Showing ${visibleRows.length ? 1 : 0}–${visibleRows.length} of ${visibleRows.length}`}
          </span>
          {isPaginated ? (
            <div className="pagination-controls">
              <label>
                Rows per page{' '}
                <select
                  aria-label="Rows per page"
                  value={pageSize}
                  onChange={(event) => onPageSizeChange(Number(event.target.value))}
                >
                  {[10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn btn-light"
                disabled={loading || listPageNumber <= 1}
                onClick={() => onPageChange(listPageNumber - 1)}
              >
                Previous
              </button>
              <span>
                Page {listPageNumber} of {Math.max(1, listTotalPages)}
              </span>
              <button
                className="btn btn-light"
                disabled={loading || listPageNumber >= listTotalPages}
                onClick={() => onPageChange(listPageNumber + 1)}
              >
                Next
              </button>
            </div>
          ) : (
            <span>All matching records</span>
          )}
        </div>
      </section>
    </>
  );
}
