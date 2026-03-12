"use client";

import { useState } from "react";

type ConfirmDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  triggerLabel: string;
  onConfirm: () => Promise<void> | void;
  variant?: "primary" | "danger";
};

export default function ConfirmDialog({
  title,
  description,
  confirmLabel,
  triggerLabel,
  onConfirm,
  variant = "primary",
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const buttonClass =
    variant === "danger"
      ? "rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-rose-600 hover:bg-rose-50"
      : "rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-600 hover:bg-blue-50";

  return (
    <>
      <button type="button" className={buttonClass} onClick={() => setOpen(true)}>
        {triggerLabel}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="mt-2 text-sm text-gray-500">{description}</p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gray-600"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Annuler
              </button>
              <button
                type="button"
                className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white disabled:opacity-60"
                onClick={handleConfirm}
                disabled={busy}
              >
                {busy ? "En cours" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
