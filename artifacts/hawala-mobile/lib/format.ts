export function errMsg(e: unknown, fallback = "حدث خطأ غير متوقع"): string {
  const data = (e as { data?: { error?: string } } | null)?.data;
  if (data && typeof data.error === "string" && data.error.trim()) return data.error;
  return fallback;
}

export function fmtAmount(n: number): string {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ج.س`;
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric" });
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("ar", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const statusLabels: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "مقبولة",
  rejected: "مرفوضة",
};

export const statusColors: Record<string, string> = {
  pending: "#A6791E",
  approved: "#16a34a",
  rejected: "#ef4444",
};
