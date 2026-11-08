import { RecordModule } from '../records/RecordModule';
import type { RecordModuleProps } from '../records/RecordModule';
import { accountSetupPages } from './account-pages';
import type { AccountSetupPageKey } from './account-pages';

type AccountSetupModuleProps = Omit<RecordModuleProps, 'page'> & {
  pageKey: AccountSetupPageKey;
};

export function AccountSetupModule({
  pageKey,
  ...props
}: AccountSetupModuleProps) {
  return <RecordModule page={accountSetupPages[pageKey]} {...props} />;
}
