export type CaptureLine = {
  id: number;
  accountCode: string;
  accountName: string;
  amount: string;
  transactionType: 'DB' | 'CR';
  remarks: string;
};

export type AccountOption = { value: string; label: string; name: string };

export type AccountOptionRaw = { accountCode: string; accountName: string };

export type PostResult = {
  docNo: string;
  docType: string;
  docDate: string;
  period: string;
  lines: {
    accountCode: string;
    accountName: string;
    transactionType: string;
    amount: string;
  }[];
  balances: {
    accountCode: string;
    accountName: string;
    debitBalance: string;
    creditBalance: string;
  }[];
};

export type HistoryRow = {
  historyId: number;
  docNo: string;
  docType: string;
  refNo: string | null;
  docDate: string;
  accountCode: string;
  accountName: string;
  debitAmount: string;
  creditAmount: string;
  remarks: string | null;
  reversedByDocNo: string | null;
  reversalOfDocNo: string | null;
  reversible: boolean;
};

export type HistoryPage = {
  items: HistoryRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
