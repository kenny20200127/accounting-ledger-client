import { RecordModule } from '../records/RecordModule';
import type { RecordModuleProps } from '../records/RecordModule';
import { chartOfAccountsPage } from './account-pages';

type ChartOfAccountsModuleProps = Omit<RecordModuleProps, 'page'>;

export function ChartOfAccountsModule(props: ChartOfAccountsModuleProps) {
  return <RecordModule page={chartOfAccountsPage} {...props} />;
}
