import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Trash2, X } from 'lucide-react';

import './App.css';
import {
  applyBrowserBranding,
  brandingUpdateEvent,
  brandingUpdateKey,
  companyTheme,
} from './company-theme';
import { API_PREFIX } from './api-url';
import { api } from './api/client';
import { paginatedEndpoints, pages } from './config/pages';
import { storageKeys } from './config/storage';
import { singular } from './lib/format';
import { menuCodeToPageKey } from './types';
import type { Company, MenuItem, PageKey, Session } from './types';

import { Login } from './components/auth/Login';
import { AppHeader } from './components/layout/AppHeader';
import { SlideMenu } from './components/layout/SlideMenu';
import { Dashboard } from './components/dashboard/Dashboard';
import { RecordsView } from './components/records/RecordsView';
import { CreateDialog } from './components/common/CreateDialog';
import { FinancialReportsView } from './components/reports/FinancialReportsView';
import { LedgerCaptureView } from './components/ledger/LedgerCaptureView';
import { BankReconciliationView } from './components/banking/BankReconciliationView';
import {
  AdministrationAudit,
  CompanyAdministration,
  RoleAdministration,
  UserAdministration,
} from './components/administration';

const tokenKey = storageKeys.token;
const userKey = storageKeys.user;
const menusKey = storageKeys.menus;
const collapsedKey = storageKeys.sidebarCollapsed;

