import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Lock,
  Plus,
  RefreshCw,
  Unlock,
  X,
} from 'lucide-react';
import { api } from '../../api/client';
import type { ViewProps } from '../common/types';

type FiscalYear = {
  fiscalYearId: string;
  companyId: string;
  yearName: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
};

type StatusPeriod = {
  periodId: string;
  periodNumber: number;
  periodName: string;
  startDate: string;
  endDate: string;
  isOpen: boolean;
  isClosed: boolean;
  closedAt: string | null;
  unpostedJournals: number;
  postedJournals: number;
  ledgerDocuments: number;
};

type ClosingJournal = {
  journalEntryId: string;
  journalNumber: string;
  transactionDate: string;
  referenceNumber: string | null;
  totalDebit: string;
  totalCredit: string;
  lines: number;
};

type ClosingStatus = {
  fiscalYear: FiscalYear;
  periods: StatusPeriod[];
  totals: {
    periods: number;
    openPeriods: number;
    lockedPeriods: number;
    closedPeriods: number;
    unpostedJournals: number;
    postedJournals: number;
    ledgerDocuments: number;
  };
  closingJournal: ClosingJournal | null;
  canCloseYear: boolean;
};

type EquityAccount = {
  accountId: string;
  accountCode: string;
  accountName: string;
};

type ConfirmTarget =
  | { action: 'close' | 'reopen'; scope: 'month'; period: StatusPeriod }
  | { action: 'close' | 'reopen'; scope: 'year' };

type PeriodClosingProps = ViewProps & {
  canApprovePeriods?: boolean;
  canApproveYears?: boolean;
  canCreatePeriods?: boolean;
};

