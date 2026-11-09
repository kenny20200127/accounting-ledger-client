import type { FinancialReportKind } from '../../types';
import { RecordModule } from '../records/RecordModule';
import type { RecordModuleProps } from '../records/RecordModule';
import { chartOfAccountsPage } from './account-pages';

type ChartOfAccountsModuleProps = Omit<
  RecordModuleProps,
  'page' | 'onOpenReport'
> & {
  onOpenReport?: (kind: FinancialReportKind) => void;
};

export function ChartOfAccountsModule({
  onOpenReport,
  ...props
}: ChartOfAccountsModuleProps) {
  return (
    <RecordModule
      page={chartOfAccountsPage}
      {...props}
      onOpenReport={
        onOpenReport ? () => onOpenReport('chart-of-accounts') : undefined
      }
    />
  );
}