type ListPage = {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

function App() {
  const [session, setSession] = useState<Session | null>(() => {
    const accessToken = localStorage.getItem(tokenKey);
    const raw = localStorage.getItem(userKey);
    const cachedMenus = localStorage.getItem(menusKey);
    return accessToken && raw
      ? {
          accessToken,
          user: JSON.parse(raw),
          menus: cachedMenus ? JSON.parse(cachedMenus) : [],
        }
      : null;
  });

  // Database-fetched menus
  const [dbMenus, setDbMenus] = useState<MenuItem[]>(() => {
    const cached = localStorage.getItem(menusKey);
    return cached ? JSON.parse(cached) : [];
  });

  // Slide menu states: mobile drawer vs desktop collapse
  const [slideMenuOpen, setSlideMenuOpen] = useState(false);
  const [slideMenuCollapsed, setSlideMenuCollapsed] = useState<boolean>(() => {
    return localStorage.getItem(collapsedKey) === 'true';
  });

  const [active, setActive] = useState<PageKey>('dashboard');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [listPagination, setListPagination] = useState({ scope: '', number: 1 });
  const [pageSize, setPageSize] = useState(25);
  const [listTotal, setListTotal] = useState(0);
  const [listTotalPages, setListTotalPages] = useState(0);

  const page = pages[active];
  const isScoped = page.scoped !== false;
  const isPaginated = paginatedEndpoints.has(page.endpoint ?? '');
  const listSearch = isPaginated ? search : '';
  const listScope = JSON.stringify([active, companyId, listSearch, pageSize]);
  const listPageNumber =
    listPagination.scope === listScope ? listPagination.number : 1;
  const company = companies.find((item) => item.companyId === companyId);
  const menuAccess = dbMenus.find((item) => item.menuCode === page.menuCode);
  const canEdit = !!menuAccess?.canEdit;
  const canDelete = !!menuAccess?.canDelete;
  const deleteLabel = deleteTarget
    ? String(
        deleteTarget.description ??
          deleteTarget.mainCode ??
          deleteTarget.code ??
          '',
      )
    : '';
  const browserBrand = useMemo(
    () => ({ companyName: company?.companyName, logoData: company?.logoData }),
    [company?.companyName, company?.logoData],
  );

  useEffect(() => {
    applyBrowserBranding(browserBrand);
  }, [browserBrand]);

  useEffect(() => {
    setListPagination({ scope: listScope, number: 1 });
  }, [listScope]);

  // Fetch menus directly from the database!
  const fetchMenusFromDb = useCallback(async (token?: string) => {
    try {
      let data: MenuItem[] = [];
      if (token) {
        try {
          data = await api<MenuItem[]>('auth/menus', token);
        } catch {
          data = [];
          setDbMenus([]);
        }
      } else {
        data = await api<MenuItem[]>('auth/menus/public');
      }

      if (Array.isArray(data)) {
        setDbMenus(data);
        if (token)
          setActive((current) =>
            data.some((menu) => menuCodeToPageKey[menu.menuCode] === current)
              ? current
              : (menuCodeToPageKey[data[0]?.menuCode] ?? 'dashboard'),
          );
        localStorage.setItem(menusKey, JSON.stringify(data));
        setSession((prev) => (prev ? { ...prev, menus: data } : null));
      }
    } catch (err) {
      console.warn('Unable to load menus from DB:', err);
    }
  }, []);

  // Initial menu fetch from DB on load or session change
  useEffect(() => {
    fetchMenusFromDb(session?.accessToken);
  }, [fetchMenusFromDb, session?.accessToken]);

  const [companyRefresh, setCompanyRefresh] = useState(0);
  useEffect(() => {
    if (!session?.accessToken) return;
    const token = session.accessToken;
    api<Session['user']>('auth/me', token)
      .then((user) => {
        if (user.isPlatformAdmin)
          throw new Error('Use the platform application to sign in.');
        localStorage.setItem(userKey, JSON.stringify(user));
        setSession((prev) =>
          prev?.accessToken === token ? { ...prev, user } : prev,
        );
      })
      .catch(() => {
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(userKey);
        localStorage.removeItem(menusKey);
        setSession(null);
        setDbMenus([]);
      });
  }, [session?.accessToken]);

  // Refresh branding after saves in either app and when this workspace regains focus.
  useEffect(() => {
    if (!session?.accessToken) return;
    const token = session.accessToken,
      preferredCompanyId = session.user.companyId;
    let live = true;
    let latest = 0;
    const loadCompanies = async () => {
      const request = ++latest;
      try {
        const list = await api<Company[]>('companies', token);
        if (!live || request !== latest) return;
        setCompanies(list);
        setCompanyId((current) =>
          list.some((c) => c.companyId === current)
            ? current
            : list.some((c) => c.companyId === preferredCompanyId)
              ? preferredCompanyId!
              : (list[0]?.companyId ?? ''),
        );
      } catch (reason) {
        if (live && request === latest) setError((reason as Error).message);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void loadCompanies();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === brandingUpdateKey) void loadCompanies();
    };
    void loadCompanies();
    window.addEventListener('focus', loadCompanies);
    window.addEventListener(brandingUpdateEvent, loadCompanies);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      live = false;
      window.removeEventListener('focus', loadCompanies);
      window.removeEventListener(brandingUpdateEvent, loadCompanies);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [session?.accessToken, companyRefresh]);

  // Fetch only the requested page; cancel stale requests during navigation or search.
  useEffect(() => {
    if (
      !session ||
      [
        'dashboard',
        'companies',
        'users',
        'roles',
        'bank-reconciliation',
        'audit-logs',
        'reports',
      ].includes(active) ||
      !page.endpoint
    )
      return;

    const controller = new AbortController();
    setLoading(true);
    setError('');
    setRows([]);
    setListTotal(0);
    setListTotalPages(0);

    if (isScoped && page.endpoint !== 'companies' && !companyId) {
      setLoading(false);
      return () => controller.abort();
    }

    const params = new URLSearchParams();
    if (isScoped && page.endpoint !== 'companies') params.set('companyId', companyId);
    if (page.endpoint === 'reports/trial-balance')
      params.set('asOf', new Date().toISOString().slice(0, 10));
    if (isPaginated) {
      params.set('page', String(listPageNumber));
      params.set('limit', String(pageSize));
      if (listSearch.trim()) params.set('q', listSearch.trim());
    }

    const endpoint = page.endpoint + (params.size ? `?${params.toString()}` : '');

    const timer = window.setTimeout(() => {
      api<Record<string, unknown>[] | ListPage>(endpoint, session.accessToken, {
        signal: controller.signal,
      })
        .then((data) => {
          if (controller.signal.aborted) return;
          if (Array.isArray(data)) {
            setRows(data);
            return;
          }
          if (
            isPaginated &&
            data.totalPages > 0 &&
            listPageNumber > data.totalPages
          ) {
            setListPagination({ scope: listScope, number: data.totalPages });
            return;
          }
          setRows(data.items);
          setListTotal(data.total);
          setListTotalPages(data.totalPages);
        })
        .catch((reason) => {
          if (!controller.signal.aborted) setError(reason.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, isPaginated && listSearch ? 250 : 0);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    session,
    active,
    companyId,
    refresh,
    page.endpoint,
    isScoped,
    isPaginated,
    listPageNumber,
    pageSize,
    listSearch,
    listScope,
  ]);

  function toggleCollapse() {
    setSlideMenuCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(collapsedKey, String(next));
      return next;
    });
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const loginUrl = `${API_PREFIX}/auth/company/login`;
    console.log('Company login API URL:', loginUrl);
    try {
      const result = await api<Session>('auth/company/login', undefined, {
        method: 'POST',
        body: JSON.stringify({
          identifier: data.get('identifier'),
          password: data.get('password'),
        }),
      });
      localStorage.setItem(tokenKey, result.accessToken);
      localStorage.setItem(userKey, JSON.stringify(result.user));
      localStorage.setItem(menusKey, JSON.stringify(result.menus || []));
      setSession(result);
      setDbMenus(result.menus ?? []);
      setActive(menuCodeToPageKey[result.menus?.[0]?.menuCode] ?? 'dashboard');
    } catch (reason) {
      console.error('Company login connection error:', loginUrl, reason);
      setError(reason instanceof Error ? reason.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(
    identifier: string,
    newPassword: string,
  ): Promise<string> {
    setBusy(true);
    try {
      await api('auth/company/forgot-password', undefined, {
        method: 'POST',
        body: JSON.stringify({ identifier, newPassword }),
      });
      return '';
    } catch (reason) {
      return reason instanceof Error
        ? reason.message
        : 'We could not reset that password.';
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    localStorage.removeItem(menusKey);
    setSession(null);
    setRows([]);
    setCompanies([]);
    setCompanyId('');
    setDbMenus([]);
  }

  async function createRecord(payload: Record<string, unknown>) {
    if (!session || !page.endpoint) return;
    setError('');
    try {
      await api(page.endpoint, session.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          ...(active === 'companies' || !isScoped ? {} : { companyId }),
        }),
      });
      setDialog(false);
      setRefresh((value) => value + 1);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to save record',
      );
    }
  }

  async function updateRecord(payload: Record<string, unknown>) {
    if (!session || !page.endpoint || !page.idField || !editing) return;
    const id = editing[page.idField];
    if (typeof id !== 'string') return;
    setError('');
    try {
      await api(`${page.endpoint}/${id}`, session.accessToken, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setEditing(null);
      setRefresh((value) => value + 1);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to update record',
      );
    }
  }

  async function deleteRecord() {
    if (!session || !page.endpoint || !page.idField || !deleteTarget) return;
    const id = deleteTarget[page.idField];
    if (typeof id !== 'string') return;
    setBusy(true);
    setError('');
    setDeleteTarget(null);
    try {
      await api(`${page.endpoint}/${id}`, session.accessToken, {
        method: 'DELETE',
      });
      setRefresh((value) => value + 1);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to delete record',
      );
    } finally {
      setBusy(false);
    }
  }

  async function downloadRowPdf(row: Record<string, unknown>) {
    if (!session || !page.endpoint || !page.pdfDownload) return;
    const id = row[page.pdfDownload.idField];
    if (typeof id !== 'string') return;
    setPdfBusyId(id);
    setError('');
    try {
      const response = await fetch(`${API_PREFIX}/${page.endpoint}/${id}/pdf`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = Array.isArray(body?.message)
          ? body.message.join(', ')
          : body?.message;
        throw new Error(message || `Download failed (${response.status})`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const filename =
        /filename="([^"]+)"/.exec(disposition)?.[1] ??
        `${String(row.invoiceNumber ?? 'invoice')}.pdf`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to download invoice',
      );
    } finally {
      setPdfBusyId('');
    }
  }

  if (!session)
    return (
      <Login
        onSubmit={login}
        onReset={resetPassword}
        busy={busy}
        error={error}
      />
    );

  return (
    <div
      style={companyTheme(company)}
      className={`app-frame ${slideMenuCollapsed ? 'slide-collapsed' : ''}`}
    >
      <SlideMenu
        company={company}
        menus={dbMenus}
        activePage={active}
        onNavigate={(key) => {
          setActive(key);
          setSearch('');
          setError('');
          setEditing(null);
          setDeleteTarget(null);
        }}
        collapsed={slideMenuCollapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={slideMenuOpen}
        onCloseMobile={() => setSlideMenuOpen(false)}
        user={session.user}
        onLogout={logout}
      />

      <main className="main">
        <AppHeader
          pageTitle={page.title}
          companies={companies}
          companyId={companyId}
          canSwitchCompany={!!session.user.isPlatformAdmin}
          user={session.user}
          onOpenMenu={() => setSlideMenuOpen(true)}
          onCompanyChange={setCompanyId}
        />

        <div className="content">
          {active === 'dashboard' ? (
            <Dashboard
              companies={companies}
              companyId={companyId}
              token={session.accessToken}
              onNavigate={setActive}
              onOpenCreate={(key) => {
                setActive(key);
                setDialog(true);
              }}
            />
          ) : active === 'companies' ? (
            <CompanyAdministration
              key={companyId}
              token={session.accessToken}
              companyId={companyId}
              platform={false}
              onChanged={() => setCompanyRefresh((n) => n + 1)}
              onSelect={setCompanyId}
            />
          ) : active === 'users' ? (
            <UserAdministration
              key={companyId}
              token={session.accessToken}
              companyId={companyId}
            />
          ) : active === 'roles' ? (
            <RoleAdministration
              token={session.accessToken}
              companyId={companyId}
            />
          ) : active === 'bank-reconciliation' ? (
            <BankReconciliationView
              token={session.accessToken}
              companyId={companyId}
            />
          ) : active === 'audit-logs' ? (
            <AdministrationAudit
              token={session.accessToken}
              companyId={companyId}
            />
          ) : active === 'reports' ? (
            <FinancialReportsView
              key={companyId}
              token={session.accessToken}
              companyId={companyId}
            />
          ) : active === 'ledger' ? (
            <LedgerCaptureView
              key={companyId}
              token={session.accessToken}
              companyId={companyId}
            />
          ) : (
            <RecordsView
              page={page}
              companyName={company?.companyName}
              rows={rows}
              loading={loading}
              error={error}
              search={search}
              isPaginated={isPaginated}
              pageSize={pageSize}
              listPageNumber={listPageNumber}
              listTotal={listTotal}
              listTotalPages={listTotalPages}
              pdfBusyId={pdfBusyId}
              canEdit={canEdit}
              canDelete={canDelete}
              onSearch={setSearch}
              onRefresh={() => setRefresh((value) => value + 1)}
              onCreate={() => setDialog(true)}
              onEdit={(row) => {
                setError('');
                setEditing(row);
              }}
              onDelete={(row) => {
                setError('');
                setDeleteTarget(row);
              }}
              onDismissError={() => setError('')}
              onPageSizeChange={setPageSize}
              onPageChange={(number) =>
                setListPagination({ scope: listScope, number })
              }
              onDownloadPdf={(row) => void downloadRowPdf(row)}
            />
          )}
        </div>
      </main>

      {dialog && page.fields && (
        <CreateDialog
          title={page.title}
          fields={page.fields}
          note={page.createNote}
          token={session.accessToken}
          companyId={companyId}
          onClose={() => setDialog(false)}
          onSubmit={createRecord}
        />
      )}

      {editing && page.fields && page.editFields && (
        <CreateDialog
          title={page.title}
          fields={page.fields.filter((field) =>
            page.editFields!.includes(field.name),
          )}
          token={session.accessToken}
          companyId={companyId}
          initialValues={editing}
          mode="edit"
          onClose={() => setEditing(null)}
          onSubmit={updateRecord}
        />
      )}

      {deleteTarget && (
        <div
          className="modal-bg"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDeleteTarget(null);
          }}
        >
          <section
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-record-title"
          >
            <div className="modal-head">
              <div>
                <small className="eyebrow">DELETE RECORD</small>
                <h2 id="delete-record-title">
                  {`Delete ${
                    deleteLabel || `this ${singular(page.title).toLowerCase()}`
                  }?`}
                </h2>
                <p className="modal-note">
                  This cannot be undone. Records that are still referenced by
                  other entries cannot be deleted.
                </p>
              </div>
              <button
                className="row-open"
                onClick={() => setDeleteTarget(null)}
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-light"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                disabled={busy}
                onClick={() => void deleteRecord()}
              >
                <Trash2 size={15} />
                Delete record
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
