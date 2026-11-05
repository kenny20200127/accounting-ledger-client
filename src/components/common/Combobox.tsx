import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

type ComboboxOption = { value: string; label: string };

type ComboboxProps = {
  name: string;
  value: string;
  options: ComboboxOption[];
  loading: boolean;
  disabled: boolean;
  required?: boolean;
  placeholder: string;
  onChange: (value: string) => void;
};

export function Combobox({
  name,
  value,
  options,
  loading,
  disabled,
  required,
  placeholder,
  onChange,
}: ComboboxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedLabel = options.find((option) => option.value === value)?.label ?? '';

  // When closed, the input shows the selected label; when open it shows the query
  const displayValue = open ? query : selectedLabel;

  const filtered = query.trim()
    ? options.filter((option) =>
        option.label.toLowerCase().includes(query.toLowerCase()),
      )
    : options;

  // Keep highlight in bounds when the filtered list shrinks
  const safeHighlight = Math.min(highlighted, Math.max(filtered.length - 1, 0));

  function openList() {
    if (disabled || loading) return;
    setQuery('');
    setHighlighted(0);
    setOpen(true);
  }

  function select(option: ComboboxOption) {
    onChange(option.value);
    setOpen(false);
    setQuery('');
  }

  function clear() {
    onChange('');
    setQuery('');
    setOpen(false);
  }

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
    const item = listRef.current.children[safeHighlight] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [safeHighlight, open]);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((current) => Math.min(current + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (filtered[safeHighlight]) select(filtered[safeHighlight]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  return (
    <div className="combobox" ref={containerRef}>
      {/* Hidden input carries the real value for FormData */}
      <input type="hidden" name={name} value={value} />

      <div
        className={`combobox-trigger ${open ? 'open' : ''} ${disabled || loading ? 'disabled' : ''}`}
        onClick={openList}
      >
        <Search size={13} className="combobox-search-icon" />
        <input
          ref={inputRef}
          className="combobox-input"
          value={displayValue}
          placeholder={placeholder}
          readOnly={!open}
          disabled={disabled || loading}
          required={required && !value}
          aria-expanded={open}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          onFocus={openList}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlighted(0);
          }}
          onKeyDown={handleKeyDown}
        />
        {value && !disabled ? (
          <button
            type="button"
            className="combobox-clear"
            aria-label="Clear"
            onPointerDown={(event) => {
              event.stopPropagation();
              clear();
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
          ) : filtered.length === 0 ? (
            <li className="combobox-empty">No matches</li>
          ) : (
            filtered.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={`combobox-option ${option.value === value ? 'selected' : ''} ${index === safeHighlight ? 'highlighted' : ''}`}
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
