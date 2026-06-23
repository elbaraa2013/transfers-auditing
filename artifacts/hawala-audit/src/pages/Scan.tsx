import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useScanTransferImage, 
  useCreateTransfer,
  useListAgents,
  getListTransfersQueryKey,
  getListPendingTransfersQueryKey,
  ScanResult
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { UploadCloud, Image as ImageIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function Scan() {
  const [isDragging, setIsDragging] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<number | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: agents } = useListAgents();

  const scanMutation = useScanTransferImage({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
        setErrorMsg(null);
        toast({ title: "نجاح", description: "تم تحليل الصورة بنجاح" });
      },
      onError: (error: any) => {
        setErrorMsg(error?.message || "فشل الاتصال بخدمة التحليل");
        setResult(null);
        toast({ title: "خطأ في التحليل", description: error?.message || "فشل الاتصال بخدمة التحليل", variant: "destructive" });
      }
    }
  });

  const createMutation = useCreateTransfer({
    mutation: {
      onSuccess: () => {
        toast({ title: "تم التسجيل", description: "تم تسجيل الحوالة بنجاح" });
        setShowCreateDialog(false);
        setResult(null);
        setImage(null);
        setSelectedAgentId(undefined);
        queryClient.invalidateQueries({ queryKey: getListTransfersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListPendingTransfersQueryKey() });
      },
      onError: (error: any) => {
        toast({ title: "خطأ", description: error?.message || "فشل تسجيل الحوالة", variant: "destructive" });
      }
    }
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: "خطأ", description: "الرجاء رفع صورة صالحة", variant: "destructive" });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setImage(base64);
      setResult(null);
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleScan = () => {
    if (image) {
      // Typically need to remove the data:image/png;base64, prefix if API expects pure base64
      const base64Data = image.split(',')[1];
      scanMutation.mutate({ data: { imageBase64: base64Data } });
    }
  };

  const missingFields = result
    ? [
        !result.operationNumber && "رقم العملية",
        result.amount == null && "المبلغ",
        !result.fromAccount && "من حساب",
        !result.toAccount && "إلى حساب",
        !result.recipientName && "المرسل إليه",
      ].filter(Boolean) as string[]
    : [];

  const handleCreate = () => {
    if (
      result &&
      selectedAgentId &&
      result.operationNumber &&
      result.amount != null &&
      result.fromAccount &&
      result.toAccount &&
      result.recipientName
    ) {
      createMutation.mutate({
        data: {
          operationNumber: result.operationNumber,
          amount: result.amount,
          fromAccount: result.fromAccount,
          toAccount: result.toAccount,
          recipientName: result.recipientName,
          comment: result.comment || undefined,
          agentId: selectedAgentId,
          riskScore: result.riskScore,
          transferDate: result.transferDate ?? undefined
        }
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>رفع إيصال الحوالة</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {!image ? (
              <div 
                className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center h-64 text-center cursor-pointer transition-colors ${
                  isDragging ? 'border-[#0F6E56] bg-emerald-50' : 'border-gray-300 hover:bg-gray-50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileInput} 
                />
                <UploadCloud className="w-12 h-12 text-gray-400 mb-4" />
                <p className="text-sm font-medium text-gray-700 mb-1">اسحب وأفلت الصورة هنا</p>
                <p className="text-xs text-gray-500">أو انقر لاختيار ملف</p>
              </div>
            ) : (
              <div className="relative border rounded-lg overflow-hidden h-64 bg-gray-50 flex items-center justify-center">
                <img src={image} alt="إيصال" className="max-h-full max-w-full object-contain" />
                <div className="absolute top-2 right-2">
                  <Button size="sm" variant="secondary" onClick={() => { setImage(null); setResult(null); }}>
                    تغيير الصورة
                  </Button>
                </div>
              </div>
            )}
            
            {errorMsg && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2 text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="text-sm font-medium">{errorMsg}</div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full bg-[#0F6E56] hover:bg-[#0b5341]" 
              disabled={!image || scanMutation.isPending}
              onClick={handleScan}
            >
              {scanMutation.isPending ? "جاري التحليل..." : "مسح الصورة واستخراج البيانات"}
            </Button>
          </CardFooter>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>نتيجة التحليل</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center">
            {scanMutation.isPending ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div className="w-12 h-12 border-4 border-[#0F6E56] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-gray-500">جارٍ مسح الصورة واستخراج البيانات...</p>
              </div>
            ) : result ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#16A34A]">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-semibold">اكتمل الاستخراج</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">نسبة الثقة</span>
                    <div className="w-24">
                      <Progress value={result.confidence * 100} className="h-2" />
                    </div>
                    <span className="text-xs font-bold">{Math.round(result.confidence * 100)}%</span>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">رقم العملية</span>
                    <span className="font-mono font-medium">{result.operationNumber}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">المبلغ</span>
                    <span className="font-bold">{result.amount != null ? formatCurrency(result.amount) : "—"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">المرسل إليه</span>
                    <span className="font-medium">{result.recipientName}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">من حساب</span>
                    <span className="font-medium">{result.fromAccount}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">إلى حساب</span>
                    <span className="font-medium">{result.toAccount}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">التاريخ</span>
                    <span className="font-medium">{result.transferDate ? formatDateTime(result.transferDate) : "—"}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-gray-500">مستوى المخاطرة</span>
                    <span>
                      {result.riskScore < 0.3 ? (
                        <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200">منخفض</Badge>
                      ) : result.riskScore < 0.7 ? (
                        <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">متوسط</Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-700 bg-red-50 border-red-200">عالي</Badge>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
                <p>النتائج ستظهر هنا بعد التحليل</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-2">
            {result && missingFields.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2 text-amber-800 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  تعذّر قراءة بعض الحقول الإلزامية: {missingFields.join("، ")}. يرجى استخدام صورة أوضح.
                </div>
              </div>
            )}
            <Button 
              className="w-full bg-[#16A34A] hover:bg-[#15803d]" 
              disabled={!result || missingFields.length > 0}
              onClick={() => setShowCreateDialog(true)}
            >
              تسجيل الحوالة
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تسجيل الحوالة باسم مندوب</DialogTitle>
            <DialogDescription>
              الرجاء اختيار المندوب الذي قام بهذه الحوالة لإضافتها إلى حسابه.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>اختر المندوب</Label>
              <Select value={selectedAgentId?.toString()} onValueChange={(v) => setSelectedAgentId(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر مندوباً..." />
                </SelectTrigger>
                <SelectContent>
                  {agents?.map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>إلغاء</Button>
            <Button className="bg-[#16A34A] hover:bg-[#15803d]" onClick={handleCreate} disabled={!selectedAgentId || createMutation.isPending}>
              تأكيد التسجيل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}