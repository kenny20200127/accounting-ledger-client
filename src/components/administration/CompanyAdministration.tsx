import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { browserTitle } from '../../company-theme';
import type { Company } from '../../types';
import { PasswordInput } from '../common/PasswordInput';
import { createPortalApi, fetchApi } from './api';
import type { AdministrationProps } from './types';

const fields = [
  ['companyCode', 'Company code'],
  ['companyName', 'Company name'],
  ['registrationNumber', 'Registration number'],
  ['taxIdentificationNumber', 'Tax identification number'],
  ['industry', 'Industry'],
  ['website', 'Website'],
  ['email', 'Company email'],
  ['phone', 'Phone'],
  ['contactPerson', 'Contact person'],
  ['contactTitle', 'Contact title'],
  ['address', 'Street address'],
  ['city', 'City'],
  ['state', 'State'],
  ['postalCode', 'Postal code'],
  ['country', 'Country'],
  ['baseCurrency', 'Base currency'],
  ['fiscalYearStartMonth', 'Fiscal year start month'],
  ['fiscalYearStartDay', 'Fiscal year start day'],
  ['profitAndLossAccountCode', 'Profit and loss account'],
  ['profitAndLossAmount', 'Profit and loss total'],
  ['primaryColor', 'Primary color'],
  ['secondaryColor', 'Secondary color'],
];

const defaults: Record<string, string> = {
  country: 'Nigeria',
  baseCurrency: 'NGN',
  fiscalYearStartMonth: '1',
  fiscalYearStartDay: '1',
  profitAndLossAmount: '0.00',
  primaryColor: '#176246',
  secondaryColor: '#edf5ef',
};

