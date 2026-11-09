import { useEffect, useId, useRef, type ReactNode } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  isSubmitting?: boolean;
  confirmDisabled?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "primary",
  isSubmitting = false,
  confirmDisabled = false,
  error,
  onCancel,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function handleClose() {
    if (open && !isSubmitting) onCancel();
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby={titleId}
      onClose={handleClose}
    >
      <div className="dialog-symbol" aria-hidden="true">!</div>
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        {children}
        {error && <p className="form-message form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isSubmitting}>
            Annuler
          </button>
          <button type="submit" className={tone === "danger" ? "danger-button" : "primary-button"} disabled={isSubmitting || confirmDisabled}>
            {isSubmitting ? "Enregistrement…" : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
