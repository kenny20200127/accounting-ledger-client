import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import './App.css';
import {
  applyBrowserBranding,
  brandingUpdateEvent,
  brandingUpdateKey,
  companyTheme,
} from './company-theme';
import { API_PREFIX } from './api-url';
import { api } from './api/client';
import { pages } from './config/pages';
import { storageKeys } from './config/storage';
import { menuCodeToPageKey } from './types';
import type { Company, MenuItem, PageKey, Session } from './types';

import { Login } from './components/auth/Login';
import { AppContent } from './components/layout/AppContent';
import { AppHeader } from './components/layout/AppHeader';
import { SlideMenu } from './components/layout/SlideMenu';

const tokenKey = storageKeys.token;
const userKey = storageKeys.user;
const menusKey = storageKeys.menus;
const collapsedKey = storageKeys.sidebarCollapsed;

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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [createRequest, setCreateRequest] = useState(0);

  const page = pages[active];
  const company = companies.find((item) => item.companyId === companyId);
  const browserBrand = useMemo(
    () => ({ companyName: company?.companyName, logoData: company?.logoData }),
    [company?.companyName, company?.logoData],
  );

  useEffect(() => {
    applyBrowserBranding(browserBrand);
  }, [browserBrand]);

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
    setCompanies([]);
    setCompanyId('');
    setDbMenus([]);
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
          setError('');
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
          <AppContent
            active={active}
            token={session.accessToken}
            companyId={companyId}
            companyName={company?.companyName}
            companies={companies}
            menus={dbMenus}
            error={error}
            createRequest={createRequest}
            onClearError={() => setError('')}
            onNavigate={(key) => {
              setActive(key);
              setError('');
            }}
            onOpenCreate={(key) => {
              setActive(key);
              setError('');
              setCreateRequest((value) => value + 1);
            }}
            onCompanyChanged={() => setCompanyRefresh((n) => n + 1)}
            onSelectCompany={setCompanyId}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
