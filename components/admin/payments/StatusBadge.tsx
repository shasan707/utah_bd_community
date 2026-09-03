import type { Status } from "@/lib/payments/types";

const styles: Record<Status, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-forest/10 text-forest",
  EXPIRED: "bg-stone-200 text-stone-700",
  CANCELLED: "bg-bengal-red/10 text-bengal-red",
  REFUNDED: "bg-bengal-red/10 text-bengal-red",
};

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide ${styles[status]}`}
    >
      {status}
    </span>
  );
}
