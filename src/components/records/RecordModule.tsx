import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { API_PREFIX } from '../../api-url';
import { paginatedEndpoints } from '../../config/pages';
import type { MenuItem, Page } from '../../types';
import { CreateDialog } from '../common/CreateDialog';
import { DeleteRecordDialog } from './DeleteRecordDialog';
import { RecordsView } from './RecordsView';

type ListPage = {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type RecordModuleProps = {
  page: Page;
  token: string;
  companyId: string;
  companyName?: string;
  menus: MenuItem[];
  /** Increment to open the create dialog (e.g. from the dashboard). */
  createRequest: number;
  externalError?: string;
  onClearExternalError?: () => void;
  onOpenReport?: () => void;
};

export function RecordModule({
  page,
  token,
  companyId,
  companyName,
  menus,
  createRequest,
  externalError,
  onClearExternalError,
  onOpenReport,
}: RecordModuleProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [listPagination, setListPagination] = useState({ scope: '', number: 1 });
  const [pageSize, setPageSize] = useState(25);
  const [listTotal, setListTotal] = useState(0);
  const [listTotalPages, setListTotalPages] = useState(0);

  const isScoped = page.scoped !== false;
  const isPaginated = paginatedEndpoints.has(page.endpoint ?? '');
  const listSearch = isPaginated ? search : '';
  const listScope = JSON.stringify([
    page.menuCode ?? page.title,
    companyId,
    listSearch,
    pageSize,
  ]);
  const listPageNumber =
    listPagination.scope === listScope ? listPagination.number : 1;
  const menuAccess = menus.find((item) => item.menuCode === page.menuCode);
  const canEdit = !!menuAccess?.canEdit;
  const canDelete = !!menuAccess?.canDelete;
  const enabledMenuCodes = new Set(
    menus.filter((item) => item.canView !== false).map((item) => item.menuCode),
  );
  const fields = page.fields?.filter(
    (field) => !field.menuCode || enabledMenuCodes.has(field.menuCode),
  );
  const columns = (page.columns ?? []).filter((column) => {
    const menuCode = page.columnMenuCodes?.[column];
    return !menuCode || enabledMenuCodes.has(menuCode);
  });
  const deleteLabel = deleteTarget
    ? String(
        deleteTarget.accountName ??
          deleteTarget.description ??
          deleteTarget.mainCode ??
          deleteTarget.code ??
          '',
      )
    : '';

  useEffect(() => {
    setSearch('');
    setError('');
    setEditing(null);
    setDeleteTarget(null);
  }, [page]);

  useEffect(() => {
    setListPagination({ scope: listScope, number: 1 });
  }, [listScope]);

  useEffect(() => {
    if (createRequest > 0) setDialog(true);
  }, [createRequest]);

  // Fetch only the requested page; cancel stale requests during navigation or search.
  useEffect(() => {
    if (!page.endpoint) return;

    const controller = new AbortController();
    setLoading(true);
    setError('');
    setRows([]);
    setListTotal(0);
    setListTotalPages(0);

    if (isScoped && !companyId) {
      setLoading(false);
      return () => controller.abort();
    }

    const params = new URLSearchParams();
    if (isScoped) params.set('companyId', companyId);
    if (isPaginated) {
      params.set('page', String(listPageNumber));
      params.set('limit', String(pageSize));
      if (listSearch.trim()) params.set('q', listSearch.trim());
    }

    const endpoint = page.endpoint + (params.size ? `?${params.toString()}` : '');

    const timer = window.setTimeout(() => {
      api<Record<string, unknown>[] | ListPage>(endpoint, token, {
        signal: controller.signal,
      })
        .then((data) => {
          if (controller.signal.aborted) return;
          if (Array.isArray(data)) {
            setRows(data);
            return;
          }
          if (
            isPaginated &&
            data.totalPages > 0 &&
            listPageNumber > data.totalPages
          ) {
            setListPagination({ scope: listScope, number: data.totalPages });
            return;
          }
          setRows(data.items);
          setListTotal(data.total);
          setListTotalPages(data.totalPages);
        })
        .catch((reason) => {
          if (!controller.signal.aborted)
            setError(reason instanceof Error ? reason.message : 'Unable to load records');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, isPaginated && listSearch ? 250 : 0);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    token,
    page,
    companyId,
    refresh,
    page.endpoint,
    isScoped,
    isPaginated,
    listPageNumber,
    pageSize,
    listSearch,
    listScope,
  ]);

  async function createRecord(payload: Record<string, unknown>) {
    if (!page.endpoint) return;
    setError('');
    try {
      await api(page.endpoint, token, {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          ...(isScoped ? { companyId } : {}),
        }),
      });
      setDialog(false);
      setRefresh((value) => value + 1);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to save record',
      );
    }
  }

  async function updateRecord(payload: Record<string, unknown>) {
    if (!page.endpoint || !page.idField || !editing) return;
    const id = editing[page.idField];
    if (typeof id !== 'string') return;
    setError('');
    try {
      await api(`${page.endpoint}/${id}`, token, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setEditing(null);
      setRefresh((value) => value + 1);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to update record',
      );
    }
  }

  async function deleteRecord() {
    if (!page.endpoint || !page.idField || !deleteTarget) return;
    const id = deleteTarget[page.idField];
    if (typeof id !== 'string') return;
    setBusy(true);
    setError('');
    setDeleteTarget(null);
    try {
      await api(`${page.endpoint}/${id}`, token, {
        method: 'DELETE',
      });
      setRefresh((value) => value + 1);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to delete record',
      );
    } finally {
      setBusy(false);
    }
  }

  async function downloadRowPdf(row: Record<string, unknown>) {
    if (!page.endpoint || !page.pdfDownload) return;
    const id = row[page.pdfDownload.idField];
    if (typeof id !== 'string') return;
    setPdfBusyId(id);
    setError('');
    try {
      const response = await fetch(`${API_PREFIX}/${page.endpoint}/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = Array.isArray(body?.message)
          ? body.message.join(', ')
          : body?.message;
        throw new Error(message || `Download failed (${response.status})`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const filename =
        /filename="([^"]+)"/.exec(disposition)?.[1] ??
        `${String(row.invoiceNumber ?? 'invoice')}.pdf`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to download invoice',
      );
    } finally {
      setPdfBusyId('');
    }
  }

  return (
    <>
      <RecordsView
        page={page}
        columns={columns}
        companyName={companyName}
        rows={rows}
        loading={loading}
        error={error || externalError || ''}
        search={search}
        isPaginated={isPaginated}
        pageSize={pageSize}
        listPageNumber={listPageNumber}
        listTotal={listTotal}
        listTotalPages={listTotalPages}
        pdfBusyId={pdfBusyId}
        canEdit={canEdit}
        canDelete={canDelete}
        onSearch={setSearch}
        onRefresh={() => setRefresh((value) => value + 1)}
        onCreate={() => setDialog(true)}
        onEdit={(row) => {
          setError('');
          setEditing(row);
        }}
        onDelete={(row) => {
          setError('');
          setDeleteTarget(row);
        }}
        onDismissError={() => {
          setError('');
          onClearExternalError?.();
        }}
        onPageSizeChange={setPageSize}
        onPageChange={(number) =>
          setListPagination({ scope: listScope, number })
        }
        onDownloadPdf={(row) => void downloadRowPdf(row)}
        onOpenReport={onOpenReport}
      />

      {dialog && fields && (
        <CreateDialog
          title={page.title}
          fields={fields}
          note={page.createNote}
          token={token}
          companyId={companyId}
          onClose={() => setDialog(false)}
          onSubmit={createRecord}
        />
      )}

      {editing && fields && page.editFields && (
        <CreateDialog
          title={page.title}
          fields={fields.filter((field) =>
            page.editFields!.includes(field.name),
          )}
          token={token}
          companyId={companyId}
          initialValues={editing}
          mode="edit"
          onClose={() => setEditing(null)}
          onSubmit={updateRecord}
        />
      )}

      {deleteTarget && (
        <DeleteRecordDialog
          title={page.title}
          label={deleteLabel}
          busy={busy}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void deleteRecord()}
        />
      )}
    </>
  );
}
