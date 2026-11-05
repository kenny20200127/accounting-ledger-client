import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { API_PREFIX } from '../../api-url';
import type { ViewProps } from '../common/types';

export function RolesView({ token }: ViewProps) {
  const [roles, setRoles] = useState<
    { roleId: string; roleCode: string; roleName: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRoles = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_PREFIX}/users/assignable-roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to load roles');
      const data = await response.json();
      setRoles(Array.isArray(data) ? data : []);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Error fetching roles',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch(`${API_PREFIX}/users/assignable-roles`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.json())
      .then((data) => {
        if (active) setRoles(Array.isArray(data) ? data : []);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : 'Error fetching roles',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="extra-page-view">
      <div className="page-heading">
        <div>
          <small className="eyebrow">ACCESS CONTROL</small>
          <h1>Roles & Permissions</h1>
          <p>
            System security roles and menu authorization rules configured in
            PostgreSQL.
          </p>
        </div>
        <button className="btn btn-light" onClick={loadRoles}>
          <RefreshCw size={14} className={loading ? 'spinning' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="table-panel">
        <div className="table-toolbar">
          <div className="count">
            <b>{roles.length}</b> Defined Roles
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Role Code</th>
                <th>Role Name</th>
                <th>Permissions Scope</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="empty">
                    Loading roles…
                  </td>
                </tr>
              ) : roles.length > 0 ? (
                roles.map((role) => (
                  <tr key={role.roleId}>
                    <td className="primary-cell">
                      <b>{role.roleCode}</b>
                    </td>
                    <td>{role.roleName}</td>
                    <td>
                      <span className="status paid">
                        {role.roleCode === 'ADMIN'
                          ? 'All 19 Menus (Full Access)'
                          : 'Custom Role Permissions'}
                      </span>
                    </td>
                    <td>
                      <span className="bool yes">Active</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="empty">
                    No roles defined yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
