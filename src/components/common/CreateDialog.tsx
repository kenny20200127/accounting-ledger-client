import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowUpRight, Plus, Trash2, X } from 'lucide-react';
import { api } from '../../api/client';
import type { Field } from '../../types';
import { singular } from '../../lib/format';
import { Combobox } from './Combobox';

type CreateDialogProps = {
  title: string;
  fields: Field[];
  note?: string;
  token: string;
  companyId: string;
  /** Existing record values used when editing. */
  initialValues?: Record<string, unknown>;
  mode?: 'create' | 'edit';
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
};

export function CreateDialog({
  title,
  fields,
  note,
  token,
  companyId,
  initialValues,
  mode = 'create',
  onClose,
  onSubmit,
}: CreateDialogProps) {
  const editing = mode === 'edit';
  const [busy, setBusy] = useState(false);
  const [roles, setRoles] = useState<
    { roleId: string; roleCode: string; roleName: string }[]
  >([]);
  const [roleError, setRoleError] = useState('');

  // Select-dropdown state
  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const [key, value] of Object.entries(initialValues ?? {})) {
      if (value !== null && value !== undefined && typeof value !== 'object')
        seed[key] = String(value);
    }
    return seed;
  });
  const [optionsByField, setOptionsByField] = useState<
    Record<string, { value: string; label: string }[]>
  >({});
  const [loadingField, setLoadingField] = useState<Record<string, boolean>>({});
  const [optError, setOptError] = useState<Record<string, string>>({});

  const selectFields = fields.flatMap((field) =>
    field.type === 'lines' && field.lineFields
      ? field.lineFields.filter(
          (lineField) => lineField.type === 'select' && lineField.select,
        )
      : field.type === 'select' && field.select
        ? [field]
        : [],
  );
  const [lineRows, setLineRows] = useState<Record<string, string>[]>([{}]);

  function makeLabel(
    item: Record<string, unknown>,
    cfg: NonNullable<Field['select']>,
  ): string {
    const primary = String(item[cfg.labelField ?? ''] ?? '');
    if (
      cfg.secondaryLabelField &&
      item[cfg.secondaryLabelField] != null &&
      item[cfg.secondaryLabelField] !== ''
    ) {
      return `${primary} \u2014 ${item[cfg.secondaryLabelField]}`;
    }
    return primary;
  }

  async function loadOptions(field: Field) {
    const cfg = field.select!;
    if (cfg.options) {
      setOptionsByField((prev) => ({ ...prev, [field.name]: cfg.options! }));
      return;
    }
    if (!cfg.endpoint) return;
    if (!cfg.valueField || !cfg.labelField) return;
    const valueField = cfg.valueField;
    const needsCompany = cfg.needsCompany !== false;
    if (needsCompany && !companyId) return;
    if (cfg.dependsOn) {
      const depValue = values[cfg.dependsOn];
      if (!depValue) {
        setOptionsByField((prev) => ({ ...prev, [field.name]: [] }));
        return;
      }
    }
    setLoadingField((prev) => ({ ...prev, [field.name]: true }));
    setOptError((prev) => ({ ...prev, [field.name]: '' }));
    try {
      const params = new URLSearchParams();
      if (needsCompany) params.set('companyId', companyId);
      if (cfg.dependsOn && cfg.dependsOnParam) {
        params.set(cfg.dependsOnParam, String(values[cfg.dependsOn]));
      }
      for (const [key, value] of Object.entries(cfg.params ?? {})) {
        params.set(key, value);
      }
      const path = cfg.endpoint + (params.size ? `?${params.toString()}` : '');
      const data = await api<unknown>(path, token);
      const arr = Array.isArray(data)
        ? data
        : ((data as { items?: unknown[] })?.items ?? []);
      const opts = (arr as Record<string, unknown>[]).map((item) => ({
        value: String(item[valueField]),
        label: makeLabel(item, cfg),
      }));
      setOptionsByField((prev) => ({ ...prev, [field.name]: opts }));
    } catch (error: unknown) {
      setOptError((prev) => ({
        ...prev,
        [field.name]:
          error instanceof Error ? error.message : 'Unable to load options.',
      }));
    } finally {
      setLoadingField((prev) => ({ ...prev, [field.name]: false }));
    }
  }

  // Load non-dependent select fields on mount
  useEffect(() => {
    selectFields.forEach((field) => {
      if (field.select!.dependsOn) return;
      void loadOptions(field);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload dependent select fields when their dependency value changes
  const depSignature = selectFields
    .filter((field) => field.select!.dependsOn)
    .map((field) => `${field.name}=${values[field.select!.dependsOn!] ?? ''}`)
    .join('|');

  useEffect(() => {
    selectFields.forEach((field) => {
      if (!field.select!.dependsOn) return;
      void loadOptions(field);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depSignature]);

  // Roles multiselect
  useEffect(() => {
    if (
      !fields.some(
        (field) => field.type === 'multiselect' && field.name === 'roleIds',
      )
    )
      return;
    api<{ roleId: string; roleCode: string; roleName: string }[]>(
      'users/assignable-roles',
      token,
    )
      .then(setRoles)
      .catch((error: unknown) =>
        setRoleError(
          error instanceof Error ? error.message : 'Unable to load roles.',
        ),
      );
  }, [fields, token]);

  function handleSelectChange(name: string, value: string) {
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      // Reset dependent fields when this field changes
      selectFields.forEach((field) => {
        if (field.select!.dependsOn === name) next[field.name] = '';
      });
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {};

    fields.forEach((field) => {
      if (field.type === 'lines') {
        payload[field.name] = lineRows
          .map((row) => {
            const line: Record<string, string> = {};
            (field.lineFields ?? []).forEach((lineField) => {
              const value = row[lineField.name]?.trim();
              if (value) line[lineField.name] = value;
            });
            return line;
          })
          .filter((line) => Object.keys(line).length > 0);
        return;
      }

      if (field.type === 'multiselect') {
        payload[field.name] = data.getAll(field.name).map(String);
        return;
      }

      const value = data.get(field.name);
      if (field.type === 'checkbox') payload[field.name] = value === 'on';
      else if (value !== null && value !== '') payload[field.name] = String(value);
    });

    await onSubmit(payload);
    setBusy(false);
  }

  return (
    <div
      className="modal-bg"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="modal">
        <div className="modal-head">
          <div>
            <small className="eyebrow">{editing ? 'EDIT RECORD' : 'NEW RECORD'}</small>
            <h2>
              {editing ? 'Edit' : 'Create'} {singular(title).toLowerCase()}
            </h2>
            {note ? <p className="modal-note">{note}</p> : null}
          </div>
          <button className="row-open" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            {fields.map((field) =>
              field.type === 'lines' ? (
                <div key={field.name} className={`field full line-items`}>
                  <div className="line-items-head">
                    <span>{field.label}</span>
                    <button
                      type="button"
                      className="btn btn-light"
                      onClick={() => setLineRows((rows) => [...rows, {}])}
                    >
                      <Plus size={14} />
                      Add line
                    </button>
                  </div>
                  {lineRows.map((row, index) => (
                    <div key={index} className="line-item">
                      <div className="line-item-fields">
                        {(field.lineFields ?? []).map((lineField) => (
                          <label
                            key={lineField.name}
                            className={`field ${lineField.full ? 'full' : ''}`}
                          >
                            {lineField.type === 'select' && lineField.select ? (
                              <>
                                {lineField.label}
                                <Combobox
                                  name={`lines.${index}.${lineField.name}`}
                                  value={row[lineField.name] ?? ''}
                                  options={optionsByField[lineField.name] ?? []}
                                  loading={!!loadingField[lineField.name]}
                                  disabled={false}
                                  required={lineField.required}
                                  placeholder={
                                    loadingField[lineField.name]
                                      ? 'Loading…'
                                      : (lineField.select.placeholder ??
                                        `Select ${lineField.label.toLowerCase()}`)
                                  }
                                  onChange={(value) =>
                                    setLineRows((rows) =>
                                      rows.map((current, rowIndex) =>
                                        rowIndex === index
                                          ? {
                                              ...current,
                                              [lineField.name]: value,
                                            }
                                          : current,
                                      ),
                                    )
                                  }
                                />
                              </>
                            ) : (
                              <>
                                {lineField.label}
                                <input
                                  type={lineField.type ?? 'text'}
                                  required={lineField.required}
                                  step={
                                    lineField.step ??
                                    (lineField.type === 'number'
                                      ? '0.01'
                                      : undefined)
                                  }
                                  value={row[lineField.name] ?? ''}
                                  onChange={(event) =>
                                    setLineRows((rows) =>
                                      rows.map((current, rowIndex) =>
                                        rowIndex === index
                                          ? {
                                              ...current,
                                              [lineField.name]:
                                                event.target.value,
                                            }
                                          : current,
                                      ),
                                    )
                                  }
                                />
                              </>
                            )}
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="line-item-remove"
                        aria-label="Remove line"
                        disabled={lineRows.length === 1}
                        onClick={() =>
                          setLineRows((rows) =>
                            rows.filter((_, rowIndex) => rowIndex !== index),
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <label
                  key={field.name}
                  className={`field ${field.full ? 'full' : ''}`}
                >
                  {field.type === 'checkbox' ? (
                    <span
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <input
                        type="checkbox"
                        name={field.name}
                        defaultChecked={!!initialValues?.[field.name]}
                      />
                      {field.label}
                    </span>
                  ) : field.type === 'multiselect' &&
                    field.name === 'roleIds' ? (
                    <>
                      {field.label}
                      <select
                        name={field.name}
                        multiple
                        required={field.required}
                        size={Math.min(Math.max(roles.length, 2), 5)}
                      >
                        {roles.map((role) => (
                          <option key={role.roleId} value={role.roleId}>
                            {role.roleName} ({role.roleCode})
                          </option>
                        ))}
                      </select>
                      {roleError && (
                        <small style={{ color: '#dc2626' }}>{roleError}</small>
                      )}
                    </>
                  ) : field.type === 'select' && field.select ? (
                    <>
                      {field.label}
                      <Combobox
                        name={field.name}
                        value={values[field.name] ?? ''}
                        options={optionsByField[field.name] ?? []}
                        loading={!!loadingField[field.name]}
                        disabled={
                          !!field.select.dependsOn &&
                          !values[field.select.dependsOn]
                        }
                        required={field.required}
                        placeholder={
                          loadingField[field.name]
                            ? 'Loading…'
                            : (field.select.placeholder ??
                              `Select ${field.label.toLowerCase()}`)
                        }
                        onChange={(value) =>
                          handleSelectChange(field.name, value)
                        }
                      />
                      {optError[field.name] && (
                        <small style={{ color: '#dc2626' }}>
                          {optError[field.name]}
                        </small>
                      )}
                    </>
                  ) : (
                    <>
                      {field.label}
                      <input
                        name={field.name}
                        type={field.type ?? 'text'}
                        required={field.required}
                        defaultValue={
                          initialValues?.[field.name] != null
                            ? String(initialValues[field.name])
                            : undefined
                        }
                        step={
                          field.step ??
                          (field.type === 'number' ? '0.01' : undefined)
                        }
                        placeholder={
                          field.name.endsWith('Id') ? 'UUID' : undefined
                        }
                      />
                    </>
                  )}
                </label>
              ),
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-light" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Create record'}
              <ArrowUpRight size={15} />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
