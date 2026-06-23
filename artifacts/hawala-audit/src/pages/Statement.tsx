import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAgents,
  useGetAgentStatement,
  useApproveTransfer,
  useRejectTransfer,
  useCreateAgent,
  useChangeTransferAgent,
  getGetAgentStatementQueryKey,
  getListAgentsQueryKey,
  TransferStatus
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Lock, UserPlus, Printer, ArrowRightLeft } from "lucide-react";

export default function Statement() {
  const [selectedAgentId, setSelectedAgentId] = useState<number | undefined>();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [changeAgentFor, setChangeAgentFor] = useState<number | null>(null);
  const [changeAgentTarget, setChangeAgentTarget] = useState<string>("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: agents } = useListAgents();
  const { data: statement, isLoading } = useGetAgentStatement(selectedAgentId!, {
    query: {
      enabled: !!selectedAgentId,
      queryKey: getGetAgentStatementQueryKey(selectedAgentId!)
    }
  });

  const invalidateStatement = () => {
    if (selectedAgentId) {
      queryClient.invalidateQueries({ queryKey: getGetAgentStatementQueryKey(selectedAgentId) });
    }
  };

  const approveMutation = useApproveTransfer({
    mutation: {
      onSuccess: () => {
        invalidateStatement();
        toast({ title: "تم الاعتماد", description: "تم اعتماد الحوالة بنجاح" });
      }
    }
  });

  const rejectMutation = useRejectTransfer({
    mutation: {
      onSuccess: () => {
        invalidateStatement();
        toast({ title: "تم الرفض", description: "تم رفض الحوالة بنجاح" });
      }
    }
  });

  const createAgentMutation = useCreateAgent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
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

  const changeAgentMutation = useChangeTransferAgent({
    mutation: {
      onSuccess: () => {
        invalidateStatement();
        queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
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
      case TransferStatus.approved: return <Badge className="bg-[#16A34A]">معتمد</Badge>;
      case TransferStatus.pending: return <Badge className="bg-[#D97706]">معلق</Badge>;
      case TransferStatus.rejected: return <Badge className="bg-[#DC2626]">مرفوض</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 print-area">
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-lg border shadow-sm no-print">
        <BookOpen className="w-6 h-6 text-[#0F6E56] flex-shrink-0" />
        <div className="w-full md:w-96">
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
              <Button className="bg-[#0F6E56] hover:bg-[#0b5341] flex-1 md:flex-none">
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
                  className="bg-[#0F6E56] hover:bg-[#0b5341]"
                  onClick={() => createAgentMutation.mutate({ data: { name: newName.trim(), phone: newPhone.trim() } })}
                  disabled={createAgentMutation.isPending || !newName.trim() || !newPhone.trim()}
                >
                  إضافة
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {selectedAgentId && statement && (
            <Button variant="outline" onClick={() => window.print()} className="flex-1 md:flex-none">
              <Printer className="w-4 h-4 ml-2" /> طباعة
            </Button>
          )}
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
          <Card className="bg-[#0F6E56] text-white border-none shadow-md">
            <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold">{statement.agent.name}</h2>
                <p className="text-emerald-100 mt-1" dir="ltr">{statement.agent.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-emerald-100 text-sm mb-1">الرصيد الحالي (المعتمد)</p>
                <p className="text-3xl font-bold bg-white/20 px-4 py-2 rounded-md backdrop-blur-sm">
                  {formatCurrency(statement.balance)}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500">إجمالي الحوالات</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{statement.summary.totalCount}</p>
                <p className="text-sm text-gray-500 mt-1">{formatCurrency(statement.summary.totalAmount)}</p>
              </CardContent>
            </Card>
            <Card className="border-green-100">
              <CardContent className="p-4">
                <p className="text-sm text-green-700">المعتمدة</p>
                <p className="text-2xl font-bold text-green-700 mt-1">{statement.summary.approvedCount}</p>
                <p className="text-sm text-green-600 mt-1">{formatCurrency(statement.summary.approvedAmount)}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-100">
              <CardContent className="p-4">
                <p className="text-sm text-amber-700">المعلقة</p>
                <p className="text-2xl font-bold text-amber-700 mt-1">{statement.summary.pendingCount}</p>
                <p className="text-sm text-amber-600 mt-1">{formatCurrency(statement.summary.pendingAmount)}</p>
              </CardContent>
            </Card>
            <Card className="border-red-100">
              <CardContent className="p-4">
                <p className="text-sm text-red-700">المرفوضة</p>
                <p className="text-2xl font-bold text-red-700 mt-1">{statement.summary.rejectedCount}</p>
                <p className="text-sm text-red-600 mt-1">{formatCurrency(statement.summary.rejectedAmount)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>حركة الحساب</CardTitle>
              <CardDescription>جميع الحوالات والعمليات مرتبة من الأحدث إلى الأقدم.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-gray-200">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="text-right">التاريخ والزمن</TableHead>
                      <TableHead className="text-right">رقم العملية</TableHead>
                      <TableHead className="text-right">المرسل إليه</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-center">الحالة</TableHead>
                      <TableHead className="text-center no-print">إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statement.transfers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-gray-500">لا توجد حركات مسجلة لهذا المندوب.</TableCell>
                      </TableRow>
                    ) : (
                      statement.transfers.map(transfer => (
                        <TableRow key={transfer.id} className="hover:bg-gray-50">
                          <TableCell className="text-sm">{formatDateTime(transfer.createdAt)}</TableCell>
                          <TableCell className="font-mono text-sm">{transfer.operationNumber}</TableCell>
                          <TableCell>{transfer.recipientName}</TableCell>
                          <TableCell className="font-bold text-gray-900">{formatCurrency(transfer.amount)}</TableCell>
                          <TableCell className="text-center">{getStatusBadge(transfer.status)}</TableCell>
                          <TableCell className="text-center no-print">
                            {transfer.status === TransferStatus.pending ? (
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  className="bg-[#16A34A] hover:bg-[#15803d] text-white h-8"
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
        </div>
      ) : null}

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
