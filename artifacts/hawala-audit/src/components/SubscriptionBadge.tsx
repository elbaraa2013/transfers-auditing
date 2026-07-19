import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
type SubInfo = {
  plan: "trial" | "paid";
  scanLimit: number;
  scansUsed: number;
  remaining: number;
  expiresAt: string | null;
  active: boolean;
};
async function fetchSub(): Promise<SubInfo> {
  const res = await fetch("/api/subscription/me", { credentials: "include" });
  if (!res.ok) throw new Error("failed");
  return res.json();
}
export default function SubscriptionBadge() {
  const { data } = useQuery({
    queryKey: ["subscription-me"],
    queryFn: fetchSub,
    refetchInterval: 60_000,
  });
  if (!data) return null;
  const pct = data.scanLimit ? Math.min(100, Math.round((data.scansUsed / data.scanLimit) * 100)) : 0;
  const low = data.active && data.remaining <= Math.max(3, data.scanLimit * 0.1);
  const expired = !data.active;
  const expiry = data.expiresAt
    ? new Date(data.expiresAt).toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric" })
    : null;
  return (
    <div
      dir="rtl"
      className={cn(
        "fixed bottom-3 left-3 z-40 w-60 rounded-xl border bg-white px-4 py-3 text-sm shadow-md",
        expired ? "border-red-400" : low ? "border-orange-400" : "border-gray-200",
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-semibold">
          {data.plan === "paid" ? "الاشتراك: مدفوع" : "الاشتراك: تجريبي"}
        </span>
        <span className={cn("text-xs", expired ? "text-red-600" : low ? "text-orange-600" : "text-gray-500")}>
          {data.remaining} متبقية
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn("h-full rounded-full", expired ? "bg-red-500" : low ? "bg-orange-500" : "bg-emerald-500")}
          style={{ width: pct + "%" }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
        <span>
          {data.scansUsed} / {data.scanLimit} مسحة
        </span>
        {expiry ? <span>ينتهي: {expiry}</span> : null}
      </div>
      {expired ? (
        <p className="mt-2 text-xs font-medium text-red-600">
          انتهى اشتراكك — للتجديد (150 درهم / 2,000 مسحة أو شهر) تواصل مع الإدارة.
        </p>
      ) : null}
    </div>
  );
}
