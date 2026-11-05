import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { API_PREFIX } from '../../api-url';
import type { ViewProps } from '../common/types';
import { AccountPicker } from './AccountPicker';
import { read } from './api';
import {
  amountPattern,
  blankLine,
  docTypes,
  formatCents,
  money,
  toCents,
  today,
} from './format';
import type { CaptureLine, HistoryPage, PostResult } from './types';

export function LedgerCaptureView({ token, companyId }: ViewProps) {
  const [docType, setDocType] = useState('JV');
  const [refNo, setRefNo] = useState('');
  const [docDate, setDocDate] = useState(today);
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState<
    { branchId: string; branchName: string }[]
  >([]);
  const [lines, setLines] = useState<CaptureLine[]>([blankLine()]);
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState<PostResult | null>(null);
  const [error, setError] = useState('');

  const [history, setHistory] = useState<HistoryPage | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const debitCents = lines.reduce(
    (sum, line) => sum + (line.transactionType === 'DB' ? toCents(line.amount) : 0),
    0,
  );
  const creditCents = lines.reduce(
    (sum, line) => sum + (line.transactionType === 'CR' ? toCents(line.amount) : 0),
    0,
  );
  const difference = debitCents - creditCents;

  useEffect(() => {
    if (!companyId) return;
    read<{ branchId: string; branchName: string }[]>(
      `${API_PREFIX}/branches?companyId=${encodeURIComponent(companyId)}`,
      token,
    )
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => setBranches([]));
  }, [companyId, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, companyId]);

  useEffect(() => {
    if (!companyId) return;
    const controller = new AbortController();
    setHistoryLoading(true);
    const params = new URLSearchParams({
      companyId,
      page: String(page),
      limit: '10',
    });
    if (debouncedSearch) params.set('q', debouncedSearch);
    read<HistoryPage>(
      `${API_PREFIX}/ledger-batches?${params}`,
      token,
      { signal: controller.signal },
    )
      .then((data) => setHistory(data))
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Failed to load postings.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
    return () => controller.abort();
  }, [companyId, token, debouncedSearch, page, historyRefresh]);

  async function post(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setResult(null);
    if (lines.length === 0) return setError('Add at least one ledger line.');
    for (const line of lines) {
      if (!line.accountCode) return setError('Every line needs a ledger account.');
      if (!amountPattern.test(line.amount))
        return setError(
          `Line amount "${line.amount || '—'}" must be a positive number with up to two decimals.`,
        );
    }
    setPosting(true);
    try {
      const payload = {
        companyId,
        ...(branchId ? { branchId } : {}),
        docType,
        ...(refNo.trim() ? { refNo: refNo.trim() } : {}),
        docDate,
        lines: lines.map((line) => ({
          accountCode: line.accountCode,
          amount: line.amount,
          transactionType: line.transactionType,
          ...(line.remarks.trim() ? { remarks: line.remarks.trim() } : {}),
        })),
      };
      const data = await read<PostResult>(`${API_PREFIX}/ledger-batches`, token, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setResult(data);
      setLines([blankLine()]);
      setRefNo('');
      setHistoryRefresh((value) => value + 1);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Failed to post the ledger batch.',
      );
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="extra-page-view">
      <div className="page-heading">
        <div>
          <small className="eyebrow">LEDGER CAPTURE</small>
          <h1>Ledger capture</h1>
          <p>Post debit and credit lines to ledger accounts and review recent postings.</p>
        </div>
        <div className="heading-actions">
          <button
            className="btn btn-light"
            type="button"
            onClick={() => setHistoryRefresh((value) => value + 1)}
          >
            <RefreshCw size={14} className={historyLoading ? 'spinning' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {result && (
        <section className="table-panel" aria-label="Posting result">
          <div className="table-toolbar">
            <div className="count">
              <b>
                <CheckCircle2 size={14} /> Posted {result.docNo}
              </b>{' '}
              · {result.docType} · {result.docDate} · Period {result.period}
            </div>
            <button
              className="btn btn-light"
              type="button"
              onClick={() => setResult(null)}
              aria-label="Dismiss result"
            >
              <X size={14} />
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Running debit balance</th>
                  <th>Running credit balance</th>
                </tr>
              </thead>
              <tbody>
                {result.balances.map((balance) => {
                  const posted = result.lines.filter(
                    (line) => line.accountCode === balance.accountCode,
                  );
                  const lineDebit = posted.reduce(
                    (sum, line) =>
                      sum + (line.transactionType === 'DB' ? toCents(line.amount) : 0),
                    0,
                  );
                  const lineCredit = posted.reduce(
                    (sum, line) =>
                      sum + (line.transactionType === 'CR' ? toCents(line.amount) : 0),
                    0,
                  );
                  return (
                    <tr key={balance.accountCode}>
                      <td className="primary-cell">
                        <b>{balance.accountCode}</b> {balance.accountName}
                      </td>
                      <td>{lineDebit ? formatCents(lineDebit) : '—'}</td>
                      <td>{lineCredit ? formatCents(lineCredit) : '—'}</td>
                      <td>{formatCents(toCents(balance.debitBalance))}</td>
                      <td>{formatCents(toCents(balance.creditBalance))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <form className="table-panel" onSubmit={post} noValidate>
        <div className="table-toolbar">
          <div className="count">
            <b>New ledger batch</b>
          </div>
        </div>
        <div className="form-grid">
          <label className="field">
            Document type
            <select value={docType} onChange={(event) => setDocType(event.target.value)}>
              {docTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Document number
            <input value="Assigned automatically when posted" disabled />
          </label>
          <label className="field">
            Reference number
            <input
              value={refNo}
              onChange={(event) => setRefNo(event.target.value)}
              maxLength={20}
              placeholder="Optional"
            />
          </label>
          <label className="field">
            Document date *
            <input
              type="date"
              required
              value={docDate}
              onChange={(event) => setDocDate(event.target.value)}
            />
          </label>
          <label className="field">
            Branch
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
            >
              <option value="">No branch</option>
              {branches.map((branch) => (
                <option key={branch.branchId} value={branch.branchId}>
                  {branch.branchName}
                </option>
              ))}
            </select>
          </label>

          <div className="field full line-items">
            <div className="line-items-head">
              <span>Lines</span>
              <button
                className="btn btn-light"
                type="button"
                onClick={() => setLines((rows) => [...rows, blankLine()])}
              >
                <Plus size={14} /> Add line
              </button>
            </div>
            {lines.map((line, index) => (
              <div key={line.id} className="line-item">
                <div className="line-item-fields">
                  <label className="field full">
                    Ledger account *
                    <AccountPicker
                      token={token}
                      companyId={companyId}
                      value={line.accountCode}
                      selectedLabel={
                        line.accountCode
                          ? `${line.accountCode} - ${line.accountName}`
                          : ''
                      }
                      onChange={(code, name) =>
                        setLines((rows) =>
                          rows.map((current) =>
                            current.id === line.id
                              ? { ...current, accountCode: code, accountName: name }
                              : current,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    Amount *
                    <input
                      inputMode="decimal"
                      value={line.amount}
                      onChange={(event) => {
                        const value = event.target.value.replace(/[^\d.]/g, '');
                        setLines((rows) =>
                          rows.map((current) =>
                            current.id === line.id
                              ? { ...current, amount: value }
                              : current,
                          ),
                        );
                      }}
                      placeholder="0.00"
                    />
                  </label>
                  <label className="field">
                    Type
                    <select
                      value={line.transactionType}
                      onChange={(event) =>
                        setLines((rows) =>
                          rows.map((current) =>
                            current.id === line.id
                              ? {
                                  ...current,
                                  transactionType: event.target.value as 'DB' | 'CR',
                                }
                              : current,
                          ),
                        )
                      }
                    >
                      <option value="DB">DB — Debit</option>
                      <option value="CR">CR — Credit</option>
                    </select>
                  </label>
                  <label className="field">
                    Remarks
                    <input
                      value={line.remarks}
                      onChange={(event) =>
                        setLines((rows) =>
                          rows.map((current) =>
                            current.id === line.id
                              ? { ...current, remarks: event.target.value.slice(0, 60) }
                              : current,
                          ),
                        )
                      }
                      maxLength={60}
                    />
                  </label>
                </div>
                <button
                  className="btn btn-light"
                  type="button"
                  aria-label={`Remove line ${index + 1}`}
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((rows) => rows.filter((current) => current.id !== line.id))
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="report-filter-actions">
          <div className="count">
            Debits <b>{formatCents(debitCents)}</b> · Credits{' '}
            <b>{formatCents(creditCents)}</b> ·{' '}
            {difference === 0 ? (
              <span className="status paid">Balanced</span>
            ) : (
              <span className="status partial">
                Out of balance by {formatCents(Math.abs(difference))}
              </span>
            )}
          </div>
          <button className="btn btn-primary" type="submit" disabled={posting}>
            <CheckCircle2 size={15} /> {posting ? 'Posting…' : 'Post entry'}
          </button>
        </div>
      </form>

      <section className="table-panel" aria-label="Recent postings">
        <div className="table-toolbar">
          <label className="field" style={{ minWidth: 260 }}>
            <span className="combobox-search-icon" aria-hidden>
              <Search size={13} />
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search documents or accounts…"
            />
          </label>
          <div className="count">
            <b>{history?.total ?? 0}</b> Postings
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Doc no</th>
                <th>Type</th>
                <th>Account</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr>
                  <td colSpan={7} className="empty">
                    Loading postings…
                  </td>
                </tr>
              ) : history && history.items.length > 0 ? (
                history.items.map((row) => (
                  <tr key={row.historyId}>
                    <td>
                      {typeof row.docDate === 'string'
                        ? row.docDate.slice(0, 10)
                        : new Date(row.docDate).toISOString().slice(0, 10)}
                    </td>
                    <td className="primary-cell">
                      <b>{row.docNo}</b>
                      {row.refNo ? (
                        <small
                          style={{ display: 'block', color: 'inherit', opacity: 0.65 }}
                        >
                          ref {row.refNo}
                        </small>
                      ) : null}
                    </td>
                    <td>
                      <span className="status draft">{row.docType}</span>
                    </td>
                    <td>
                      <b>{row.accountCode}</b> {row.accountName}
                    </td>
                    <td>{toCents(row.debitAmount) ? money(row.debitAmount) : '—'}</td>
                    <td>{toCents(row.creditAmount) ? money(row.creditAmount) : '—'}</td>
                    <td>{row.remarks || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="empty">
                    No postings found for this company yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {history && history.totalPages > 1 && (
          <div className="table-footer">
            <span>
              Showing page {history.page} of {history.totalPages}
            </span>
            <div className="pagination-controls">
              <button
                className="btn btn-light"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of {history.totalPages}
              </span>
              <button
                className="btn btn-light"
                disabled={page >= history.totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
