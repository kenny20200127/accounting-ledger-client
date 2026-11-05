import { Building2, ChevronDown, Menu } from 'lucide-react';
import type { Company } from '../../types';

type AppHeaderProps = {
  pageTitle: string;
  companies: Company[];
  companyId: string;
  canSwitchCompany: boolean;
  user: { firstName?: string; username: string };
  onOpenMenu: () => void;
  onCompanyChange: (companyId: string) => void;
};

export function AppHeader({
  pageTitle,
  companies,
  companyId,
  canSwitchCompany,
  user,
  onOpenMenu,
  onCompanyChange,
}: AppHeaderProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="slide-toggle-btn"
          onClick={onOpenMenu}
          aria-label="Toggle Slide Menu"
          title="Open Navigation Menu"
        >
          <Menu size={18} />
        </button>

        <div className="breadcrumb">
          Workspace <i>/</i> <b>{pageTitle}</b>
        </div>
      </div>

      <div className="top-tools">
        <label className="company-select">
          <Building2 size={15} />
          <select
            disabled={!canSwitchCompany}
            value={companyId}
            onChange={(event) => onCompanyChange(event.target.value)}
            aria-label="Company"
          >
            <option value="">Choose company</option>
            {companies.map((company) => (
              <option key={company.companyId} value={company.companyId}>
                {company.companyName}
              </option>
            ))}
          </select>
          <ChevronDown size={13} />
        </label>

        <span className="user-avatar-circle">
          {(user.firstName?.[0] ?? user.username[0]).toUpperCase()}
        </span>
      </div>
    </header>
  );
}
