import { useGetTransferStats, useListTransfers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Overview() {
  const { data: stats, isLoading: statsLoading } = useGetTransferStats();
  const { data: transfers, isLoading: transfersLoading } = useListTransfers();

  const formatMoney = (amount: number) => {
    return amount.toLocaleString('en-US') + ' ج.س';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-[#C9A227] text-[#1C1A17] hover:bg-[#C9A227]/80">معتمد</Badge>;
      case 'pending': return <Badge className="bg-[#D97706] hover:bg-[#D97706]/80">معلق</Badge>;
      case 'rejected': return <Badge className="bg-[#DC2626] hover:bg-[#DC2626]/80">مرفوض</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'low': return <Badge variant="outline" className="text-[#8A6718] border-[#E8D9A8] bg-[#FAF4E3]">منخفض</Badge>;
      case 'medium': return <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">متوسط</Badge>;
      case 'high': return <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50">عالي</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">إجمالي الحوالات</CardTitle>
            <FileText className="w-4 h-4 text-[#A6791E]" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-2xl font-bold">{stats?.total || 0}</div>
                <p className="text-xs text-gray-500 mt-1">{stats ? formatMoney(stats.totalAmount) : '0 ج.س'}</p>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">الحوالات المعلقة</CardTitle>
            <Clock className="w-4 h-4 text-[#D97706]" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-2xl font-bold text-[#D97706]">{stats?.pending || 0}</div>
                <p className="text-xs text-gray-500 mt-1">{stats ? formatMoney(stats.pendingAmount) : '0 ج.س'}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">الحوالات المعتمدة</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-[#A6791E]" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-2xl font-bold text-[#A6791E]">{stats?.approved || 0}</div>
                <p className="text-xs text-gray-500 mt-1">{stats ? formatMoney(stats.approvedAmount) : '0 ج.س'}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">الحوالات المرفوضة</CardTitle>
            <XCircle className="w-4 h-4 text-[#DC2626]" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-2xl font-bold text-[#DC2626]">{stats?.rejected || 0}</div>
                <p className="text-xs text-gray-500 mt-1">{stats ? formatMoney(stats.rejectedAmount) : '0 ج.س'}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transfers Table */}
      <Card>
        <CardHeader>
          <CardTitle>أحدث الحوالات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfersLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">جاري التحميل...</TableCell>
                  </TableRow>
                ) : transfers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">لا توجد حوالات</TableCell>
                  </TableRow>
                ) : (
                  transfers?.map((transfer) => (
                    <TableRow key={transfer.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium font-mono text-sm">{transfer.operationNumber}</TableCell>
                      <TableCell>{new Date(transfer.createdAt).toLocaleDateString('ar-SA-u-nu-latn')}</TableCell>
                      <TableCell>{transfer.agentName}</TableCell>
                      <TableCell>{transfer.recipientName || "—"}</TableCell>
                      <TableCell className="font-bold">{formatMoney(transfer.amount)}</TableCell>
                      <TableCell className="text-center">{getRiskBadge(transfer.riskLevel)}</TableCell>
                      <TableCell className="text-center">{getStatusBadge(transfer.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}