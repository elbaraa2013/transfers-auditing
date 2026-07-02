import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAgents,
  useGetAgentStatement,
  useApproveTransfer,
  useRejectTransfer,
  useCreateAgent,
  useUpdateAgent,
  useChangeTransferAgent,
  useDeleteTransfer,
  useGetAgentsSummary,
  getGetAgentStatementQueryKey,
  getGetAgentsSummaryQueryKey,
  getListAgentsQueryKey,
  TransferStatus,
  type Transfer
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Lock, UserPlus, Printer, ArrowRightLeft, Trash2, Users, Pencil } from "lucide-react";

// The date used for range filtering: prefer the (OCR-parsed / manually entered)
// transferDate when valid, otherwise fall back to the system createdAt. Computed
// as a UTC YYYY-MM-DD so it matches the server's /agents/summary date key
// exactly — statement and all-agents summaries must agree at date boundaries.
function ymdUTC(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function effectiveDateKey(t: Transfer): string {
  if (t.transferDate) {
    const parsed = new Date(t.transferDate);
    if (!isNaN(parsed.getTime())) return ymdUTC(parsed);
  }
  return ymdUTC(new Date(t.createdAt));
}

function computeSummary(transfers: Transfer[]) {
  const sum = (list: Transfer[]) => list.reduce((s, t) => s + Number(t.amount), 0);
  const approved = transfers.filter(t => t.status === TransferStatus.approved);
  const pending = transfers.filter(t => t.status === TransferStatus.pending);
  const rejected = transfers.filter(t => t.status === TransferStatus.rejected);
  return {
    totalCount: transfers.length,
    totalAmount: sum(transfers),
    approvedCount: approved.length,
    approvedAmount: sum(approved),
    pendingCount: pending.length,
    pendingAmount: sum(pending),
    rejectedCount: rejected.length,
    rejectedAmount: sum(rejected)
  };
}

export default function Statement() {
  const [selectedAgentId, setSelectedAgentId] = useState<number | undefined>();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [changeAgentFor, setChangeAgentFor] = useState<number | null>(null);
  const [changeAgentTarget, setChangeAgentTarget] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<Transfer | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [agentsFrom, setAgentsFrom] = useState("");
  const [agentsTo, setAgentsTo] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: agents } = useListAgents();
  const { data: statement, isLoading } = useGetAgentStatement(selectedAgentId!, {
    query: {
      enabled: !!selectedAgentId,
      queryKey: getGetAgentStatementQueryKey(selectedAgentId!)
    }
  });

  const agentsParams = { from: agentsFrom || undefined, to: agentsTo || undefined };
  const { data: agentsSummary, isLoading: summaryLoading } = useGetAgentsSummary(
    agentsParams,
    { query: { queryKey: getGetAgentsSummaryQueryKey(agentsParams) } }
  );
  const agentsFiltered = !!(agentsFrom || agentsTo);

  const filteredTransfers = useMemo(() => {
    if (!statement) return [];
    return statement.transfers.filter(t => {
      const d = effectiveDateKey(t);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }, [statement, fromDate, toDate]);

  const periodSummary = useMemo(() => computeSummary(filteredTransfers), [filteredTransfers]);
  const isFiltered = !!(fromDate || toDate);

  const invalidateAll = () => {
    if (selectedAgentId) {
      queryClient.invalidateQueries({ queryKey: getGetAgentStatementQueryKey(selectedAgentId) });
    }
    queryClient.invalidateQueries({ queryKey: getGetAgentsSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
  };

  const approveMutation = useApproveTransfer({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "تم الاعتماد", description: "تم اعتماد الحوالة بنجاح" });
      }
    }
  });

  const rejectMutation = useRejectTransfer({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "تم الرفض", description: "تم رفض الحوالة بنجاح" });
      }
    }
  });

  const deleteMutation = useDeleteTransfer({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "تم الحذف", description: "تم حذف العملية بنجاح" });
        setDeleteTarget(null);
      },
      onError: (err: any) => {
        toast({
          title: "تعذّر الحذف",
          description: err?.message || "حدث خطأ أثناء حذف العملية",
          variant: "destructive"
        });
        setDeleteTarget(null);
      }
    }
  });

  const createAgentMutation = useCreateAgent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAgentsSummaryQueryKey() });
        toast({ title: "تمت الإضافة", description: "تم إضافة المندوب بنجاح" });
        setAddOpen(false);
        setNewName("");
        setNewPhone("");
      },
      onError: (err: any) => {
        toast({ title: "خطأ", description: err?.message || "تعذّر إضافة المندوب", variant: "destructive" });
      }
    }
  });

  const updateAgentMutation = useUpdateAgent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAgentsSummaryQueryKey() });
        if (selectedAgentId) {
          queryClient.invalidateQueries({ queryKey: getGetAgentStatementQueryKey(selectedAgentId) });
        }
        toast({ title: "تم التعديل", description: "تم تعديل بيانات المندوب بنجاح" });
        setEditOpen(false);
      },
      onError: (err: any) => {
        toast({ title: "خطأ", description: err?.message || "تعذّر تعديل بيانات المندوب", variant: "destructive" });
      }
    }
  });

  const openEditAgent = () => {
    const current = agents?.find(a => a.id === selectedAgentId);
    if (!current) return;
    setEditName(current.name);
    setEditPhone(current.phone);
    setEditOpen(true);
  };

  const changeAgentMutation = useChangeTransferAgent({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "تم التغيير", description: "تم تغيير المندوب بنجاح" });
        setChangeAgentFor(null);
        setChangeAgentTarget("");
      },
      onError: (err: any) => {
        toast({ title: "خطأ", description: err?.message || "تعذّر تغيير المندوب", variant: "destructive" });
      }
    }
  });

  const handleConfirmChangeAgent = () => {
    if (changeAgentFor && changeAgentTarget) {
      changeAgentMutation.mutate({ id: changeAgentFor, data: { agentId: parseInt(changeAgentTarget) } });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case TransferStatus.approved: return <Badge className="bg-[#C9A227] text-[#1C1A17] hover:bg-[#C9A227]">معتمد</Badge>;
      case TransferStatus.pending: return <Badge className="bg-[#D97706]">معلق</Badge>;
      case TransferStatus.rejected: return <Badge className="bg-[#DC2626]">مرفوض</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="statement" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 no-print">
          <TabsTrigger value="statement">
            <BookOpen className="w-4 h-4 ml-2" /> كشف حساب مندوب
          </TabsTrigger>
          <TabsTrigger value="agents">
            <Users className="w-4 h-4 ml-2" /> ملخص المناديب
          </TabsTrigger>
        </TabsList>

        {/* ===== Per-agent statement ===== */}
        <TabsContent value="statement" className="space-y-6 print-area">
          <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-lg border shadow-sm no-print">
            <BookOpen className="w-6 h-6 text-[#A6791E] flex-shrink-0" />
            <div className="w-full md:w-80">
              <Select value={selectedAgentId?.toString()} onValueChange={(v) => setSelectedAgentId(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر مندوباً لعرض كشف الحساب..." />
                </SelectTrigger>
                <SelectContent>
                  {agents?.map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 md:mr-auto w-full md:w-auto">
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#1C1A17] hover:bg-[#33302A] flex-1 md:flex-none">
                    <UserPlus className="w-4 h-4 ml-2" /> إضافة مندوب
                  </Button>
                </DialogTrigger>
                <DialogContent dir="rtl">
                  <DialogHeader>
                    <DialogTitle>إضافة مندوب جديد</DialogTitle>
                    <DialogDescription>أدخل اسم المندوب ورقم هاتفه لإضافته إلى النظام.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">اسم المندوب</label>
                      <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="الاسم الكامل" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">رقم الهاتف</label>
                      <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="09xxxxxxxx" dir="ltr" className="text-right" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
                    <Button
                      className="bg-[#1C1A17] hover:bg-[#33302A]"
                      onClick={() => createAgentMutation.mutate({ data: { name: newName.trim(), phone: newPhone.trim() } })}
                      disabled={createAgentMutation.isPending || !newName.trim() || !newPhone.trim()}
                    >
                      إضافة
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              {selectedAgentId && (
                <Button variant="outline" onClick={openEditAgent} className="flex-1 md:flex-none">
                  <Pencil className="w-4 h-4 ml-2" /> تعديل المندوب
                </Button>
              )}
              {selectedAgentId && statement && (
                <Button variant="outline" onClick={() => window.print()} className="flex-1 md:flex-none">
                  <Printer className="w-4 h-4 ml-2" /> طباعة
                </Button>
              )}
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent dir="rtl">
                  <DialogHeader>
                    <DialogTitle>تعديل بيانات المندوب</DialogTitle>
                    <DialogDescription>عدّل اسم المندوب أو رقم هاتفه.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">اسم المندوب</label>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="الاسم الكامل" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">رقم الهاتف</label>
                      <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="09xxxxxxxx" dir="ltr" className="text-right" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
                    <Button
                      className="bg-[#1C1A17] hover:bg-[#33302A]"
                      onClick={() => selectedAgentId && updateAgentMutation.mutate({ id: selectedAgentId, data: { name: editName.trim(), phone: editPhone.trim() } })}
                      disabled={updateAgentMutation.isPending || !editName.trim() || !editPhone.trim()}
                    >
                      حفظ التعديل
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {!selectedAgentId ? (
            <div className="text-center py-20 bg-white rounded-lg border border-gray-200">
              <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-500">الرجاء اختيار مندوب</h2>
              <p className="text-gray-400 mt-2">اختر مندوباً من القائمة أعلاه لعرض كشف الحساب الخاص به.</p>
            </div>
          ) : isLoading ? (
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6 flex justify-between items-center">
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="text-left space-y-2">
                    <Skeleton className="h-4 w-24 ml-auto" />
                    <Skeleton className="h-8 w-40 ml-auto" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-[400px] w-full" />
                </CardContent>
              </Card>
            </div>
          ) : statement ? (
            <div className="space-y-6">
              <Card className="bg-[#1C1A17] text-white border-none shadow-md">
                <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">{statement.agent.name}</h2>
                    <p className="text-[#E8D9A8] mt-1" dir="ltr">{statement.agent.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#E8D9A8] text-sm mb-1">
                      {isFiltered ? "إجمالي المعتمد (الفترة)" : "الرصيد الحالي (المعتمد)"}
                    </p>
                    <p className="text-3xl font-bold bg-white/20 px-4 py-2 rounded-md backdrop-blur-sm">
                      {formatCurrency(isFiltered ? periodSummary.approvedAmount : statement.balance)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Date-range filter */}
              <Card className="no-print">
                <CardContent className="p-4 flex flex-col md:flex-row items-end gap-4">
                  <div className="space-y-1 w-full md:w-auto">
                    <label className="text-sm font-medium text-gray-700">من تاريخ</label>
                    <Input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
                  </div>
                  <div className="space-y-1 w-full md:w-auto">
                    <label className="text-sm font-medium text-gray-700">إلى تاريخ</label>
                    <Input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
                  </div>
                  {isFiltered && (
                    <Button variant="outline" onClick={() => { setFromDate(""); setToDate(""); }}>
                      مسح الفترة
                    </Button>
                  )}
                  <p className="text-sm text-gray-500 md:mr-auto">
                    {isFiltered ? "كشف حساب لفترة معينة" : "كشف الحساب الكامل"}
                  </p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-500">إجمالي الحوالات{isFiltered ? " (الفترة)" : ""}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{periodSummary.totalCount}</p>
                    <p className="text-sm text-gray-500 mt-1">{formatCurrency(periodSummary.totalAmount)}</p>
                  </CardContent>
                </Card>
                <Card className="border-[#EAD9B0]">
                  <CardContent className="p-4">
                    <p className="text-sm text-[#8A6718]">المعتمدة</p>
                    <p className="text-2xl font-bold text-[#8A6718] mt-1">{periodSummary.approvedCount}</p>
                    <p className="text-sm text-[#A6791E] mt-1">{formatCurrency(periodSummary.approvedAmount)}</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-100">
                  <CardContent className="p-4">
                    <p className="text-sm text-amber-700">المعلقة</p>
                    <p className="text-2xl font-bold text-amber-700 mt-1">{periodSummary.pendingCount}</p>
                    <p className="text-sm text-amber-600 mt-1">{formatCurrency(periodSummary.pendingAmount)}</p>
                  </CardContent>
                </Card>
                <Card className="border-red-100">
                  <CardContent className="p-4">
                    <p className="text-sm text-red-700">المرفوضة</p>
                    <p className="text-2xl font-bold text-red-700 mt-1">{periodSummary.rejectedCount}</p>
                    <p className="text-sm text-red-600 mt-1">{formatCurrency(periodSummary.rejectedAmount)}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>حركة الحساب</CardTitle>
                  <CardDescription>
                    {isFiltered
                      ? `الحوالات ضمن الفترة المحددة (${filteredTransfers.length} عملية).`
                      : "جميع الحوالات والعمليات مرتبة من الأحدث إلى الأقدم."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border border-gray-200">
                    <Table>
                      <TableHeader className="bg-gray-50">
                        <TableRow>
                          <TableHead className="text-right">التاريخ والزمن</TableHead>
                          <TableHead className="text-right">رقم العملية</TableHead>
                          <TableHead className="text-right">المرسل إليه</TableHead>
                          <TableHead className="text-center">طريقة الدفع</TableHead>
                          <TableHead className="text-right">المبلغ</TableHead>
                          <TableHead className="text-center">الحالة</TableHead>
                          <TableHead className="text-center no-print">إجراء</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTransfers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-10 text-gray-500">
                              {isFiltered ? "لا توجد حركات ضمن الفترة المحددة." : "لا توجد حركات مسجلة لهذا المندوب."}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredTransfers.map(transfer => (
                            <TableRow key={transfer.id} className="hover:bg-gray-50">
                              <TableCell className="text-sm">{transfer.transferDate ? formatDate(transfer.transferDate) : formatDateTime(transfer.createdAt)}</TableCell>
                              <TableCell className="font-mono text-sm">{transfer.operationNumber}</TableCell>
                              <TableCell>{transfer.recipientName || "—"}</TableCell>
                              <TableCell className="text-center">
                                {transfer.paymentMethod === "cash" ? (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">نقدي</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-gray-600">بنكك</Badge>
                                )}
                              </TableCell>
                              <TableCell className="font-bold text-gray-900">{formatCurrency(transfer.amount)}</TableCell>
                              <TableCell className="text-center">{getStatusBadge(transfer.status)}</TableCell>
                              <TableCell className="text-center no-print">
                                <div className="flex items-center justify-center gap-2">
                                  {transfer.status === TransferStatus.pending && (
                                    <>
                                      <Button
                                        size="sm"
                                        className="bg-[#C9A227] hover:bg-[#B8902F] text-[#1C1A17] h-8"
                                        onClick={() => approveMutation.mutate({ id: transfer.id })}
                                        disabled={approveMutation.isPending || rejectMutation.isPending}
                                      >
                                        اعتماد
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-8"
                                        onClick={() => rejectMutation.mutate({ id: transfer.id })}
                                        disabled={approveMutation.isPending || rejectMutation.isPending}
                                      >
                                        رفض
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8"
                                        onClick={() => { setChangeAgentFor(transfer.id); setChangeAgentTarget(""); }}
                                        disabled={approveMutation.isPending || rejectMutation.isPending}
                                        title="تغيير المندوب"
                                      >
                                        <ArrowRightLeft className="w-4 h-4" />
                                      </Button>
                                    </>
                                  )}
                                  {transfer.status === TransferStatus.approved && (
                                    <span className="flex items-center text-gray-400" title="حوالة معتمدة (مقفلة)">
                                      <Lock className="w-4 h-4" />
                                    </span>
                                  )}
                                  {transfer.status !== TransferStatus.approved && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => setDeleteTarget(transfer)}
                                      title="حذف العملية"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        {/* ===== All agents summary ===== */}
        <TabsContent value="agents" className="space-y-6 print-area">
          <div className="flex flex-col md:flex-row md:items-end gap-4 bg-white p-4 rounded-lg border shadow-sm no-print">
            <div className="space-y-1 w-full md:w-auto">
              <label className="text-sm font-medium text-gray-700">من تاريخ</label>
              <Input type="date" value={agentsFrom} max={agentsTo || undefined} onChange={(e) => setAgentsFrom(e.target.value)} />
            </div>
            <div className="space-y-1 w-full md:w-auto">
              <label className="text-sm font-medium text-gray-700">إلى تاريخ</label>
              <Input type="date" value={agentsTo} min={agentsFrom || undefined} onChange={(e) => setAgentsTo(e.target.value)} />
            </div>
            {agentsFiltered && (
              <Button variant="outline" onClick={() => { setAgentsFrom(""); setAgentsTo(""); }}>مسح الفترة</Button>
            )}
            <Button variant="outline" className="md:mr-auto" onClick={() => window.print()}>
              <Printer className="w-4 h-4 ml-2" /> طباعة
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>ملخص حوالات كل المناديب</CardTitle>
              <CardDescription>
                {agentsFiltered
                  ? "إجمالي الحوالات والمبالغ لكل مندوب ضمن الفترة المحددة."
                  : "إجمالي الحوالات والمبالغ لكل مندوب مع الإجمالي العام."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <div className="rounded-md border border-gray-200">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="text-right">المندوب</TableHead>
                        <TableHead className="text-center">عدد الحوالات</TableHead>
                        <TableHead className="text-right">إجمالي المبلغ</TableHead>
                        <TableHead className="text-right">المعتمد</TableHead>
                        <TableHead className="text-right">المعلق</TableHead>
                        <TableHead className="text-right">المرفوض</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!agentsSummary || agentsSummary.agents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-10 text-gray-500">لا يوجد مناديب مسجلون بعد.</TableCell>
                        </TableRow>
                      ) : (
                        agentsSummary.agents.map(row => (
                          <TableRow key={row.agentId} className="hover:bg-gray-50">
                            <TableCell className="font-medium">{row.agentName}</TableCell>
                            <TableCell className="text-center">{row.totalCount}</TableCell>
                            <TableCell className="font-bold text-gray-900">{formatCurrency(row.totalAmount)}</TableCell>
                            <TableCell className="text-[#8A6718]">{formatCurrency(row.approvedAmount)}</TableCell>
                            <TableCell className="text-amber-700">{formatCurrency(row.pendingAmount)}</TableCell>
                            <TableCell className="text-red-700">{formatCurrency(row.rejectedAmount)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                    {agentsSummary && agentsSummary.agents.length > 0 && (
                      <tfoot>
                        <TableRow className="bg-[#1C1A17]/5 font-bold border-t-2 border-[#A6791E]/20">
                          <TableCell className="font-bold">الإجمالي العام</TableCell>
                          <TableCell className="text-center">{agentsSummary.totals.totalCount}</TableCell>
                          <TableCell className="font-bold text-[#A6791E]">{formatCurrency(agentsSummary.totals.totalAmount)}</TableCell>
                          <TableCell className="text-[#8A6718]">{formatCurrency(agentsSummary.totals.approvedAmount)}</TableCell>
                          <TableCell className="text-amber-700">{formatCurrency(agentsSummary.totals.pendingAmount)}</TableCell>
                          <TableCell className="text-red-700">{formatCurrency(agentsSummary.totals.rejectedAmount)}</TableCell>
                        </TableRow>
                      </tfoot>
                    )}
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!changeAgentFor} onOpenChange={(open) => !open && setChangeAgentFor(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تغيير المندوب</DialogTitle>
            <DialogDescription>اختر المندوب الجديد لهذه الحوالة. يمكن التغيير قبل الاعتماد فقط.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={changeAgentTarget} onValueChange={setChangeAgentTarget}>
              <SelectTrigger>
                <SelectValue placeholder="اختر المندوب الجديد..." />
              </SelectTrigger>
              <SelectContent>
                {agents?.filter(a => a.id !== selectedAgentId).map(a => (
                  <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeAgentFor(null)}>إلغاء</Button>
            <Button
              className="bg-[#1C1A17] hover:bg-[#33302A]"
              onClick={handleConfirmChangeAgent}
              disabled={changeAgentMutation.isPending || !changeAgentTarget}
            >
              تأكيد التغيير
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العملية</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف الحوالة رقم{" "}
              <span className="font-mono font-bold">{deleteTarget?.operationNumber}</span>؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#DC2626] hover:bg-[#b91c1c]"
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) deleteMutation.mutate({ id: deleteTarget.id });
              }}
              disabled={deleteMutation.isPending}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
