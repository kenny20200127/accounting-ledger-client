import { useEffect, useState } from 'react';
import { createPortalApi } from './api';
import type { AdministrationProps, Permission, Role } from './types';

const actions = [
  'canView',
  'canCreate',
  'canEdit',
  'canDelete',
  'canApprove',
] as const;

export function RoleAdministration({
  token,
  companyId,
  platform = false,
}: AdministrationProps) {
  const api = createPortalApi(platform, companyId);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    api<Role[]>('roles?companyId=' + companyId, token)
      .then((roleRows) => {
        if (live) {
          setRoles(roleRows);
          setSelected('');
          setName('');
          if (roleRows[0])
            api<Permission[]>('roles/' + roleRows[0].roleId + '/permissions', token)
              .then(
                (permissionRows) =>
                  live &&
                  setPermissions(
                    permissionRows.map((permission) => ({
                      ...permission,
                      canView: false,
                      canCreate: false,
                      canEdit: false,
                      canDelete: false,
                      canApprove: false,
                    })),
                  ),
              )
              .catch((reason) => live && setError(reason.message));
        }
      })
      .catch((reason) => live && setError(reason.message));
    return () => {
      live = false;
    };
  }, [token, companyId, tick]);

  async function select(id: string) {
    setSelected(id);
    setName(roles.find((role) => role.roleId === id)?.roleName ?? '');
    setError('');
    if (!id) {
      setPermissions((rows) =>
        rows.map((row) => ({
          ...row,
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
          canApprove: false,
        })),
      );
      return;
    }
    setBusy(true);
    try {
      setPermissions(
        await api<Permission[]>('roles/' + id + '/permissions', token),
      );
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const immutable = roles.find((role) => role.roleId === selected)?.isCompanyAdmin;

  return (
    <section className="admin-view">
      <div className="page-heading">
        <div>
          <h1>Roles & Permissions</h1>
          <p>Set the menus and actions each company role can use.</p>
        </div>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {message && (
        <p className="admin-notice" role="status">
          {message}
        </p>
      )}
      <form
        className="admin-card"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            await api(
              selected ? 'roles/' + selected : 'roles',
              token,
              {
                companyId,
                roleName: name,
                permissions: permissions.map((permission) => ({
                  menuId: permission.menuId,
                  canView: permission.canView,
                  canCreate: permission.canCreate,
                  canEdit: permission.canEdit,
                  canDelete: permission.canDelete,
                  canApprove: permission.canApprove,
                })),
              },
              selected ? 'PATCH' : 'POST',
            );
            setMessage('Role permissions saved.');
            setTick((value) => value + 1);
          } catch (reason) {
            setError((reason as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="admin-form-grid">
          <label>
            Role
            <select
              disabled={busy}
              value={selected}
              onChange={(event) => select(event.target.value)}
            >
              <option value="">Create a new role</option>
              {roles.map((role) => (
                <option key={role.roleId} value={role.roleId}>
                  {role.roleName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Role name
            <input
              required
              minLength={2}
              maxLength={100}
              disabled={immutable}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        </div>
        {immutable && (
          <p>The built-in company administrator retains full access to enabled company menus.</p>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Menu</th>
                {actions.map((action) => (
                  <th key={action}>{action.slice(3)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((permission) => (
                <tr key={permission.menuId}>
                  <td>
                    {permission.menuName}
                    {!permission.companyEnabled && <small> — Disabled by platform</small>}
                  </td>
                  {actions.map((action) => (
                    <td key={action}>
                      <input
                        aria-label={permission.menuName + ' ' + action.slice(3)}
                        type="checkbox"
                        disabled={busy || immutable || !permission.companyEnabled}
                        checked={permission[action]}
                        onChange={(event) =>
                          setPermissions((rows) =>
                            rows.map((row) =>
                              row.menuId === permission.menuId
                                ? {
                                    ...row,
                                    [action]: event.target.checked,
                                    ...(action === 'canView' &&
                                    !event.target.checked
                                      ? {
                                          canCreate: false,
                                          canEdit: false,
                                          canDelete: false,
                                          canApprove: false,
                                        }
                                      : {}),
                                    ...(action !== 'canView' &&
                                    event.target.checked
                                      ? { canView: true }
                                      : {}),
                                  }
                                : row,
                            ),
                          )
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="primary" disabled={busy || immutable}>
          {busy
            ? 'Saving...'
            : selected
              ? 'Save permissions'
              : 'Create role'}
        </button>
      </form>
    </section>
  );
}
