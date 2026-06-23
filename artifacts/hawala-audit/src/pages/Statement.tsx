import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListAgents, 
  useGetAgentStatement,
  useApproveTransfer,
  useRejectTransfer,
  getGetAgentStatementQueryKey,
  TransferStatus
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Check, X, Lock } from "lucide-react";

export default function Statement() {
  const [selectedAgentId, setSelectedAgentId] = useState<number | undefined>();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: agents } = useListAgents();
  const { data: statement, isLoading } = useGetAgentStatement(selectedAgentId!, {
    query: { enabled: !!selectedAgentId }
  });

  const approveMutation = useApproveTransfer({
    mutation: {
      onSuccess: () => {
        if (selectedAgentId) {
          queryClient.invalidateQueries({ queryKey: getGetAgentStatementQueryKey(selectedAgentId) });
        }
        toast({ title: "تم الاعتماد", description: "تم اعتماد الحوالة بنجاح" });
      }
    }
  });

  const rejectMutation = useRejectTransfer({
    mutation: {
      onSuccess: () => {
        if (selectedAgentId) {
          queryClient.invalidateQueries({ queryKey: getGetAgentStatementQueryKey(selectedAgentId) });
        }
        toast({ title: "تم الرفض", description: "تم رفض الحوالة بنجاح" });
      }
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case TransferStatus.approved: return <Badge className="bg-[#16A34A]">معتمد</Badge>;
      case TransferStatus.pending: return <Badge className="bg-[#D97706]">معلق</Badge>;
      case TransferStatus.rejected: return <Badge className="bg-[#DC2626]">مرفوض</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-lg border shadow-sm">
        <BookOpen className="w-6 h-6 text-[#0F6E56]" />
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
                <p className="text-emerald-100 text-sm mb-1">الرصيد الحالي</p>
                <p className="text-3xl font-bold bg-white/20 px-4 py-2 rounded-md backdrop-blur-sm">
                  {formatCurrency(statement.balance)}
                </p>
              </div>
            </CardContent>
          </Card>

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
                      <TableHead className="text-center">إجراء</TableHead>
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
                          <TableCell className="text-center">
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
    </div>
  );
}