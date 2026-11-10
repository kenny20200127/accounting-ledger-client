import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { API_PREFIX } from '../../api-url';
import { read } from './api';
import type { AccountOption, AccountOptionRaw } from './types';

type AccountPickerProps = {
  token: string;
  companyId: string;
  value: string;
  selectedLabel: string;
  exclude?: string[];
  onChange: (accountCode: string, accountName: string) => void;
};

export function AccountPicker({
  token,
  companyId,
  value,
  selectedLabel,
  exclude,
  onChange,
}: AccountPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const blocked = new Set(exclude ?? []);
  const availableOptions = options.filter((option) => !blocked.has(option.value));

  useEffect(() => {
    if (!open || !companyId) return;
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        companyId,
        postable: 'true',
        limit: '20',
      });
      if (query.trim()) params.set('q', query.trim());
      read<{ items?: AccountOptionRaw[] } | AccountOptionRaw[]>(
        `${API_PREFIX}/accounts?${params}`,
        token,
        { signal: controller.signal },
      )
        .then((data) => {
          if (controller.signal.aborted) return;
          const items = Array.isArray(data) ? data : (data.items ?? []);
          setOptions(
            items.map((account) => ({
              value: String(account.accountCode),
              label: `${account.accountCode} - ${account.accountName}`,
              name: String(account.accountName),
            })),
          );
          setHighlighted(0);
        })
        .catch(() => {
          if (!controller.signal.aborted) setOptions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query, companyId, token]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.children[highlighted] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open]);

  function select(option: AccountOption) {
    if (loading || blocked.has(option.value)) return;
    onChange(option.value, option.name);
    setOpen(false);
    setQuery('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((current) =>
        Math.max(0, Math.min(current + 1, availableOptions.length - 1)),
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (availableOptions[highlighted]) select(availableOptions[highlighted]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  const displayValue = open ? query : selectedLabel;

  return (
    <div className="combobox" ref={containerRef}>
      <div
        className={`combobox-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(true)}
      >
        <Search size={13} className="combobox-search-icon" />
        <input
          className="combobox-input"
          value={displayValue}
          placeholder="Search account code or name…"
          readOnly={!open}
          aria-expanded={open}
          aria-autocomplete="list"
          onFocus={() => setOpen(true)}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        {value && !open ? (
          <button
            type="button"
            className="combobox-clear"
            aria-label="Clear account"
            onPointerDown={(event) => {
              event.stopPropagation();
              onChange('', '');
            }}
          >
            <X size={12} />
          </button>
        ) : (
          <ChevronDown
            size={13}
            className={`combobox-chevron ${open ? 'flipped' : ''}`}
          />
        )}
      </div>
      {open && (
        <ul className="combobox-list" ref={listRef} role="listbox">
          {loading ? (
            <li className="combobox-empty">Loading…</li>
          ) : availableOptions.length === 0 ? (
            <li className="combobox-empty">No posting accounts match</li>
          ) : (
            availableOptions.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={`combobox-option ${option.value === value ? 'selected' : ''} ${index === highlighted ? 'highlighted' : ''}`}
                onPointerDown={(event) => {
                  event.preventDefault();
                  select(option);
                }}
              >
                {option.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
