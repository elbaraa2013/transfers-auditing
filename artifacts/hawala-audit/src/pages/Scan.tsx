import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useScanTransferImage,
  useCreateTransfer,
  useListAgents,
  getListTransfersQueryKey,
  getListPendingTransfersQueryKey,
  getListAgentsQueryKey,
  ScanResult,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { UploadCloud, Image as ImageIcon, AlertCircle, CheckCircle2, X, ScanLine, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ItemStatus = "queued" | "scanning" | "scanned" | "registering" | "registered" | "error";

interface ScanItem {
  id: string;
  image: string;
  agentId: number;
  agentName: string;
  result: ScanResult | null;
  status: ItemStatus;
  errorMsg: string | null;
}

function missingFieldsOf(result: ScanResult | null): string[] {
  if (!result) return [];
  return [
    !result.operationNumber && "رقم العملية",
    result.amount == null && "المبلغ",
  ].filter(Boolean) as string[];
}

export default function Scan() {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<number | undefined>();
  const [items, setItems] = useState<ScanItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: agents } = useListAgents();
  const scanMutation = useScanTransferImage();
  const createMutation = useCreateTransfer();

  const agentSelected = selectedAgentId != null;
  const selectedAgentName = agents?.find((a) => a.id === selectedAgentId)?.name;

  const patchItem = (id: string, patch: Partial<ScanItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const setField = (
    id: string,
    key: "recipientName" | "fromAccount" | "toAccount",
    value: string,
  ) =>
    setItems((prev) =>
      prev.map((it) =>
        it.id === id && it.result
          ? { ...it, result: { ...it.result, [key]: value || null } }
          : it,
      ),
    );

  const addFiles = (files: FileList | File[]) => {
    if (selectedAgentId == null) return;
    const agentId = selectedAgentId;
    const agentName = selectedAgentName ?? "";
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      toast({ title: "خطأ", description: "الرجاء رفع صور صالحة", variant: "destructive" });
      return;
    }
    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setItems((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            image: base64,
            agentId,
            agentName,
            result: null,
            status: "queued",
            errorMsg: null,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!agentSelected) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    e.target.value = "";
  };

  const scanItem = async (item: ScanItem) => {
    const base64Data = item.image.split(",")[1];
    patchItem(item.id, { status: "scanning", errorMsg: null });
    try {
      const data = await scanMutation.mutateAsync({ data: { imageBase64: base64Data } });
      patchItem(item.id, { result: data, status: "scanned" });
    } catch (error: any) {
      patchItem(item.id, { status: "error", errorMsg: error?.message || "فشل الاتصال بخدمة التحليل" });
    }
  };

  const scanAll = async () => {
    const queued = items.filter((it) => it.status === "queued" || it.status === "error");
    for (const it of queued) {
      await scanItem(it);
    }
    toast({ title: "اكتمل المسح", description: `تمت معالجة ${queued.length} صورة` });
  };

  const invalidateTransferQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListTransfersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListPendingTransfersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
  };

  const registerItem = async (item: ScanItem): Promise<boolean> => {
    const r = item.result;
    if (
      !r ||
      !r.operationNumber ||
      r.amount == null
    ) {
      return false;
    }
    patchItem(item.id, { status: "registering" });
    try {
      await createMutation.mutateAsync({
        data: {
          operationNumber: r.operationNumber,
          amount: r.amount,
          fromAccount: r.fromAccount?.trim() || undefined,
          toAccount: r.toAccount?.trim() || undefined,
          recipientName: r.recipientName?.trim() || undefined,
          comment: r.comment || undefined,
          agentId: item.agentId,
          riskScore: r.riskScore,
          transferDate: r.transferDate ?? undefined,
        },
      });
      patchItem(item.id, { status: "registered" });
      return true;
    } catch (error: any) {
      patchItem(item.id, { status: "scanned", errorMsg: error?.message || "فشل تسجيل الحوالة" });
      toast({ title: "خطأ", description: error?.message || "فشل تسجيل الحوالة", variant: "destructive" });
      return false;
    }
  };

  const registerItemAndRefresh = async (item: ScanItem) => {
    const ok = await registerItem(item);
    if (ok) invalidateTransferQueries();
  };

  const registerAll = async () => {
    const ready = items.filter((it) => it.status === "scanned" && missingFieldsOf(it.result).length === 0);
    let success = 0;
    for (const it of ready) {
      if (await registerItem(it)) success++;
    }
    if (success > 0) invalidateTransferQueries();
    const failed = ready.length - success;
    toast({
      title: failed > 0 ? "اكتمل التسجيل مع أخطاء" : "تم التسجيل",
      description:
        failed > 0
          ? `تم تسجيل ${success} حوالة، وفشل ${failed}`
          : `تم تسجيل ${success} حوالة بنجاح`,
      variant: failed > 0 ? "destructive" : undefined,
    });
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));

  const queuedCount = items.filter((it) => it.status === "queued" || it.status === "error").length;
  const readyCount = items.filter((it) => it.status === "scanned" && missingFieldsOf(it.result).length === 0).length;
  const isBusy = scanMutation.isPending || createMutation.isPending;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Step 1: choose agent */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#1C1A17] text-white text-sm">1</span>
            اختيار المندوب
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-sm">
            <Label>المندوب الذي قام بهذه الحوالات</Label>
            <Select value={selectedAgentId?.toString()} onValueChange={(v) => setSelectedAgentId(parseInt(v))}>
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
            {!agentSelected && (
              <p className="text-xs text-amber-600">اختر المندوب أولاً ليتم تفعيل رفع الصور.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: upload images */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#1C1A17] text-white text-sm">2</span>
            رفع إيصالات الحوالة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center h-44 text-center transition-colors ${
              !agentSelected
                ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                : isDragging
                ? "border-[#A6791E] bg-[#FAF4E3] cursor-pointer"
                : "border-gray-300 hover:bg-gray-50 cursor-pointer"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              if (agentSelected) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => agentSelected && fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              multiple
              onChange={handleFileInput}
              disabled={!agentSelected}
            />
            <UploadCloud className="w-10 h-10 text-gray-400 mb-3" />
            <p className="text-sm font-medium text-gray-700 mb-1">اسحب وأفلت عدة صور هنا</p>
            <p className="text-xs text-gray-500">أو انقر لاختيار ملفات متعددة (يمكن تحديد أكثر من صورة)</p>
          </div>

          {items.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                className="bg-[#1C1A17] hover:bg-[#33302A]"
                onClick={scanAll}
                disabled={queuedCount === 0 || isBusy}
              >
                {scanMutation.isPending ? (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                ) : (
                  <ScanLine className="w-4 h-4 ml-2" />
                )}
                مسح الكل ({queuedCount})
              </Button>
              <Button
                className="bg-[#C9A227] hover:bg-[#B8902F] text-[#1C1A17]"
                onClick={registerAll}
                disabled={readyCount === 0 || isBusy}
              >
                <CheckCircle2 className="w-4 h-4 ml-2" />
                تسجيل الكل ({readyCount})
              </Button>
              <span className="text-sm text-gray-500">{items.length} صورة في القائمة</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3: results list */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center text-gray-400 py-12">
          <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
          <p>لم يتم رفع أي صور بعد</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const missing = missingFieldsOf(item.result);
            return (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative w-full sm:w-40 h-32 flex-shrink-0 rounded-lg overflow-hidden bg-gray-50 border flex items-center justify-center">
                      <img src={item.image} alt="إيصال" className="max-h-full max-w-full object-contain" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={item.status} />
                          <span className="text-xs text-gray-500">المندوب: {item.agentName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {(item.status === "queued" || item.status === "error" || item.status === "scanned") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => scanItem(item)}
                              disabled={isBusy}
                            >
                              <ScanLine className="w-3.5 h-3.5 ml-1" />
                              {item.status === "scanned" ? "إعادة المسح" : "مسح"}
                            </Button>
                          )}
                          {item.status === "scanned" && missing.length === 0 && (
                            <Button
                              size="sm"
                              className="bg-[#C9A227] hover:bg-[#B8902F] text-[#1C1A17]"
                              onClick={() => registerItemAndRefresh(item)}
                              disabled={isBusy}
                            >
                              تسجيل
                            </Button>
                          )}
                          {item.status !== "registering" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-gray-400 hover:text-red-600"
                              onClick={() => removeItem(item.id)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {item.errorMsg && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded-md flex items-start gap-2 text-red-700 text-sm mb-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>{item.errorMsg}</span>
                        </div>
                      )}

                      {item.result ? (
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                          <Field label="رقم العملية" value={item.result.operationNumber} mono />
                          <Field
                            label="المبلغ"
                            value={item.result.amount != null ? formatCurrency(item.result.amount) : null}
                          />
                          <EditableField
                            label="المرسل إليه"
                            value={item.result.recipientName}
                            onChange={(v) => setField(item.id, "recipientName", v)}
                            disabled={item.status === "registering" || item.status === "registered"}
                          />
                          <EditableField
                            label="من حساب"
                            value={item.result.fromAccount}
                            onChange={(v) => setField(item.id, "fromAccount", v)}
                            placeholder="اكتب الحساب يدوياً..."
                            disabled={item.status === "registering" || item.status === "registered"}
                          />
                          <EditableField
                            label="إلى حساب"
                            value={item.result.toAccount}
                            onChange={(v) => setField(item.id, "toAccount", v)}
                            placeholder="اكتب الحساب يدوياً..."
                            disabled={item.status === "registering" || item.status === "registered"}
                          />
                          <Field
                            label="التاريخ"
                            value={item.result.transferDate ? formatDateTime(item.result.transferDate) : null}
                          />
                        </div>
                      ) : item.status === "scanning" ? (
                        <div className="flex items-center gap-2 text-gray-500 text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          جارٍ مسح الصورة واستخراج البيانات...
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">بانتظار المسح</p>
                      )}

                      {item.result && missing.length > 0 && (
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2 text-amber-800 text-xs">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>تعذّر قراءة حقول إلزامية: {missing.join("، ")}. يرجى استخدام صورة أوضح.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  disabled,
  placeholder = "اكتب الاسم يدوياً...",
}: {
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex justify-between items-center gap-2 border-b border-gray-100 pb-1">
      <span className="text-gray-500 flex-shrink-0">{label}</span>
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="font-medium text-right outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-[#A6791E] min-w-0 flex-1 text-sm placeholder:text-gray-300 placeholder:font-normal disabled:border-transparent"
      />
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex justify-between border-b border-gray-100 pb-1">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium ${mono ? "font-mono" : ""} ${!value ? "text-gray-300" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: ItemStatus }) {
  switch (status) {
    case "queued":
      return <Badge variant="outline" className="text-gray-600 bg-gray-50 border-gray-200">بانتظار المسح</Badge>;
    case "scanning":
      return <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200">جارٍ المسح</Badge>;
    case "scanned":
      return <Badge variant="outline" className="text-[#8A6718] bg-[#FAF4E3] border-[#E8D9A8]">تم المسح</Badge>;
    case "registering":
      return <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200">جارٍ التسجيل</Badge>;
    case "registered":
      return <Badge variant="outline" className="text-[#8A6718] bg-[#FAF4E3] border-[#E8D9A8]">تم التسجيل</Badge>;
    case "error":
      return <Badge variant="outline" className="text-red-700 bg-red-50 border-red-200">خطأ</Badge>;
  }
}
