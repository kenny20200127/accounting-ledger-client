import { API_PREFIX } from '../../api-url';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Banknote,
  FileText,
  Landmark,
  RefreshCw,
  Wallet,
  Users,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import { menuCodeToPageKey } from '../../types';
import type { Company, MenuItem, PageKey } from '../../types';
import { formatDate, formatMoney } from '../../lib/format';

type LedgerPeriod = { transactions: number; posted: string };

type LedgerStats = {
  asOf: string;
  today: LedgerPeriod;
  week: LedgerPeriod;
  month: LedgerPeriod;
  year: LedgerPeriod;
};

const ledgerPeriods = [
  { key: 'today', label: 'Transactions today', icon: Clock },
  { key: 'week', label: 'Transactions this week', icon: CalendarDays },
  { key: 'month', label: 'Transactions this month', icon: CalendarRange },
  { key: 'year', label: 'Transactions this year', icon: CalendarCheck },
] as const;

interface DashboardProps {
  companies: Company[];
  menus: MenuItem[];
  companyId: string;
  token: string;
  onNavigate: (key: PageKey) => void;
  onOpenCreate?: (pageKey: PageKey) => void;
}

export function Dashboard({
  companies,
  menus,
  companyId,
  token,
  onNavigate,
  onOpenCreate,
}: DashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ledgerStats, setLedgerStats] = useState<LedgerStats | null>(null);
  const [activeTab, setActiveTab] = useState<'invoices' | 'expenses' | 'banking'>('invoices');
  const [refreshCount, setRefreshCount] = useState(0);

  const allowedPages = useMemo(() => new Set<PageKey>(
    menus
      .filter((menu) => menu.canView !== false)
      .map((menu) => menuCodeToPageKey[menu.menuCode])
      .filter((page): page is PageKey => Boolean(page)),
  ), [menus]);
  const canCreateInvoice = menus.some((menu) =>
    menuCodeToPageKey[menu.menuCode] === 'invoices' &&
    menu.canView !== false && menu.canCreate === true,
  );
  const activityTab = allowedPages.has(activeTab)
    ? activeTab
    : allowedPages.has('invoices')
      ? 'invoices'
      : allowedPages.has('expenses')
        ? 'expenses'
        : allowedPages.has('banking')
          ? 'banking'
          : null;
  const hasLedgerStats = allowedPages.has('ledger');
  const showCustomerStrength = allowedPages.has('customers');
  const hasKpis = hasLedgerStats || showCustomerStrength;
  const hasShortcuts = hasKpis || allowedPages.has('journals') || allowedPages.has('reports');
  const hasFiscalStatus = allowedPages.has('fiscal-years') ||
    allowedPages.has('accounting-periods') || allowedPages.has('ledger');

  // Raw data from endpoints
  const [invoices, setInvoices] = useState<Record<string, unknown>[]>([]);
  const [expenses, setExpenses] = useState<Record<string, unknown>[]>([]);
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Record<string, unknown>[]>([]);
  const [fiscalYears, setFiscalYears] = useState<Record<string, unknown>[]>([]);
  const [periods, setPeriods] = useState<Record<string, unknown>[]>([]);

  const company = companies.find((c) => c.companyId === companyId);
  const currency = company?.baseCurrency || 'NGN';

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setError('');
    setLedgerStats(null);
    setInvoices([]);
    setExpenses([]);
    setCustomers([]);
    setBankAccounts([]);
    setFiscalYears([]);
    setPeriods([]);

    if (!companyId || !token) {
      setLoading(false);
      return () => controller.abort();
    }

    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    const loads: Promise<void>[] = [];
    const loadList = async (
      menuCode: PageKey,
      url: string,
      setData: (rows: Record<string, unknown>[]) => void,
    ) => {
      if (!allowedPages.has(menuCode)) return;
      const response = await fetch(url, { headers, signal });
      if (!response.ok) throw new Error('Failed to load dashboard metrics');
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error('Failed to load dashboard metrics');
      if (!signal.aborted) setData(data);
    };

    loads.push(
      loadList('invoices', `${API_PREFIX}/invoices?companyId=${companyId}`, setInvoices),
      loadList('expenses', `${API_PREFIX}/expenses?companyId=${companyId}`, setExpenses),
      loadList('customers', `${API_PREFIX}/customers?companyId=${companyId}`, setCustomers),
      loadList('banking', `${API_PREFIX}/banking/accounts?companyId=${companyId}`, setBankAccounts),
      loadList('fiscal-years', `${API_PREFIX}/fiscal-years?companyId=${companyId}`, setFiscalYears),
      loadList('accounting-periods', `${API_PREFIX}/accounting-periods`, setPeriods),
    );
    if (allowedPages.has('ledger'))
      loads.push(
        fetch(`${API_PREFIX}/ledger-batches/stats?companyId=${companyId}`, {
          headers,
          signal,
        }).then(async (response) => {
          if (!response.ok) throw new Error('Failed to load ledger statistics');
          const data = (await response.json()) as LedgerStats;
          if (!signal.aborted) setLedgerStats(data);
        }),
      );

    void Promise.allSettled(loads).then((results) => {
      if (signal.aborted) return;
      if (results.some((result) => result.status === 'rejected')) {
        setError('Some dashboard metrics could not be loaded.');
      }
      setLoading(false);
    });

    return () => controller.abort();
  }, [companyId, token, allowedPages, refreshCount]);

  // Calculations
  const metrics = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaidInvoices = 0;

    invoices.forEach((inv) => {
      totalInvoiced += Number(inv.totalAmount || 0);
      totalPaidInvoices += Number(inv.amountPaid || 0);
    });

    let totalExpenses = 0;
    expenses.forEach((exp) => {
      totalExpenses += Number(exp.totalAmount || exp.amount || 0);
    });

    let totalCash = 0;
    bankAccounts.forEach((ba) => {
      totalCash += Number(ba.currentBalance || 0);
    });

    const netMargin = totalInvoiced - totalExpenses;
    const marginPercent = totalInvoiced > 0 ? (netMargin / totalInvoiced) * 100 : 0;

    // Status breakdown
    const invoiceStatusCount: Record<string, number> = {
      PAID: 0,
      PARTIALLY_PAID: 0,
      SENT: 0,
      DRAFT: 0,
    };
    invoices.forEach((inv) => {
      const status = String(inv.status || 'DRAFT').toUpperCase();
      invoiceStatusCount[status] = (invoiceStatusCount[status] || 0) + 1;
    });

    return {
      totalInvoiced,
      totalPaidInvoices,
      totalExpenses,
      totalCash,
      netMargin,
      marginPercent,
      customerCount: customers.length,
      activeCustomerCount: customers.filter(
        (customer) => customer.isActive !== false,
      ).length,
      invoiceCount: invoices.length,
      invoiceStatusCount,
    };
  }, [invoices, expenses, customers, bankAccounts]);

  // Current active fiscal year & period
  const activeFiscalYear = useMemo(() => {
    return fiscalYears.find((fy) => !fy.isClosed) || fiscalYears[0];
  }, [fiscalYears]);

  const activePeriod = useMemo(() => {
    return periods.find((p) => p.isOpen && !p.isClosed) || periods[0];
  }, [periods]);

  // Dynamic greeting and date initialized once in state
  const [currentDate] = useState(() => new Date());
  const greeting =
    currentDate.getHours() < 12
      ? 'Good morning'
      : currentDate.getHours() < 17
        ? 'Good afternoon'
        : 'Good evening';

  const todayFormatted = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="dashboard-container">
      {/* Top Banner / Hero Header */}
      <div className="dashboard-hero">
        <div className="hero-text">
          <div className="hero-eyebrow">
            <span className="live-pill">● LIVE LEDGER</span>
            <span>{todayFormatted}</span>
          </div>
          <h1>
            {greeting},{' '}
            <span className="brand-accent">
              {company?.companyName ?? 'Workspace'}
            </span>
          </h1>
          <p>
            Here is your ledger activity, customer strength, and posting
            position for {company?.companyName ?? 'your active company'}.
          </p>
        </div>

        <div className="hero-controls">
          {onOpenCreate && canCreateInvoice && (
            <button
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: 12.5 }}
              onClick={() => onOpenCreate('invoices')}
            >
              <FileText size={14} /> New Invoice
            </button>
          )}

          <button
            className="btn btn-light refresh-dash-btn"
            onClick={() => setRefreshCount((value) => value + 1)}
            title="Reload metrics"
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Ledger Activity & Customer Strength */}
      {hasKpis && <section className="kpi-grid ledger-kpis">
        {hasLedgerStats && ledgerPeriods.map(({ key, label, icon: Icon }) => {
          const period: LedgerPeriod | undefined = ledgerStats?.[key];
          return (
            <div
              key={key}
              className="kpi-card ledger"
              onClick={() => onNavigate('ledger')}
              role="button"
              tabIndex={0}
            >
              <div className="kpi-top">
                <span className="kpi-icon-badge">
                  <Icon size={18} />
                </span>
              </div>
              <div className="kpi-body">
                <span className="kpi-label">{label}</span>
                <h2 className="kpi-value">
                  {period ? period.transactions.toLocaleString() : '—'}
                </h2>
                <div className="kpi-foot">
                  <span>
                    Posted: <b>{period ? formatMoney(period.posted, currency) : '—'}</b>
                  </span>
                  <ArrowUpRight size={14} className="kpi-arrow" />
                </div>
              </div>
            </div>
          );
        })}

        {showCustomerStrength && <div
          className="kpi-card directory"
          onClick={() => onNavigate('customers')}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-top">
            <span className="kpi-icon-badge">
              <Users size={18} />
            </span>
            <span className="kpi-trend">
              {metrics.customerCount} total
            </span>
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Active Customers</span>
            <h2 className="kpi-value">{metrics.activeCustomerCount}</h2>
            <div className="kpi-foot">
              <span>Customer strength</span>
              <ArrowUpRight size={14} className="kpi-arrow" />
            </div>
          </div>
        </div>}
      </section>}

      {!hasLedgerStats && (
        <p className="admin-notice">
          Ledger statistics are unavailable because the Ledger menu is disabled for this company.
        </p>
      )}

      {!hasKpis && !hasShortcuts && !hasFiscalStatus && (
        <p className="admin-notice">No activity or shortcuts are available for your enabled menus.</p>
      )}

      {/* Main Interactive Grid: Financial Trend & Invoice Status Breakdown */}
      <div className="dashboard-analytics-row">
        {/* Cash Flow / Revenue vs Expenses Comparison */}
        {allowedPages.has('invoices') && allowedPages.has('expenses') && <div className="analytics-card cash-flow-card">
          <div className="card-header">
            <div>
              <span className="card-subtitle">FINANCIAL PERFORMANCE</span>
              <h3>Revenue vs Operating Spend</h3>
            </div>
            <div className="legend-pills">
              <span className="legend-item brand"><i /> Invoiced</span>
              <span className="legend-item neutral"><i /> Expenses</span>
              <span className="legend-item green"><i /> Net Profit</span>
            </div>
          </div>

          <div className="chart-preview-container">
            <div className="bar-comparison-chart">
              {/* Comparison Visual Bars */}
              <div className="chart-bar-col">
                <div className="bar-wrapper">
                  <div
                    className="bar-fill brand"
                    style={{
                      height: `${Math.min(
                        100,
                        Math.max(
                          20,
                          (metrics.totalInvoiced /
                            Math.max(1, metrics.totalInvoiced + metrics.totalExpenses)) *
                          100 *
                          1.4,
                        ),
                      )}%`,
                    }}
                  >
                    <span className="bar-tooltip">
                      {formatMoney(metrics.totalInvoiced, currency)}
                    </span>
                  </div>
                </div>
                <span className="bar-title">Gross Revenue</span>
                <span className="bar-sub">{formatMoney(metrics.totalInvoiced, currency)}</span>
              </div>

              <div className="chart-bar-col">
                <div className="bar-wrapper">
                  <div
                    className="bar-fill neutral"
                    style={{
                      height: `${Math.min(
                        100,
                        Math.max(
                          15,
                          (metrics.totalExpenses /
                            Math.max(1, metrics.totalInvoiced + metrics.totalExpenses)) *
                          100 *
                          1.4,
                        ),
                      )}%`,
                    }}
                  >
                    <span className="bar-tooltip">
                      {formatMoney(metrics.totalExpenses, currency)}
                    </span>
                  </div>
                </div>
                <span className="bar-title">Expenses</span>
                <span className="bar-sub">{formatMoney(metrics.totalExpenses, currency)}</span>
              </div>

              <div className="chart-bar-col">
                <div className="bar-wrapper">
                  <div
                    className={`bar-fill ${metrics.netMargin >= 0 ? 'green' : 'red'}`}
                    style={{
                      height: `${Math.min(
                        100,
                        Math.max(
                          12,
                          (Math.abs(metrics.netMargin) /
                            Math.max(1, metrics.totalInvoiced)) *
                          100,
                        ),
                      )}%`,
                    }}
                  >
                    <span className="bar-tooltip">
                      {formatMoney(metrics.netMargin, currency)}
                    </span>
                  </div>
                </div>
                <span className="bar-title">Net Margin</span>
                <span className="bar-sub">{formatMoney(metrics.netMargin, currency)}</span>
              </div>
            </div>

            <div className="chart-footer-metrics">
              <div className="cf-metric">
                <small>Gross Margin Rate</small>
                <b>{metrics.marginPercent.toFixed(1)}%</b>
              </div>
              <div className="cf-metric">
                <small>Collection Ratio</small>
                <b>
                  {metrics.totalInvoiced > 0
                    ? ((metrics.totalPaidInvoices / metrics.totalInvoiced) * 100).toFixed(0)
                    : 0}
                  %
                </b>
              </div>
              {allowedPages.has('banking') && <div className="cf-metric">
                <small>Cash Reserves</small>
                <b>{formatMoney(metrics.totalCash, currency)}</b>
              </div>}
            </div>
          </div>
        </div>}

        {/* Invoice Pipeline & Status Distribution */}
        {allowedPages.has('invoices') && <div className="analytics-card status-card">
          <div className="card-header">
            <div>
              <span className="card-subtitle">RECEIVABLES AGING</span>
              <h3>Invoice Pipeline</h3>
            </div>
            <button
              className="text-btn"
              onClick={() => onNavigate('invoices')}
            >
              View all <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="status-progress-track">
            {metrics.invoiceCount > 0 ? (
              <>
                <div
                  className="track-segment paid"
                  style={{
                    width: `${((metrics.invoiceStatusCount.PAID || 0) / metrics.invoiceCount) * 100}%`,
                  }}
                  title={`Paid: ${metrics.invoiceStatusCount.PAID || 0}`}
                />
                <div
                  className="track-segment partial"
                  style={{
                    width: `${((metrics.invoiceStatusCount.PARTIALLY_PAID || 0) / metrics.invoiceCount) * 100}%`,
                  }}
                  title={`Partially Paid: ${metrics.invoiceStatusCount.PARTIALLY_PAID || 0}`}
                />
                <div
                  className="track-segment sent"
                  style={{
                    width: `${((metrics.invoiceStatusCount.SENT || 0) / metrics.invoiceCount) * 100}%`,
                  }}
                  title={`Sent: ${metrics.invoiceStatusCount.SENT || 0}`}
                />
                <div
                  className="track-segment draft"
                  style={{
                    width: `${((metrics.invoiceStatusCount.DRAFT || 0) / metrics.invoiceCount) * 100}%`,
                  }}
                  title={`Draft: ${metrics.invoiceStatusCount.DRAFT || 0}`}
                />
              </>
            ) : (
              <div className="track-segment empty-track" style={{ width: '100%' }} />
            )}
          </div>

          <div className="status-breakdown-list">
            <div className="status-item">
              <span className="status-dot paid" />
              <div className="status-meta">
                <b>Paid in Full</b>
                <small>{metrics.invoiceStatusCount.PAID || 0} invoices</small>
              </div>
              <span className="status paid">PAID</span>
            </div>

            <div className="status-item">
              <span className="status-dot partial" />
              <div className="status-meta">
                <b>Partially Paid</b>
                <small>{metrics.invoiceStatusCount.PARTIALLY_PAID || 0} invoices</small>
              </div>
              <span className="status partial">PARTIAL</span>
            </div>

            <div className="status-item">
              <span className="status-dot sent" />
              <div className="status-meta">
                <b>Awaiting Payment (Sent)</b>
                <small>{metrics.invoiceStatusCount.SENT || 0} invoices</small>
              </div>
              <span className="status sent">SENT</span>
            </div>

            <div className="status-item">
              <span className="status-dot draft" />
              <div className="status-meta">
                <b>Draft Invoices</b>
                <small>{metrics.invoiceStatusCount.DRAFT || 0} invoices</small>
              </div>
              <span className="status draft">DRAFT</span>
            </div>
          </div>
        </div>}
      </div>

      {/* Secondary Row: Quick Actions, Recent Activity Tabs & Financial Status */}
      <div className="dashboard-grid-two">
        {/* Activity Center (Tabs for Invoices, Expenses, Banking) */}
        {activityTab && <div className="table-panel activity-center">
          <div className="activity-tabs-header">
            <div className="tabs-list">
              {allowedPages.has('invoices') && <button
                className={`tab-btn ${activityTab === 'invoices' ? 'active' : ''}`}
                onClick={() => setActiveTab('invoices')}
              >
                <FileText size={15} />
                <span>Recent Invoices ({invoices.length})</span>
              </button>}
              {allowedPages.has('expenses') && <button
                className={`tab-btn ${activityTab === 'expenses' ? 'active' : ''}`}
                onClick={() => setActiveTab('expenses')}
              >
                <Wallet size={15} />
                <span>Expenses ({expenses.length})</span>
              </button>}
              {allowedPages.has('banking') && <button
                className={`tab-btn ${activityTab === 'banking' ? 'active' : ''}`}
                onClick={() => setActiveTab('banking')}
              >
                <Landmark size={15} />
                <span>Bank Accounts ({bankAccounts.length})</span>
              </button>}
            </div>

            <button
              className="text-btn view-more-btn"
              onClick={() => onNavigate(activityTab === 'invoices' ? 'invoices' : activityTab === 'expenses' ? 'expenses' : 'banking')}
            >
              Full list <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="table-scroll activity-table">
            {activityTab === 'invoices' && (
              <table>
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Due Date</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Balance Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length > 0 ? (
                    invoices.slice(0, 5).map((row, index) => (
                      <tr key={String(row.invoiceId || index)}>
                        <td className="primary-cell">
                          <b>{String(row.invoiceNumber || '—')}</b>
                        </td>
                        <td>{formatDate(row.dueDate)}</td>
                        <td><b>{formatMoney(row.totalAmount, currency)}</b></td>
                        <td className="text-muted">{formatMoney(row.amountPaid, currency)}</td>
                        <td>
                          <span className={Number(row.balanceDue || 0) > 0 ? 'text-amber' : 'text-muted'}>
                            {formatMoney(row.balanceDue, currency)}
                          </span>
                        </td>
                        <td>
                          <span className={`status ${String(row.status || 'draft').toLowerCase()}`}>
                            {String(row.status || 'DRAFT').replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="empty-inline">
                        No sales invoices created yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activityTab === 'expenses' && (
              <table>
                <thead>
                  <tr>
                    <th>Expense #</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length > 0 ? (
                    expenses.slice(0, 5).map((row, index) => (
                      <tr key={String(row.expenseId || index)}>
                        <td className="primary-cell">
                          <b>{String(row.expenseNumber || '—')}</b>
                        </td>
                        <td>{formatDate(row.expenseDate)}</td>
                        <td>{String(row.description || 'General expense')}</td>
                        <td><b>{formatMoney(row.totalAmount || row.amount, currency)}</b></td>
                        <td>
                          <span className={`status ${String(row.status || 'draft').toLowerCase()}`}>
                            {String(row.status || 'DRAFT')}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="empty-inline">
                        No operational expenses recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activityTab === 'banking' && (
              <table>
                <thead>
                  <tr>
                    <th>Bank Name</th>
                    <th>Account Name</th>
                    <th>Account #</th>
                    <th>Currency</th>
                    <th>Current Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {bankAccounts.length > 0 ? (
                    bankAccounts.slice(0, 5).map((row, index) => (
                      <tr key={String(row.bankAccountId || index)}>
                        <td className="primary-cell">
                          <b>{String(row.bankName || '—')}</b>
                        </td>
                        <td>{String(row.accountName || '—')}</td>
                        <td>{String(row.accountNumber || '—')}</td>
                        <td><span className="currency-badge">{String(row.currency || currency)}</span></td>
                        <td>
                          <b className="text-forest">
                            {formatMoney(row.currentBalance, String(row.currency || currency))}
                          </b>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="empty-inline">
                        No company bank accounts configured yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>}

        {/* Right Column: Quick Workflows & Fiscal Year Status */}
        <div className="right-dashboard-col">
          {/* Fiscal Status Card */}
          {hasFiscalStatus && <div className="fiscal-health-card">
            <div className="fh-header">
              <span className="card-subtitle">POSTING STATUS</span>
              <h4>Fiscal Period & Ledger</h4>
            </div>
            <div className="fh-content">
              {allowedPages.has('fiscal-years') && <div className="fh-row">
                <span className="fh-label">Fiscal Year:</span>
                <span className="fh-value">
                  <b>{activeFiscalYear ? String(activeFiscalYear.yearName) : 'FY 2026'}</b>
                  <span className="pill">Active</span>
                </span>
              </div>}
              {allowedPages.has('accounting-periods') && <div className="fh-row">
                <span className="fh-label">Open Period:</span>
                <span className="fh-value">
                  <b>{activePeriod ? String(activePeriod.periodName) : 'October 2026'}</b>
                  <span className="pill">Posting Open</span>
                </span>
              </div>}
              {allowedPages.has('ledger') && <div className="fh-row">
                <span className="fh-label">Ledger State:</span>
                <span className="fh-value">
                  <CheckCircle2 size={14} className="text-forest" /> Balanced Debits/Credits
                </span>
              </div>}
            </div>
          </div>}

          {/* Quick Actions Shortcuts */}
          {hasShortcuts && <div className="quick-shortcuts-panel">
            <div className="qs-header">
              <span className="card-subtitle">WORKFLOW SHORTCUTS</span>
              <h4>Quick Actions</h4>
            </div>
            <div className="shortcuts-grid">
              {([
                ['invoices', 'Invoices', FileText],
                ['expenses', 'Expenses', Wallet],
                ['customers', 'Customers', Users],
                ['journals', 'Journals', BookOpen],
                ['banking', 'Banking', Landmark],
                ['reports', 'Reports', Banknote],
              ] as const).filter(([key]) => allowedPages.has(key)).map(([key, label, Icon]) => (
                <button key={key} className="shortcut-tile" onClick={() => onNavigate(key)}>
                  <span className="shortcut-icon"><Icon size={16} /></span>
                  <span>{label}</span>
                  <ArrowUpRight size={13} className="tile-arrow" />
                </button>
              ))}
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}
