import { useEffect, useState } from 'react';
import { CheckCheck, CheckCircle2, Landmark } from 'lucide-react';
import { API_PREFIX } from '../../api-url';
import type { ViewProps } from '../common/types';

export function BankReconciliationView({ token, companyId }: ViewProps) {
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [transactions, setTransactions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [reconcilingId, setReconcilingId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!companyId) return;
    fetch(`${API_PREFIX}/banking/accounts?companyId=${companyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAccounts(data);
          if (data.length > 0) {
            setSelectedAccountId(
              (current) => current || String(data[0].bankAccountId),
            );
          }
        }
      })
      .catch((reason) => setError(reason.message));
  }, [companyId, token]);

  useEffect(() => {
    if (!selectedAccountId) {
      setTransactions([]);
      return;
    }
    setLoading(true);
    fetch(`${API_PREFIX}/banking/accounts/${selectedAccountId}/transactions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.json())
      .then((data) => setTransactions(Array.isArray(data) ? data : []))
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [selectedAccountId, token]);

  async function reconcileTx(txId: string) {
    if (!selectedAccountId) return;
    setReconcilingId(txId);
    try {
      const response = await fetch(
        `${API_PREFIX}/banking/accounts/${selectedAccountId}/transactions/${txId}/reconcile`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) throw new Error('Failed to reconcile transaction');
      setTransactions((previous) =>
        previous.map((transaction) =>
          String(transaction.bankTransactionId) === txId
            ? {
                ...transaction,
                isReconciled: true,
                reconciledAt: new Date().toISOString(),
              }
            : transaction,
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Error reconciling',
      );
    } finally {
      setReconcilingId('');
    }
  }

  return (
    <div className="extra-page-view">
      <div className="page-heading">
        <div>
          <small className="eyebrow">BANKING & TREASURY</small>
          <h1>Bank Reconciliation</h1>
          <p>
            Match bank transactions against general ledger accounts and clear
            statement lines.
          </p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="table-panel">
        <div className="table-toolbar">
          <label className="company-select" style={{ minWidth: 260 }}>
            <Landmark size={15} />
            <select
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
            >
              <option value="">Select Bank Account</option>
              {accounts.map((account) => (
                <option
                  key={String(account.bankAccountId)}
                  value={String(account.bankAccountId)}
                >
                  {String(account.bankName)} — {String(account.accountName)} (
                  {String(account.currency)})
                </option>
              ))}
            </select>
          </label>
          <div className="count">
            <b>{transactions.length}</b> Statement Lines
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="empty">
                    Loading transactions…
                  </td>
                </tr>
              ) : transactions.length > 0 ? (
                transactions.map((transaction) => (
                  <tr key={String(transaction.bankTransactionId)}>
                    <td>{String(transaction.transactionDate || '—')}</td>
                    <td>
                      <span
                        className={`status ${String(transaction.transactionType) === 'DEBIT' ? 'paid' : 'draft'}`}
                      >
                        {String(transaction.transactionType)}
                      </span>
                    </td>
                    <td className="primary-cell">
                      {String(transaction.description || 'Bank transaction')}
                    </td>
                    <td>
                      <b>{String(transaction.amount)}</b>
                    </td>
                    <td>
                      {transaction.isReconciled ? (
                        <span className="status paid">
                          <CheckCircle2 size={12} /> Reconciled
                        </span>
                      ) : (
                        <span className="status partial">Pending</span>
                      )}
                    </td>
                    <td>
                      {!transaction.isReconciled ? (
                        <button
                          className="btn btn-primary"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() =>
                            reconcileTx(String(transaction.bankTransactionId))
                          }
                          disabled={
                            reconcilingId === String(transaction.bankTransactionId)
                          }
                        >
                          <CheckCheck size={13} /> Reconcile
                        </button>
                      ) : (
                        <span className="text-muted">Cleared</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="empty">
                    No transactions to reconcile for this bank account yet.
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
