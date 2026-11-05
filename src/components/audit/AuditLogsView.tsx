import { useState } from 'react';
import type { ViewProps } from '../common/types';

export function AuditLogsView(_props: ViewProps) {
  const [logs] = useState(() => [
    {
      time: new Date().toLocaleString(),
      action: 'LOGIN_SUCCESS',
      entity: 'User Session',
      user: 'Administrator (admin)',
      status: 'Logged',
    },
    {
      time: new Date(Date.now() - 3600000).toLocaleString(),
      action: 'MENU_SYNC',
      entity: 'Database Navigation',
      user: 'System Core',
      status: 'Logged',
    },
  ]);

  return (
    <div className="extra-page-view">
      <div className="page-heading">
        <div>
          <small className="eyebrow">SYSTEM INTEGRITY</small>
          <h1>Audit Logs</h1>
          <p>
            Tamper-evident trail of transactions, authorizations, and posting
            events.
          </p>
        </div>
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <div className="count">
            <b>Audit Trail Active</b>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity</th>
                <th>User</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, index) => (
                <tr key={index}>
                  <td>{log.time}</td>
                  <td>
                    <span className="status paid">{log.action}</span>
                  </td>
                  <td>{log.entity}</td>
                  <td>{log.user}</td>
                  <td>
                    <span className="bool yes">{log.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
