import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateCashPayment,
  useListAgents,
  getListTransfersQueryKey,
  getListPendingTransfersQueryKey,
  getListAgentsQueryKey,
  getGetAgentsSummaryQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Banknote, Printer, CheckCircle2, Loader2 } from "lucide-react";

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

export default function CashPayment() {
  const [agentId, setAgentId] = useState<number | undefined>();
  const [amount, setAmount] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [comment, setComment] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayLocal());
  const [lastRef, setLastRef] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: agents } = useListAgents();
  const createCash = useCreateCashPayment();

  const agentName = agents?.find((a) => a.id === agentId)?.name ?? "";
  const numericAmount = Number(amount);
  const canSubmit = agentId != null && Number.isFinite(numericAmount) && numericAmount > 0;

  const resetForm = () => {
    setAmount("");
    setRecipientName("");
    setComment("");
    setPaymentDate(todayLocal());
  };

  const handleSubmit = () => {
    if (!canSubmit || agentId == null) return;
    createCash.mutate(
      {
        data: {
          agentId,
          amount: numericAmount,
          recipientName: recipientName.trim() || undefined,
          comment: comment.trim() || undefined,
          transferDate: paymentDate || undefined,
        },
      },
      {
        onSuccess: (created) => {
          queryClient.invalidateQueries({ queryKey: getListTransfersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListPendingTransfersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAgentsSummaryQueryKey() });
          setLastRef(created.operationNumber);
          toast({ title: "تم التسجيل", description: "تم تسجيل الدفعة النقدية بنجاح" });
          resetForm();
        },
        onError: (err: any) => {
          toast({ title: "خطأ", description: err?.message || "تعذّر تسجيل الدفعة النقدية", variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Form */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="w-6 h-6 text-[#A6791E]" />
            تسجيل دفعة نقدية
          </CardTitle>
          <CardDescription>
            سجّل دفعة نقدية يدوياً (بدون إيصال). تُحتسب ضمن إجمالي حوالات المندوب.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>المندوب</Label>
            <Select value={agentId?.toString()} onValueChange={(v) => setAgentId(parseInt(v))}>
              <SelectTrigger>
                <SelectValue placeholder="اختر مندوباً..." />
              </SelectTrigger>
              <SelectContent>
                {agents?.map((a) => (
                  <SelectItem key={a.id} value={a.id.toString()}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>المبلغ</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                dir="ltr"
                className="text-right"
              />
            </div>
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>المستلم</Label>
            <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="اسم المستلم (اختياري)" />
          </div>

          <div className="space-y-2">
            <Label>البيان</Label>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="بيان الدفعة (اختياري)" />
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              className="bg-[#1C1A17] hover:bg-[#33302A]"
              onClick={handleSubmit}
              disabled={!canSubmit || createCash.isPending}
            >
              {createCash.isPending ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 ml-2" />
              )}
              تسجيل الدفعة
            </Button>
            <Button variant="outline" onClick={() => window.print()} disabled={!canSubmit}>
              <Printer className="w-4 h-4 ml-2" /> طباعة
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Printable receipt */}
      <Card className="print-area">
        <CardHeader>
          <CardTitle className="text-center">إيصال دفعة نقدية</CardTitle>
          <CardDescription className="text-center">نظام تدقيق الحوالات</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-gray-200 divide-y divide-gray-100">
            <ReceiptRow label="المندوب" value={agentName || "—"} />
            <ReceiptRow label="المبلغ" value={canSubmit ? formatCurrency(numericAmount) : "—"} strong />
            <ReceiptRow label="المستلم" value={recipientName.trim() || "—"} />
            <ReceiptRow label="البيان" value={comment.trim() || "—"} />
            <ReceiptRow label="التاريخ" value={paymentDate || "—"} />
            <ReceiptRow label="طريقة الدفع" value="نقدي" />
            {lastRef && <ReceiptRow label="رقم المرجع" value={lastRef} mono />}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReceiptRow({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center px-4 py-3">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className={`text-right ${strong ? "font-bold text-[#A6791E] text-lg" : "font-medium"} ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
