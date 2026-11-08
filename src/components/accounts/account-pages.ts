import {
  CalendarDays,
  FileChartColumnIncreasing,
  Layers,
  ListTree,
  Tags,
} from 'lucide-react';
import type { Page, PageKey } from '../../types';

export const accountSetupPageKeys = [
  'account-types',
  'account-subtypes',
  'balance-sheets',
  'main-accounts',
  'fiscal-years',
  'accounting-periods',
] as const;

export type AccountSetupPageKey = (typeof accountSetupPageKeys)[number];
export type AccountPageKey = 'accounts' | AccountSetupPageKey;

export const chartOfAccountsPage: Page = {
  title: 'Chart of accounts',
  description: 'Posting accounts under each main account.',
  endpoint: 'accounts',
  menuCode: 'CHART_OF_ACCOUNTS',
  icon: FileChartColumnIncreasing,
  idField: 'accountId',
  createNote: 'Account codes are generated from the selected main account.',
  editFields: ['accountName', 'description'],
  deletable: true,
  columns: ['accountCode', 'accountName', 'mainAccount.description', 'accountType.code', 'isActive'],
  fields: [
    {
      name: 'mainAccountId',
      label: 'Main account',
      type: 'select',
      required: true,
      select: {
        endpoint: 'main-accounts',
        valueField: 'mainAccountId',
        labelField: 'description',
        secondaryLabelField: 'mainCode',
        placeholder: 'Select main account',
      },
    },
    { name: 'accountName', label: 'Account name', required: true },
    { name: 'description', label: 'Description', full: true },
  ],
};

export const accountSetupPages: Record<AccountSetupPageKey, Page> = {
  'account-types': {
    title: 'Account types',
    description: 'The five primary classifications that drive account codes and reporting.',
    endpoint: 'account-types',
    menuCode: 'ACCOUNT_TYPES',
    scoped: false,
    icon: Layers,
    columns: ['code', 'codePrefix', 'name', 'description'],
  },
  'account-subtypes': {
    title: 'Account subtypes',
    description: 'Groupings used to organize main accounts within each account type.',
    endpoint: 'account-subtypes',
    menuCode: 'ACCOUNT_SUBTYPES',
    scoped: false,
    icon: Tags,
    createNote: 'Subtype codes are generated from the subtype name.',
    columns: ['code', 'name', 'description'],
    fields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'description', label: 'Description', full: true },
    ],
  },
  'balance-sheets': {
    title: 'Balance sheet',
    description: 'Balance sheet classifications that group main accounts within an account type.',
    endpoint: 'balance-sheets',
    menuCode: 'BALANCE_SHEETS',
    icon: FileChartColumnIncreasing,
    idField: 'balanceSheetId',
    editFields: ['description'],
    deletable: true,
    createNote: 'Balance sheet codes are generated automatically for the selected account type.',
    columns: ['code', 'accountType.code', 'description'],
    fields: [
      {
        name: 'accountTypeId',
        label: 'Account type',
        type: 'select',
        required: true,
        select: {
          endpoint: 'account-types',
          valueField: 'accountTypeId',
          labelField: 'name',
          secondaryLabelField: 'code',
          needsCompany: false,
          placeholder: 'Select account type',
        },
      },
      { name: 'description', label: 'Description', required: true, full: true },
    ],
  },
  'main-accounts': {
    title: 'Main accounts',
    description: 'Main ledger groupings that inherit their balance sheet classification and subtype.',
    endpoint: 'main-accounts',
    menuCode: 'MAIN_ACCOUNTS',
    icon: ListTree,
    idField: 'mainAccountId',
    editFields: ['balanceSheetId', 'accountSubtypeId', 'description', 'shortName'],
    deletable: true,
    createNote:
      'Enter your own numeric main account code, or leave it blank to generate one within the selected account type.',
    columns: ['mainCode', 'description', 'accountType.code', 'balanceSheet.code', 'accountSubtype.code'],
    fields: [
      {
        name: 'accountTypeId',
        label: 'Account type',
        type: 'select',
        required: true,
        select: {
          endpoint: 'account-types',
          valueField: 'accountTypeId',
          labelField: 'name',
          secondaryLabelField: 'code',
          needsCompany: false,
          placeholder: 'Select account type',
        },
      },
      { name: 'mainCode', label: 'Main account code (optional)' },
      {
        name: 'balanceSheetId',
        label: 'Balance sheet classification',
        type: 'select',
        required: true,
        select: {
          endpoint: 'balance-sheets',
          valueField: 'balanceSheetId',
          labelField: 'description',
          secondaryLabelField: 'code',
          dependsOn: 'accountTypeId',
          dependsOnParam: 'accountTypeId',
          placeholder: 'Select account type first',
        },
      },
      {
        name: 'accountSubtypeId',
        label: 'Account subtype',
        type: 'select',
        required: true,
        select: {
          endpoint: 'account-subtypes',
          valueField: 'accountSubtypeId',
          labelField: 'name',
          secondaryLabelField: 'code',
          needsCompany: false,
          placeholder: 'Select subtype',
        },
      },
      { name: 'description', label: 'Description', required: true, full: true },
      { name: 'shortName', label: 'Short name' },
    ],
  },
  'fiscal-years': {
    title: 'Fiscal years',
    description: 'Company financial year boundaries.',
    endpoint: 'fiscal-years',
    menuCode: 'FISCAL_YEARS',
    icon: CalendarDays,
    columns: ['yearName', 'startDate', 'endDate', 'isClosed'],
    fields: [
      { name: 'yearName', label: 'Year name', required: true },
      { name: 'startDate', label: 'Start date', type: 'date', required: true },
      { name: 'endDate', label: 'End date', type: 'date', required: true },
    ],
  },
  'accounting-periods': {
    title: 'Accounting periods',
    description: 'Open, closed, and upcoming posting periods.',
    endpoint: 'accounting-periods',
    menuCode: 'ACCOUNTING_PERIODS',
    icon: CalendarDays,
    columns: ['periodName', 'periodNumber', 'startDate', 'endDate', 'isOpen', 'isClosed'],
    fields: [
      {
        name: 'fiscalYearId',
        label: 'Fiscal year',
        type: 'select',
        required: true,
        select: {
          endpoint: 'fiscal-years',
          valueField: 'fiscalYearId',
          labelField: 'yearName',
          placeholder: 'Select fiscal year',
        },
      },
      { name: 'periodName', label: 'Period name', required: true },
      { name: 'periodNumber', label: 'Period number', type: 'number', required: true },
      { name: 'startDate', label: 'Start date', type: 'date', required: true },
      { name: 'endDate', label: 'End date', type: 'date', required: true },
    ],
  },
};

export const accountPages: Record<AccountPageKey, Page> = {
  accounts: chartOfAccountsPage,
  ...accountSetupPages,
};

export function isAccountSetupPageKey(key: PageKey): key is AccountSetupPageKey {
  return (accountSetupPageKeys as readonly PageKey[]).includes(key);
}