export function CompanyAdministration({
  token,
  companyId,
  platform = false,
  onChanged,
  onSelect,
  onManage,
}: AdministrationProps) {
  const api = createPortalApi(platform, companyId);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [editing, setEditing] = useState<string | null>(
    platform ? null : companyId,
  );
  const [form, setForm] = useState(defaults);
  const [admin, setAdmin] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [accountOptions, setAccountOptions] = useState<
    { accountCode: string; accountName: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    api<Company[]>('companies', token)
      .then((rows) => {
        if (!live) return;
        setCompanies(rows);
        if (!platform) {
          const company = rows.find((row) => row.companyId === companyId);
          if (company) {
            setEditing(company.companyId);
            setForm(
              Object.fromEntries(
                fields.map(([key]) => [
                  key,
                  String(
                    (company as unknown as Record<string, unknown>)[key] ??
                      defaults[key] ??
                      '',
                  ),
                ]),
              ),
            );
          }
        }
      })
      .catch((reason) => live && setError(reason.message));
    return () => {
      live = false;
    };
  }, [token, companyId, platform, tick]);

  useEffect(() => {
    if (!editing) {
      setAccountOptions([]);
      return;
    }
    let live = true;
    fetchApi<{ accountCode: string; accountName: string }[]>(
      'accounts?companyId=' + encodeURIComponent(editing),
      token,
    )
      .then((rows) => {
        if (live) setAccountOptions(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (live) setAccountOptions([]);
      });
    return () => {
      live = false;
    };
  }, [editing, token]);

  function edit(company: Company) {
    setEditing(company.companyId);
    setForm(
      Object.fromEntries(
        fields.map(([key]) => [
          key,
          String(
            (company as unknown as Record<string, unknown>)[key] ??
              defaults[key] ??
              '',
          ),
        ]),
      ),
    );
    setLogo(null);
    setError('');
    setMessage('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    let cid = editing;
    try {
      const body: Record<string, unknown> = Object.fromEntries(
        Object.entries(form)
          .filter(([, value]) => editing || value !== '')
          .map(([key, value]) => [key, value === '' ? null : value]),
      );
      body.fiscalYearStartMonth = Number(form.fiscalYearStartMonth);
      body.fiscalYearStartDay = Number(form.fiscalYearStartDay);
      body.profitAndLossAmount = form.profitAndLossAmount || '0';
      if (cid) await api('companies/' + cid, token, body, 'PATCH');
      else {
        const result = await api<{ company: Company }>(
          'platform/companies',
          token,
          {
            ...body,
            firstAdmin: Object.fromEntries(
              Object.entries(admin).filter(([, value]) => value !== ''),
            ),
          },
          'POST',
        );
        cid = result.company.companyId;
        setEditing(cid);
        setAdmin({
          username: '',
          email: '',
          password: '',
          firstName: '',
          lastName: '',
        });
      }
      setMessage(
        editing
          ? 'Company details saved.'
          : 'Company onboarded. Share the username and initial password with its administrator.',
      );
      if (logo) {
        const data = new FormData();
        data.append('file', logo);
        try {
          await api('companies/' + cid + '/logo', token, data, 'POST');
          setLogo(null);
        } catch (reason) {
          throw new Error(
            'Company saved, but logo upload failed: ' +
              (reason as Error).message,
          );
        }
      }
      setTick((value) => value + 1);
      onChanged?.();
      if (cid) onSelect?.(cid);
    } catch (reason) {
      setError((reason as Error).message);
      setTick((value) => value + 1);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function status(company: Company) {
    setBusy(true);
    setError('');
    try {
      await api(
        'companies/' + company.companyId,
        token,
        { isActive: !company.isActive },
        'PATCH',
      );
      setTick((value) => value + 1);
      onChanged?.();
      setMessage(
        company.isActive
          ? 'Company suspended. Its users cannot sign in or continue existing sessions.'
          : 'Company activated.',
      );
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const current = companies.find((company) => company.companyId === editing);

  return (
    <section className="admin-view">
      <div className="page-heading">
        <div>
          <small className="eyebrow">
            {platform ? 'PLATFORM ADMINISTRATION' : 'COMPANY ADMINISTRATION'}
          </small>
          <h1>{platform ? 'Companies & Onboarding' : 'Company Settings'}</h1>
          <p>
            {platform
              ? 'Register companies, set their identity, and appoint the first administrator.'
              : 'Manage your company details and branding.'}
          </p>
        </div>
        {platform && (
          <button
            className="primary"
            onClick={() => {
              setEditing(null);
              setForm(defaults);
              setLogo(null);
              setError('');
              setMessage('');
            }}
          >
            New company
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}
      {message && (
        <p role="status" className="admin-notice">
          {message}
        </p>
      )}
      {platform && (
        <div className="admin-card">
          <h2>Registered companies</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.companyId}>
                    <td>
                      {company.logoData && (
                        <img
                          className="admin-table-logo"
                          src={company.logoData}
                          alt=""
                        />
                      )}
                      {company.companyName}
                    </td>
                    <td>{company.companyCode}</td>
                    <td>{company.isActive ? 'Active' : 'Suspended'}</td>
                    <td>
                      <button disabled={busy} onClick={() => edit(company)}>
                        Edit
                      </button>{' '}
                      <button
                        disabled={busy}
                        onClick={() =>
                          (onManage ?? onSelect)?.(company.companyId)
                        }
                      >
                        Manage users
                      </button>{' '}
                      <button disabled={busy} onClick={() => status(company)}>
                        {company.isActive ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <form className="admin-card" onSubmit={submit}>
        <h2>{editing ? 'Company profile' : 'Onboard a company'}</h2>
        <div className="admin-form-grid">
          {fields.map(([key, label]) => (
            <label key={key}>
              {label}
              {key === 'profitAndLossAccountCode' ? (
                <select
                  value={form[key] ?? ''}
                  onChange={(event) =>
                    setForm({ ...form, [key]: event.target.value })
                  }
                >
                  <option value="">Not selected</option>
                  {accountOptions.map((account) => (
                    <option key={account.accountCode} value={account.accountCode}>
                      {account.accountCode} - {account.accountName}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  required={[
                    'companyCode',
                    'companyName',
                    'baseCurrency',
                    'fiscalYearStartMonth',
                    'fiscalYearStartDay',
                    'primaryColor',
                    'secondaryColor',
                  ].includes(key)}
                  type={
                    key.endsWith('Color')
                      ? 'color'
                      : key === 'profitAndLossAmount'
                        ? 'number'
                        : key.startsWith('fiscalYear')
                          ? 'number'
                          : key === 'email'
                            ? 'email'
                            : 'text'
                  }
                  step={key === 'profitAndLossAmount' ? '0.01' : undefined}
                  min={key.startsWith('fiscalYear') ? 1 : undefined}
                  max={
                    key === 'fiscalYearStartMonth'
                      ? 12
                      : key === 'fiscalYearStartDay'
                        ? 28
                        : undefined
                  }
                  value={form[key] ?? ''}
                  onChange={(event) =>
                    setForm({ ...form, [key]: event.target.value })
                  }
                />
              )}
            </label>
          ))}
        </div>
        <div
          className="admin-brand-preview"
          style={{
            borderColor: form.primaryColor,
            backgroundColor: form.secondaryColor,
          }}
        >
          {current?.logoData && (
            <img src={current.logoData} alt="Company logo" />
          )}
          <strong style={{ color: form.primaryColor }}>
            {form.companyName || 'Company branding preview'}
          </strong>
        </div>
        <div className="admin-tab-preview" title="Browser tab preview">
          {current?.logoData ? (
            <img src={current.logoData} alt="" />
          ) : (
            <img src="/favicon.png" alt="" />
          )}
          <span>
            {browserTitle(
              {
                companyName: form.companyName,
                logoData: current?.logoData,
              },
              platform ? 'Platform Administration' : undefined,
            )}
          </span>
        </div>
        <label>
          Company logo (PNG, JPEG, WebP; maximum 2 MB) — also used as the
          browser tab icon
          <input
            key={editing ?? 'new'}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file && file.size > 2097152) {
                setError('Logo must be 2 MB or smaller.');
                event.target.value = '';
                return;
              }
              setLogo(file ?? null);
            }}
          />
        </label>
        {current?.logoData && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(
                  'companies/' + editing + '/logo',
                  token,
                  undefined,
                  'DELETE',
                );
                setTick((value) => value + 1);
                onChanged?.();
              } catch (reason) {
                setError((reason as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Remove logo
          </button>
        )}
        {!editing && (
          <>
            <h2>First company administrator</h2>
            <div className="admin-form-grid">
              {(
                [
                  'username',
                  'email',
                  'firstName',
                  'lastName',
                  'password',
                ] as const
              ).map((key) => (
                <label key={key}>
                  {key === 'password'
                    ? 'Initial password (at least 12 characters)'
                    : key.replace(/([A-Z])/g, ' $1')}
                  {key === 'password' ? (
                    <PasswordInput
                      autoComplete="new-password"
                      required
                      minLength={12}
                      value={admin[key]}
                      onChange={(event) =>
                        setAdmin({ ...admin, [key]: event.target.value })
                      }
                    />
                  ) : (
                    <input
                      type={key === 'email' ? 'email' : 'text'}
                      autoComplete="off"
                      required={['username', 'email'].includes(key)}
                      value={admin[key]}
                      onChange={(event) =>
                        setAdmin({ ...admin, [key]: event.target.value })
                      }
                    />
                  )}
                </label>
              ))}
            </div>
            <p>
              Creates an administrator, accountant and viewer roles, a head
              office, and 12 accounting periods. The chart of accounts starts
              empty.
            </p>
          </>
        )}
        <button className="primary" disabled={busy}>
          {busy
            ? 'Saving...'
            : editing
              ? 'Save company'
              : 'Create company and administrator'}
        </button>
      </form>
    </section>
  );
}
