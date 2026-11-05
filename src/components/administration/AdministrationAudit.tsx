import { useEffect, useState } from 'react';
import { createPortalApi } from './api';
import type { AdministrationProps } from './types';

type AuditPage = {
  items: {
    auditId: string;
    action: string;
    username: string;
    createdAt: string;
    newValues: object;
  }[];
  total: number;
  totalPages: number;
};

export function AdministrationAudit({
  token,
  companyId,
  platform = false,
}: AdministrationProps) {
  const api = createPortalApi(platform, companyId);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditPage>({
    items: [],
    total: 0,
    totalPages: 0,
  });
  const [error, setError] = useState('');
  useEffect(() => setPage(1), [companyId]);
  useEffect(() => {
    let live = true;
    api<AuditPage>(
      'audit-logs?companyId=' + companyId + '&page=' + page + '&limit=25',
      token,
    )
      .then((next) => live && setData(next))
      .catch((reason) => live && setError(reason.message));
    return () => {
      live = false;
    };
  }, [token, companyId, page]);

  return (
    <section className="admin-view">
      <div className="page-heading">
        <div>
          <h1>Audit Log</h1>
          <p>Recorded company and user administration actions.</p>
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div className="admin-card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.auditId}>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>{row.username}</td>
                <td>{row.action.replaceAll('_', ' ')}</td>
                <td>{JSON.stringify(row.newValues)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.items.length && (
          <p>No administration actions recorded for this company yet.</p>
        )}
        <div className="admin-pagination">
          <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {Math.max(1, data.totalPages)} &middot; {data.total}{' '}
            actions
          </span>
          <button
            disabled={page >= data.totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
