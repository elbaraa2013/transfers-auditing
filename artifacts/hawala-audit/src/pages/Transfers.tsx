import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListTransfers, 
  getListTransfersQueryKey,
  useListAgents,
  useApproveTransfer,
  useRejectTransfer,
  useChangeTransferAgent,
  TransferStatus,
  TransferRiskLevel,
  ListTransfersStatus
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Check, X, Lock, Search, Printer, ArrowRightLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Transfers() {
  const [status, setStatus] = useState<ListTransfersStatus | undefined>(undefined);
  const [agentId, setAgentId] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [changeAgentFor, setChangeAgentFor] = useState<number | null>(null);
  const [changeAgentTarget, setChangeAgentTarget] = useState<string>("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params: Record<string, unknown> = {};
  if (status) params.status = status;
  if (agentId) params.agentId = agentId;
  if (search) params.search = search;

  const { data: transfers, isLoading } = useListTransfers(
    Object.keys(params).length > 0 ? params as Parameters<typeof useListTransfers>[0] : undefined
  );
  const { data: agents } = useListAgents();

  const approveMutation = useApproveTransfer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTransfersQueryKey() });
        toast({ title: "تم الاعتماد", description: "تم اعتماد الحوالة بنجاح" });
      },
      onError: (err: any) => {
        toast({ title: "خطأ", description: err?.message || "حدث خطأ أثناء الاعتماد", variant: "destructive" });
      }
    }
  });

  const rejectMutation = useRejectTransfer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTransfersQueryKey() });
        toast({ title: "تم الرفض", description: "تم رفض الحوالة بنجاح" });
        setRejectId(null);
        setRejectReason("");
      },
      onError: (err: any) => {
        toast({ title: "خطأ", description: err?.message || "حدث خطأ أثناء الرفض", variant: "destructive" });
      }
    }
  });

  const changeAgentMutation = useChangeTransferAgent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTransfersQueryKey() });
        toast({ title: "تم التغيير", description: "تم تغيير المندوب بنجاح" });
        setChangeAgentFor(null);
        setChangeAgentTarget("");
      },
      onError: (err: any) => {
        toast({ title: "خطأ", description: err?.message || "تعذّر تغيير المندوب", variant: "destructive" });
      }
    }
  });

  const handleApprove = (id: number) => {
    approveMutation.mutate({ id });
  };

  const handleConfirmChangeAgent = () => {
    if (changeAgentFor && changeAgentTarget) {
      changeAgentMutation.mutate({ id: changeAgentFor, data: { agentId: parseInt(changeAgentTarget) } });
    }
  };

  const handleReject = () => {
    if (rejectId) {
      rejectMutation.mutate({ id: rejectId, data: { reason: rejectReason } });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case TransferStatus.approved: return <Badge className="bg-[#16A34A]">معتمد</Badge>;
      case TransferStatus.pending: return <Badge className="bg-[#D97706]">معلق</Badge>;
      case TransferStatus.rejected: return <Badge className="bg-[#DC2626]">مرفوض</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case TransferRiskLevel.low: return <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">منخفض</Badge>;
      case TransferRiskLevel.medium: return <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">متوسط</Badge>;
      case TransferRiskLevel.high: return <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50">عالي</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 print-area">
      <div className="flex flex-col md:flex-row gap-4 items-end no-print">
        <div className="flex-1 w-full relative">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-500" />
          <Input 
            placeholder="بحث برقم العملية أو المرسل إليه..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-3 pr-10"
          />
        </div>
        <div className="w-full md:w-64">
          <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? undefined : v as ListTransfersStatus)}>
            <SelectTrigger>
              <SelectValue placeholder="كل الحالات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value={TransferStatus.pending}>معلق</SelectItem>
              <SelectItem value={TransferStatus.approved}>معتمد</SelectItem>
              <SelectItem value={TransferStatus.rejected}>مرفوض</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-64">
          <Select value={agentId?.toString() || "all"} onValueChange={(v) => setAgentId(v === "all" ? undefined : parseInt(v))}>
            <SelectTrigger>
              <SelectValue placeholder="كل المناديب" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المناديب</SelectItem>
              {agents?.map(a => (
                <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="w-full md:w-auto flex-shrink-0">
          <Printer className="w-4 h-4 ml-2" /> طباعة
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border border-gray-200">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="text-right">رقم العملية</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">المندوب</TableHead>
                  <TableHead className="text-right">المرسل إليه</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-center">المخاطرة</TableHead>
                  <TableHead className="text-center">الحالة</TableHead>
                  <TableHead className="text-center no-print">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-16 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-16 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24 mx-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : transfers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">لا توجد حوالات تطابق البحث</TableCell>
                  </TableRow>
                ) : (
                  transfers?.map((transfer) => (
                    <TableRow key={transfer.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium font-mono text-sm">{transfer.operationNumber}</TableCell>
                      <TableCell>{formatDate(transfer.createdAt)}</TableCell>
                      <TableCell>{transfer.agentName}</TableCell>
                      <TableCell>{transfer.recipientName || "—"}</TableCell>
                      <TableCell className="font-bold">{formatCurrency(transfer.amount)}</TableCell>
                      <TableCell className="text-center">{getRiskBadge(transfer.riskLevel)}</TableCell>
                      <TableCell className="text-center">{getStatusBadge(transfer.status)}</TableCell>
                      <TableCell className="text-center no-print">
                        {transfer.status === TransferStatus.pending ? (
                          <div className="flex items-center justify-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-green-700 hover:text-green-800 hover:bg-green-50 border-green-200"
                              onClick={() => handleApprove(transfer.id)}
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                            >
                              <Check className="w-4 h-4 mr-1" /> اعتماد
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-red-700 hover:text-red-800 hover:bg-red-50 border-red-200"
                              onClick={() => setRejectId(transfer.id)}
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                            >
                              <X className="w-4 h-4 mr-1" /> رفض
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => { setChangeAgentFor(transfer.id); setChangeAgentTarget(""); }}
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                              title="تغيير المندوب"
                            >
                              <ArrowRightLeft className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : transfer.status === TransferStatus.approved ? (
                          <div className="flex items-center justify-center text-gray-400">
                            <Lock className="w-4 h-4" />
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!rejectId} onOpenChange={(open) => !open && setRejectId(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>رفض الحوالة</DialogTitle>
            <DialogDescription>
              يرجى توضيح سبب رفض هذه الحوالة.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="اكتب سبب الرفض هنا..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending || !rejectReason.trim()}>
              تأكيد الرفض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!changeAgentFor} onOpenChange={(open) => !open && setChangeAgentFor(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تغيير المندوب</DialogTitle>
            <DialogDescription>
              اختر المندوب الجديد لهذه الحوالة. يمكن التغيير قبل الاعتماد فقط.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={changeAgentTarget} onValueChange={setChangeAgentTarget}>
              <SelectTrigger>
                <SelectValue placeholder="اختر المندوب الجديد..." />
              </SelectTrigger>
              <SelectContent>
                {agents?.map(a => (
                  <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeAgentFor(null)}>إلغاء</Button>
            <Button
              className="bg-[#0F6E56] hover:bg-[#0b5341]"
              onClick={handleConfirmChangeAgent}
              disabled={changeAgentMutation.isPending || !changeAgentTarget}
            >
              تأكيد التغيير
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}