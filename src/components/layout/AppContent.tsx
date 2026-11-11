import type { Company, FinancialReportKind, MenuItem, PageKey } from '../../types';
import { pages } from '../../config/pages';
import { menuCodeToPageKey } from '../../types';

import {
  AccountSetupModule,
  ChartOfAccountsModule,
  isAccountSetupPageKey,
} from '../accounts';
import { Dashboard } from '../dashboard/Dashboard';
import { RecordModule } from '../records/RecordModule';
import { FinancialReportsView } from '../reports/FinancialReportsView';
import { LedgerCaptureView } from '../ledger/LedgerCaptureView';
import { BankReconciliationView } from '../banking/BankReconciliationView';
import {
  AdministrationAudit,
  CompanyAdministration,
  RoleAdministration,
  UserAdministration,
} from '../administration';

type AppContentProps = {
  active: PageKey;
  token: string;
  companyId: string;
  companyName?: string;
  companies: Company[];
  menus: MenuItem[];
  error: string;
  createRequest: number;
  reportRequest: { kind: FinancialReportKind; nonce: number } | null;
  onClearError: () => void;
  onNavigate: (key: PageKey) => void;
  onOpenCreate: (key: PageKey) => void;
  onOpenReport: (kind: FinancialReportKind) => void;
  onCompanyChanged: () => void;
  onSelectCompany: (companyId: string) => void;
};

export function AppContent({
  active,
  token,
  companyId,
  companyName,
  companies,
  menus,
  error,
  createRequest,
  reportRequest,
  onClearError,
  onNavigate,
  onOpenCreate,
  onOpenReport,
  onCompanyChanged,
  onSelectCompany,
}: AppContentProps) {
  if (!menus.some((menu) => menuCodeToPageKey[menu.menuCode] === active && menu.canView !== false))
    return (
      <section className="admin-card" role="status">
        <h2>{menus.length ? 'Menu unavailable' : 'No menus available'}</h2>
        <p>
          {error || (menus.length
            ? 'This menu is not available for your company or role. Choose another menu.'
            : 'Contact your administrator to enable access to company functionality.')}
        </p>
      </section>
    );

  if (active === 'dashboard')
    return (
      <Dashboard
        companies={companies}
        companyId={companyId}
        token={token}
        menus={menus}
        onNavigate={onNavigate}
        onOpenCreate={onOpenCreate}
      />
    );

  if (active === 'companies')
    return (
      <CompanyAdministration
        key={companyId}
        token={token}
        companyId={companyId}
        platform={false}
        onChanged={onCompanyChanged}
        onSelect={onSelectCompany}
      />
    );

  if (active === 'users')
    return <UserAdministration key={companyId} token={token} companyId={companyId} />;

  if (active === 'roles')
    return <RoleAdministration token={token} companyId={companyId} />;

  if (active === 'bank-reconciliation')
    return <BankReconciliationView token={token} companyId={companyId} />;

  if (active === 'audit-logs')
    return <AdministrationAudit token={token} companyId={companyId} />;

  if (active === 'reports')
    return (
      <FinancialReportsView
        key={`${companyId}:${reportRequest?.nonce ?? 0}`}
        token={token}
        companyId={companyId}
        initialKind={reportRequest?.kind}
      />
    );

  const recordProps = {
    token,
    companyId,
    companyName,
    menus,
    createRequest,
    externalError: error,
    onClearExternalError: onClearError,
  };

  if (active === 'ledger')
    return <LedgerCaptureView key={companyId} token={token} companyId={companyId} />;

  if (active === 'accounts')
    return (
      <ChartOfAccountsModule {...recordProps} onOpenReport={onOpenReport} />
    );

  if (isAccountSetupPageKey(active))
    return (
      <AccountSetupModule
        pageKey={active}
        {...recordProps}
        onOpenReport={onOpenReport}
      />
    );

  return <RecordModule page={pages[active]} {...recordProps} />;
}
