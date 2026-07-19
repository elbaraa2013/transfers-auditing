import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
type Row = {
  ownerId: string;
  email: string | null;
  plan: "trial" | "paid" | null;
  scansUsed: number;
  scanLimit: number;
  expiresAt: string | null;
  active: boolean;
};
async function fetchRows(): Promise<Row[]> {
  const res = await fetch("/api/admin/subscriptions", { credentials: "include" });
  if (res.status === 403) throw new Error("forbidden");
  if (!res.ok) throw new Error("failed");
  return res.json();
}
export default function AdminSubscriptions() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: fetchRows,
    retry: false,
  });
  const activate = useMutation({
    mutationFn: async (ownerId: string) => {
      const res = await fetch("/api/admin/subscriptions/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ownerId }),
      });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم تفعيل الاشتراك المدفوع (2,000 مسحة / 30 يوماً)" });
      void qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      void qc.invalidateQueries({ queryKey: ["subscription-me"] });
    },
    onError: () => toast({ title: "فشل التفعيل", variant: "destructive" }),
  });
  if (isLoading) return <div className="p-8 text-center">جاري التحميل...</div>;
  if (error)
    return (
      <div className="p-8 text-center text-red-600">
        غير مصرح لك بالوصول لهذه الصفحة.
      </div>
    );
  return (
    <div dir="rtl" className="p-6">
      <h1 className="mb-1 text-2xl font-bold">إدارة الاشتراكات</h1>
      <p className="mb-6 text-sm text-gray-500">
        الاشتراك المدفوع: 150 درهم — 2,000 مسحة أو 30 يوماً، أيهما ينتهي أولاً.
      </p>
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-right text-gray-600">
              <th className="p-3">الحساب</th>
              <th className="p-3">الخطة</th>
              <th className="p-3">الاستهلاك</th>
              <th className="p-3">ينتهي في</th>
              <th className="p-3">الحالة</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((row) => (
              <tr key={row.ownerId} className="border-b last:border-0">
                <td className="p-3">
                  <div className="font-medium">{row.email ?? "بدون بريد"}</div>
                  <div className="text-xs text-gray-400" dir="ltr">
                    {row.ownerId}
                  </div>
                </td>
                <td className="p-3">
                  {row.plan === "paid" ? "مدفوع" : row.plan === "trial" ? "تجريبي" : "—"}
                </td>
                <td className="p-3">
                  {row.scansUsed} / {row.scanLimit}
                </td>
                <td className="p-3">
                  {row.expiresAt
                    ? new Date(row.expiresAt).toLocaleDateString("ar", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "—"}
                </td>
                <td className="p-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-xs font-medium",
                      row.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
                    )}
                  >
                    {row.active ? "نشط" : "منتهي"}
                  </span>
                </td>
                <td className="p-3">
                  <button
                    className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                    disabled={activate.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          "تفعيل اشتراك مدفوع (150 درهم — 2,000 مسحة / 30 يوماً) لهذا الحساب؟ تأكد من استلام المبلغ أولاً.",
                        )
                      ) {
                        activate.mutate(row.ownerId);
                      }
                    }}
                  >
                    تفعيل اشتراك مدفوع
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