export function PeriodClosingView({
  token,
  companyId,
  canApprovePeriods = false,
  canApproveYears = false,
  canCreatePeriods = false,
}: PeriodClosingProps) {
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [fiscalYearId, setFiscalYearId] = useState('');
  const [status, setStatus] = useState<ClosingStatus | null>(null);
  const [equityAccounts, setEquityAccounts] = useState<EquityAccount[]>([]);
  const [retainedEarningsAccountId, setRetainedEarningsAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    api<FiscalYear[]>(`fiscal-years?companyId=${encodeURIComponent(companyId)}`, token)
      .then((years) => {
        if (!active) return;
        setFiscalYears(years);
        const today = new Date().toISOString().slice(0, 10);
        const current = years.find((year) => year.startDate <= today && year.endDate >= today);
        setFiscalYearId((selected) =>
          selected && years.some((year) => year.fiscalYearId === selected)
            ? selected
            : current?.fiscalYearId ?? years[0]?.fiscalYearId ?? '',
        );
      })
      .catch((reason) => {
        if (active)
          setError(reason instanceof Error ? reason.message : 'Failed to load fiscal years.');
      });
    return () => {
      active = false;
    };
  }, [companyId, token, refresh]);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    api<EquityAccount[]>(
      `accounts?companyId=${encodeURIComponent(companyId)}&type=EQUITY&postable=true`,
      token,
    )
      .then((accounts) => {
        if (active) setEquityAccounts(Array.isArray(accounts) ? accounts : []);
      })
      .catch(() => {
        if (active) setEquityAccounts([]);
      });
    return () => {
      active = false;
    };
  }, [companyId, token]);

  useEffect(() => {
    if (!fiscalYearId) {
      setStatus(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    api<ClosingStatus>(
      `accounting-periods/closing-status?fiscalYearId=${encodeURIComponent(fiscalYearId)}`,
      token,
    )
      .then((data) => {
        if (active) setStatus(data);
      })
      .catch((reason) => {
        if (active)
          setError(reason instanceof Error ? reason.message : 'Failed to load closing status.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fiscalYearId, token, refresh]);

  const reload = useCallback(() => setRefresh((value) => value + 1), []);

  async function run(
    key: string,
    request: () => Promise<unknown>,
    success: string,
  ) {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await request();
      setNotice(success);
      setConfirmTarget(null);
      reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The action could not be completed.');
      setConfirmTarget(null);
    } finally {
      setBusy('');
    }
  }

  async function generateMissing() {
    if (!fiscalYearId) return;
    await run(
      'generate',
      () =>
        api<{ created: number }>('accounting-periods/generate-missing', token, {
          method: 'POST',
          body: JSON.stringify({ fiscalYearId }),
        }),
      'Missing months were generated.',
    );
  }

  async function confirmAction() {
    if (!confirmTarget || !status) return;
    if (confirmTarget.scope === 'month') {
      const period = confirmTarget.period;
      await run(
        period.periodId,
        () =>
          api(`accounting-periods/${period.periodId}/${confirmTarget.action}`, token, {
            method: 'PATCH',
          }),
        `${period.periodName} was ${confirmTarget.action === 'close' ? 'closed' : 'reopened'}.`,
      );
      return;
    }
    if (confirmTarget.action === 'close') {
      await run(
        'year-close',
        () =>
          api(`fiscal-years/${status.fiscalYear.fiscalYearId}/close`, token, {
            method: 'POST',
            body: JSON.stringify({ retainedEarningsAccountId }),
          }),
        `${status.fiscalYear.yearName} was closed and the year-end journal was posted.`,
      );
      return;
    }
    await run(
      'year-reopen',
      () =>
        api(`fiscal-years/${status.fiscalYear.fiscalYearId}/reopen`, token, {
          method: 'POST',
        }),
      `${status.fiscalYear.yearName} was reopened.`,
    );
  }

  const year = status?.fiscalYear;
  const yearClosed = year?.isClosed ?? false;
  const unposted = status?.totals.unpostedJournals ?? 0;
  const canCloseYear =
    canApproveYears &&
    !!status?.canCloseYear &&
    !!retainedEarningsAccountId &&
    !busy;

  return (
    <div className="extra-page-view">
      <div className="page-heading">
        <div>
          <small className="eyebrow">ACCOUNTING PERIODS</small>
          <h1>Month-end &amp; year-end</h1>
          <p>
            Close each posting month, then close the year to lock it and move revenue
            and expense balances into retained earnings.
          </p>
        </div>
        <div className="heading-actions">
          <label className="field" style={{ minWidth: 210 }}>
            Fiscal year
            <select
              value={fiscalYearId}
              onChange={(event) => setFiscalYearId(event.target.value)}
            >
              {fiscalYears.length === 0 && <option value="">No fiscal years</option>}
              {fiscalYears.map((item) => (
                <option key={item.fiscalYearId} value={item.fiscalYearId}>
                  {item.yearName}
                  {item.isClosed ? ' — closed' : ''}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-light" type="button" onClick={reload}>
            <RefreshCw size={14} className={loading ? 'spinning' : ''} /> Refresh
          </button>
          {canCreatePeriods && (
            <button
              className="btn btn-light"
              type="button"
              onClick={generateMissing}
              disabled={!fiscalYearId || yearClosed || busy === 'generate'}
            >
              <Plus size={14} />{' '}
              {busy === 'generate' ? 'Generating…' : 'Generate missing months'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="success-banner" role="status">
          {notice}
        </div>
      )}

      {!fiscalYearId ? (
        <section className="table-panel">
          <p className="empty">No fiscal year is configured for this company yet.</p>
        </section>
      ) : loading && !status ? (
        <section className="table-panel">
          <p className="empty">Loading closing status…</p>
        </section>
      ) : status ? (
        <>
          <section className="table-panel" aria-label="Closing summary">
            <div className="table-toolbar">
              <div className="count">
                <b>{year?.yearName}</b> · {status.totals.periods} months ·{' '}
                {status.totals.closedPeriods} closed · {status.totals.openPeriods} open
                {status.totals.lockedPeriods
                  ? ` · ${status.totals.lockedPeriods} locked`
                  : ''}
              </div>
              <div className="count">
                <span className={`status ${yearClosed ? 'paid' : 'draft'}`}>
                  {yearClosed ? 'Year closed' : 'Year open'}
                </span>{' '}
                {unposted > 0 ? (
                  <span className="status partial">{unposted} unposted</span>
                ) : (
                  <span className="status paid">No unposted journals</span>
                )}
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Posted journals</th>
                    <th>Unposted journals</th>
                    <th>Ledger documents</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {status.periods.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="empty">
                        No months exist for this fiscal year. Generate the missing months first.
                      </td>
                    </tr>
                  ) : (
                    status.periods.map((period) => (
                      <tr key={period.periodId}>
                        <td className="primary-cell">
                          <b>{period.periodName}</b>
                          <small style={{ display: 'block', opacity: 0.65 }}>
                            Period {period.periodNumber}
                          </small>
                        </td>
                        <td>{period.startDate}</td>
                        <td>{period.endDate}</td>
                        <td>{period.postedJournals}</td>
                        <td>
                          {period.unpostedJournals ? (
                            <span className="status partial">{period.unpostedJournals}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{period.ledgerDocuments}</td>
                        <td>
                          <span
                            className={`status ${
                              period.isClosed
                                ? 'paid'
                                : period.isOpen
                                  ? 'draft'
                                  : 'partial'
                            }`}
                          >
                            {period.isClosed ? 'Closed' : period.isOpen ? 'Open' : 'Locked'}
                          </span>
                        </td>
                        <td>
                          {!canApprovePeriods || yearClosed ? (
                            <span aria-hidden>—</span>
                          ) : period.isClosed ? (
                            <button
                              className="btn btn-light"
                              type="button"
                              disabled={!!busy}
                              onClick={() =>
                                setConfirmTarget({ action: 'reopen', scope: 'month', period })
                              }
                            >
                              <Unlock size={13} /> Reopen
                            </button>
                          ) : (
                            <button
                              className="btn btn-light"
                              type="button"
                              disabled={!!busy || period.unpostedJournals > 0}
                              title={
                                period.unpostedJournals > 0
                                  ? 'Post or cancel the unposted journals first.'
                                  : undefined
                              }
                              onClick={() =>
                                setConfirmTarget({ action: 'close', scope: 'month', period })
                              }
                            >
                              <Lock size={13} /> Close month
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="table-panel" aria-label="Year-end close">
            <div className="table-toolbar">
              <div className="count">
                <b>Year-end close</b>
              </div>
              {status.closingJournal && (
                <span className="status paid">
                  <CheckCircle2 size={13} /> Closing journal {status.closingJournal.referenceNumber}
                </span>
              )}
            </div>
            <div className="form-grid">
              <label className="field">
                Retained earnings account *
                <select
                  value={retainedEarningsAccountId}
                  onChange={(event) => setRetainedEarningsAccountId(event.target.value)}
                  disabled={yearClosed}
                >
                  <option value="">Select equity account</option>
                  {equityAccounts.map((account) => (
                    <option key={account.accountId} value={account.accountId}>
                      {account.accountCode} - {account.accountName}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field full" style={{ gridColumn: '1 / -1' }}>
                <p className="modal-note" style={{ margin: 0 }}>
                  Closing {year?.yearName ?? 'the year'} locks every month, posts a
                  closing journal dated {year?.endDate ?? 'year end'} that zeroes revenue
                  and expense accounts, and transfers the result to the retained
                  earnings account. Reopen the year to remove that journal and unlock
                  its months.
                </p>
              </div>
            </div>
            <div className="table-toolbar">
              <div className="count">
                {equityAccounts.length === 0 && !yearClosed
                  ? 'Create an active equity posting account before closing the year.'
                  : unposted > 0 && !yearClosed
                    ? `${unposted} unposted journal${unposted === 1 ? '' : 's'} must be posted or cancelled first.`
                    : status.closingJournal
                      ? `Closing journal ${status.closingJournal.journalNumber} · Dr ${status.closingJournal.totalDebit} · Cr ${status.closingJournal.totalCredit}`
                      : 'No closing journal has been posted for this year.'}
              </div>
              <div className="pagination-controls">
                {yearClosed ? (
                  <button
                    className="btn btn-light"
                    type="button"
                    disabled={!canApproveYears || !!busy}
                    onClick={() => setConfirmTarget({ action: 'reopen', scope: 'year' })}
                  >
                    <Unlock size={14} /> {busy === 'year-reopen' ? 'Reopening…' : 'Reopen year'}
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={!canCloseYear}
                    onClick={() => setConfirmTarget({ action: 'close', scope: 'year' })}
                  >
                    <Lock size={14} /> {busy === 'year-close' ? 'Closing…' : 'Close year'}
                  </button>
                )}
              </div>
            </div>
          </section>
        </>
      ) : null}

      {confirmTarget && (
        <div
          className="modal-bg"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setConfirmTarget(null);
          }}
        >
          <section
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="closing-confirm-title"
          >
            <div className="modal-head">
              <div>
                <small className="eyebrow">CONFIRM</small>
                <h2 id="closing-confirm-title">{confirmTitle(confirmTarget)}</h2>
                <p className="modal-note">{confirmNote(confirmTarget)}</p>
              </div>
              <button
                className="row-open"
                onClick={() => setConfirmTarget(null)}
                aria-label="Close"
                disabled={!!busy}
              >
                <X size={17} />
              </button>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-light"
                onClick={() => setConfirmTarget(null)}
                disabled={!!busy}
              >
                Cancel
              </button>
              <button
                className={confirmTarget.action === 'reopen' ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={confirmAction}
                disabled={!!busy}
              >
                {busy ? 'Working…' : confirmLabel(confirmTarget)}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function confirmTitle(target: ConfirmTarget) {
  if (target.scope === 'month')
    return `${target.action === 'close' ? 'Close' : 'Reopen'} ${target.period.periodName}?`;
  return target.action === 'close' ? 'Close the fiscal year?' : 'Reopen the fiscal year?';
}

function confirmNote(target: ConfirmTarget) {
  if (target.scope === 'month') {
    return target.action === 'close'
      ? 'The month stops accepting new postings, payments, expenses, and ledger capture for its dates until it is reopened.'
      : 'The month starts accepting postings again for its dates.';
  }
  return target.action === 'close'
    ? 'Every month in the year is locked and a year-end journal moves revenue and expense balances into retained earnings. This cannot be undone without reopening the year.'
    : 'The year-end closing journal is removed and every month in the year is reopened. Use this only to correct a close; post adjustments afterwards.';
}

function confirmLabel(target: ConfirmTarget) {
  if (target.scope === 'month') return target.action === 'close' ? 'Close month' : 'Reopen month';
  return target.action === 'close' ? 'Close year' : 'Reopen year';
}
