import { useEffect, useState } from 'react';
import { PasswordInput } from '../common/PasswordInput';
import { createPortalApi } from './api';
import type { AdministrationProps, ManagedUser, Role } from './types';

export function UserAdministration({
  token,
  companyId,
  platform = false,
}: AdministrationProps) {
  const api = createPortalApi(platform, companyId);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [reset, setReset] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setEditing(null);
    setReset(null);
    setDeleting(null);
    setRoleIds([]);
    Promise.all([
      api<ManagedUser[]>('users?companyId=' + companyId, token),
      api<Role[]>('roles?companyId=' + companyId, token),
    ])
      .then(([userRows, roleRows]) => {
        if (live) {
          setUsers(userRows);
          setRoles(roleRows);
        }
      })
      .catch((reason) => live && setError(reason.message));
    return () => {
      live = false;
    };
  }, [token, companyId, tick]);

  async function act(work: () => Promise<unknown>, text: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
      setMessage(text);
      setTick((value) => value + 1);
      setForm({
        username: '',
        email: '',
        password: '',
        firstName: '',
        lastName: '',
      });
      setRoleIds([]);
      setReset(null);
      setNewPassword('');
      setDeleting(null);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function edit(user: ManagedUser) {
    setEditing(user);
    setForm({
      username: user.username,
      email: user.email,
      password: '',
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
    });
    setRoleIds(user.roles.map((role) => role.roleId));
    setReset(null);
    setDeleting(null);
  }

  return (
    <section className="admin-view">
      <div className="page-heading">
        <div>
          <small className="eyebrow">COMPANY ACCESS</small>
          <h1>Users</h1>
          <p>Create users and manage their roles, passwords and access.</p>
        </div>
        <button
          disabled={busy}
          onClick={() => {
            setEditing(null);
            setForm({
              username: '',
              email: '',
              password: '',
              firstName: '',
              lastName: '',
            });
            setRoleIds([]);
            setReset(null);
            setDeleting(null);
          }}
        >
          New user
        </button>
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
      <div className="admin-card table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Roles</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.userId}>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>{user.roles.map((role) => role.roleName).join(', ')}</td>
                <td>{user.isActive ? 'Active' : 'Inactive'}</td>
                <td>
                  {user.isPlatformAdmin ? (
                    'Platform administrator'
                  ) : (
                    <>
                      <button disabled={busy} onClick={() => edit(user)}>
                        Edit
                      </button>{' '}
                      <button
                        disabled={busy}
                        onClick={() => {
                          setReset(user);
                          setNewPassword('');
                          setDeleting(null);
                        }}
                      >
                        Reset password
                      </button>{' '}
                      <button
                        disabled={busy}
                        onClick={() =>
                          act(
                            () =>
                              api(
                                'users/' + user.userId,
                                token,
                                { isActive: !user.isActive },
                                'PATCH',
                              ),
                            'User access updated.',
                          )
                        }
                      >
                        {user.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      {platform && (
                        <>
                          {' '}
                          <button
                            className="admin-delete-button"
                            disabled={busy}
                            onClick={() => {
                              setDeleting(user);
                              setReset(null);
                              setError('');
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {deleting ? (
        <section
          className="admin-card admin-delete-confirmation"
          role="alertdialog"
          aria-labelledby="delete-user-title"
          aria-describedby="delete-user-description"
        >
          <h2 id="delete-user-title">Delete {deleting.username}?</h2>
          <p id="delete-user-description">
            This removes the user from the list and revokes their login and
            active sessions. Their accounting records and audit history are
            preserved.
          </p>
          <div>
            <button
              className="admin-delete-button"
              disabled={busy}
              onClick={() =>
                act(
                  () =>
                    api('users/' + deleting.userId, token, undefined, 'DELETE'),
                  'User deleted. Accounting records and audit history are preserved.',
                )
              }
            >
              {busy ? 'Deleting...' : 'Delete user'}
            </button>{' '}
            <button disabled={busy} onClick={() => setDeleting(null)}>
              Cancel
            </button>
          </div>
        </section>
      ) : reset ? (
        <form
          className="admin-card"
          onSubmit={(event) => {
            event.preventDefault();
            act(
              () =>
                api(
                  'users/' + reset.userId + '/reset-password',
                  token,
                  { password: newPassword },
                  'POST',
                ),
              'Password reset. Existing sessions have been revoked.',
            );
          }}
        >
          <h2>Reset password for {reset.username}</h2>
          <label>
            New password
            <PasswordInput
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <button className="primary" disabled={busy}>
            Reset password
          </button>
          <button type="button" onClick={() => setReset(null)}>
            Cancel
          </button>
        </form>
      ) : (
        <form
          className="admin-card"
          onSubmit={(event) => {
            event.preventDefault();
            const body = Object.fromEntries(
              Object.entries(form)
                .filter(([key, value]) =>
                  editing ? key !== 'password' : value !== '',
                )
                .map(([key, value]) => [key, value === '' ? null : value]),
            );
            act(
              () =>
                api(
                  editing ? 'users/' + editing.userId : 'users',
                  token,
                  { ...body, ...(!editing ? { companyId } : {}), roleIds },
                  editing ? 'PATCH' : 'POST',
                ),
              editing
                ? 'User updated. They must sign in again.'
                : 'User created.',
            );
          }}
        >
          <h2>{editing ? 'Edit ' + editing.username : 'Create user'}</h2>
          <div className="admin-form-grid">
            {(
              [
                'username',
                'email',
                'firstName',
                'lastName',
                'password',
              ] as const
            )
              .filter((key) => !editing || key !== 'password')
              .map((key) => (
                <label key={key}>
                  {key.replace(/([A-Z])/g, ' $1')}
                  {key === 'password' ? (
                    <PasswordInput
                      required
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                      value={form[key]}
                      onChange={(event) =>
                        setForm({ ...form, [key]: event.target.value })
                      }
                    />
                  ) : (
                    <input
                      required={['username', 'email'].includes(key)}
                      type={key === 'email' ? 'email' : 'text'}
                      maxLength={100}
                      autoComplete="off"
                      value={form[key]}
                      onChange={(event) =>
                        setForm({ ...form, [key]: event.target.value })
                      }
                    />
                  )}
                </label>
              ))}
          </div>
          <fieldset>
            <legend>Company roles</legend>
            {roles.map((role) => (
              <label className="admin-check" key={role.roleId}>
                <input
                  type="checkbox"
                  checked={roleIds.includes(role.roleId)}
                  onChange={(event) =>
                    setRoleIds(
                      event.target.checked
                        ? [...roleIds, role.roleId]
                        : roleIds.filter((id) => id !== role.roleId),
                    )
                  }
                />
                {role.roleName}
              </label>
            ))}
          </fieldset>
          <button disabled={busy || roleIds.length === 0} className="primary">
            {busy ? 'Saving...' : editing ? 'Save user' : 'Create user'}
          </button>
        </form>
      )}
    </section>
  );
}
