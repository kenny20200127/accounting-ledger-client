import { Trash2, X } from 'lucide-react';
import { singular } from '../../lib/format';

type DeleteRecordDialogProps = {
  title: string;
  label: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteRecordDialog({
  title,
  label,
  busy,
  onCancel,
  onConfirm,
}: DeleteRecordDialogProps) {
  return (
    <div
      className="modal-bg"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-record-title"
      >
        <div className="modal-head">
          <div>
            <small className="eyebrow">DELETE RECORD</small>
            <h2 id="delete-record-title">
              {`Delete ${label || `this ${singular(title).toLowerCase()}`}?`}
            </h2>
            <p className="modal-note">
              This cannot be undone. Records that are still referenced by other
              entries cannot be deleted.
            </p>
          </div>
          <button className="row-open" onClick={onCancel} aria-label="Close">
            <X size={17} />
          </button>
        </div>
        <div className="modal-actions">
          <button className="btn btn-light" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-danger" disabled={busy} onClick={onConfirm}>
            <Trash2 size={15} />
            Delete record
          </button>
        </div>
      </section>
    </div>
  );
}
