"use client";

import { useState } from "react";
import { inputCls } from "@/components/admin/AdminShell";

export type DialogField = {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "textarea";
  value?: string;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
};

export type DialogSpec = {
  title: string;
  description?: string;
  fields: DialogField[];
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (values: Record<string, string>) => Promise<void>;
};

/** One small modal for every admin action, instead of browser prompts. */
export default function ActionDialog({
  spec,
  onClose,
}: {
  spec: DialogSpec;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(spec.fields.map((f) => [f.name, f.value ?? ""]))
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const f of spec.fields) {
      if (f.required && !values[f.name]?.trim()) {
        setError(`${f.label} is required.`);
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      await spec.onConfirm(values);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest-ink/40 p-4"
      onClick={busy ? undefined : onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold text-forest-ink">{spec.title}</h2>
        {spec.description && (
          <p className="mt-1 text-sm text-forest-ink/60">{spec.description}</p>
        )}
        <div className="mt-4 space-y-3">
          {spec.fields.map((f) => (
            <label key={f.name} className="block text-sm font-semibold text-forest-ink">
              {f.label}
              {f.type === "select" ? (
                <select
                  value={values[f.name]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.name]: e.target.value }))
                  }
                  className={`${inputCls} mt-1`}
                >
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  rows={3}
                  value={values[f.name]}
                  placeholder={f.placeholder}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.name]: e.target.value }))
                  }
                  className={`${inputCls} mt-1 resize-none`}
                />
              ) : (
                <input
                  type={f.type}
                  step={f.type === "number" ? "0.01" : undefined}
                  min={f.type === "number" ? 0 : undefined}
                  value={values[f.name]}
                  placeholder={f.placeholder}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.name]: e.target.value }))
                  }
                  className={`${inputCls} mt-1`}
                />
              )}
            </label>
          ))}
        </div>
        {error && (
          <p className="mt-3 text-sm font-medium text-bengal-red">{error}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full border border-sand px-4 py-2 text-sm font-semibold text-forest-ink/70"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className={`rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
              spec.danger ? "bg-bengal-red" : "bg-forest"
            }`}
          >
            {busy ? "Working..." : spec.confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
