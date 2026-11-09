import type { FinancialReportKind } from '../../types';
import { RecordModule } from '../records/RecordModule';
import type { RecordModuleProps } from '../records/RecordModule';
import { accountSetupPages } from './account-pages';
import type { AccountSetupPageKey } from './account-pages';

type AccountSetupModuleProps = Omit<
  RecordModuleProps,
  'page' | 'onOpenReport'
> & {
  pageKey: AccountSetupPageKey;
  onOpenReport?: (kind: FinancialReportKind) => void;
};

export function AccountSetupModule({
  pageKey,
  onOpenReport,
  ...props
}: AccountSetupModuleProps) {
  return (
    <RecordModule
      page={accountSetupPages[pageKey]}
      {...props}
      onOpenReport={
        pageKey === 'main-accounts' && onOpenReport
          ? () => onOpenReport('main-accounts')
          : undefined
      }
    />
  );
}
