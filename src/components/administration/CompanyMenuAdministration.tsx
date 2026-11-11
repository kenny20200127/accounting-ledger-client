import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { fetchApi } from './api';
import type { AdministrationProps, CompanyMenu } from './types';

type CompanyMenuProps = Pick<AdministrationProps, 'token' | 'companyId'>;

export function CompanyMenuAdministration(props: CompanyMenuProps) {
  // Discard drafts and feedback synchronously when either request identity changes.
  return (
    <CompanyMenuEditor
      key={JSON.stringify([props.companyId, props.token])}
      {...props}
    />
  );
}

function CompanyMenuEditor({ token, companyId }: CompanyMenuProps) {
  const [menus, setMenus] = useState<CompanyMenu[]>([]);
  const [savedMenus, setSavedMenus] = useState<CompanyMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const requestRef = useRef<{ active: boolean; saving: boolean } | null>(null);
  const path = 'platform/companies/' + encodeURIComponent(companyId) + '/menus';

  useEffect(() => {
    const request = { active: true, saving: false };
    requestRef.current = request;
    setLoading(true);
    setSaving(false);
    setLoadError('');
    setSaveError('');
    setMessage('');
    setMenus([]);
    setSavedMenus([]);

    fetchApi<CompanyMenu[]>(path, token)
      .then((rows) => {
        if (!request.active) return;
        setMenus(rows);
        setSavedMenus(rows);
      })
      .catch((reason: unknown) => {
        if (request.active)
          setLoadError(
            reason instanceof Error ? reason.message : 'Unable to load company menus.',
          );
      })
      .finally(() => {
        if (request.active) setLoading(false);
      });

    return () => {
      request.active = false;
    };
  }, [path, token, retry]);

  const savedById = new Map(savedMenus.map((menu) => [menu.menuId, menu.isEnabled]));
  const changes = menus
    .filter((menu) => savedById.get(menu.menuId) !== menu.isEnabled)
    .map((menu) => ({ menuId: menu.menuId, isEnabled: menu.isEnabled }));
  const disabled = loading || saving || !!loadError;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const request = requestRef.current;
    if (!request?.active || request.saving || disabled || !changes.length) return;

    request.saving = true;
    setSaving(true);
    setSaveError('');
    setMessage('');
    try {
      const rows = await fetchApi<CompanyMenu[]>(
        path,
        token,
        { menus: changes },
        'PATCH',
      );
      if (!request.active) return;
      setMenus(rows);
      setSavedMenus(rows);
      setMessage('Company menu settings saved. Changes apply to all company users.');
    } catch (reason) {
      if (request.active)
        setSaveError(
          reason instanceof Error ? reason.message : 'Unable to save company menus.',
        );
    } finally {
      request.saving = false;
      if (request.active) setSaving(false);
    }
  }

  return (
    <section className="admin-view">
      <div className="page-heading">
        <div>
          <h1>Company Menus</h1>
          <p>Choose which functionality is enabled for the selected company.</p>
        </div>
      </div>
      <p>
        Disabling a menu blocks its functionality company-wide, including for
        company administrators. Role grants are retained and apply again when the
        menu is reenabled. Menus without a saved setting are enabled by default.
        Changes take effect only when you save.
      </p>
      {loadError && (
        <div className="error-banner" role="alert">
          <p>Could not load company menus: {loadError}</p>
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => {
              setLoading(true);
              setRetry((value) => value + 1);
            }}
          >
            Retry loading
          </button>
        </div>
      )}
      {saveError && (
        <div className="error-banner" role="alert">
          Could not save company menus: {saveError} Your changes have been kept;
          use Save changes to retry.
        </div>
      )}
      {message && (
        <p className="admin-notice" role="status">
          {message}
        </p>
      )}
      <form className="admin-card" onSubmit={save} aria-busy={loading || saving}>
        {loading ? (
          <p role="status">Loading company menus...</p>
        ) : !loadError && !menus.length ? (
          <p>No active company menus are available.</p>
        ) : !loadError ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Menu</th>
                  <th scope="col">Code</th>
                  <th scope="col">Availability</th>
                </tr>
              </thead>
              <tbody>
                {menus.map((menu) => (
                  <tr key={menu.menuId}>
                    <td>{menu.menuName}</td>
                    <td>{menu.menuCode}</td>
                    <td>
                      <label className="admin-check">
                        <input
                          type="checkbox"
                          aria-label={'Enable ' + menu.menuName}
                          checked={menu.isEnabled}
                          disabled={disabled}
                          onChange={(event) => {
                            const isEnabled = event.target.checked;
                            setMenus((rows) =>
                              rows.map((row) =>
                                row.menuId === menu.menuId ? { ...row, isEnabled } : row,
                              ),
                            );
                            setMessage('');
                            setSaveError('');
                          }}
                        />
                        {menu.isEnabled ? 'Enabled' : 'Disabled'}
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <button className="primary" type="submit" disabled={disabled || !changes.length}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </section>
  );
}
