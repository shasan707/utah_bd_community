import { EXPORT_COLUMNS, type RegistrationRow } from "@/lib/payments/types";

/** Same columns and order as the old Registrations sheet, so exports line up. */
export function registrationsCsv(rows: RegistrationRow[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [EXPORT_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(
      EXPORT_COLUMNS.map((c) => {
        const v = r[c];
        if (typeof v === "boolean") return esc(v ? "yes" : "no");
        return esc(v);
      }).join(",")
    );
  }
  return lines.join("\n");
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
