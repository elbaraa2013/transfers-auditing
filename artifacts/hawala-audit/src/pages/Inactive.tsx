import { useListInactiveAgents } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { UserX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Inactive() {
  const { data: agents, isLoading } = useListInactiveAgents();

  const getStatusColor = (hours: number) => {
    if (hours > 72) return "bg-red-100 text-red-800 border-red-200";
    if (hours >= 48) return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-full">
              <UserX className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <CardTitle>تقرير المناديب الخاملين</CardTitle>
              <CardDescription>
                قائمة بالمناديب الذين لم يقوموا بأي نشاط لأكثر من 48 ساعة.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-gray-200">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="text-right">المندوب</TableHead>
                  <TableHead className="text-right">رقم الهاتف</TableHead>
                  <TableHead className="text-right">آخر نشاط</TableHead>
                  <TableHead className="text-right">مدة الخمول</TableHead>
                  <TableHead className="text-center">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 mx-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : agents?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                      لا يوجد مناديب خاملين حالياً. جميع المناديب نشطون.
                    </TableCell>
                  </TableRow>
                ) : (
                  agents?.map((agent) => (
                    <TableRow key={agent.id} className="hover:bg-gray-50">
                      <TableCell className="font-semibold text-gray-800">{agent.name}</TableCell>
                      <TableCell className="font-mono text-sm" dir="ltr">{agent.phone}</TableCell>
                      <TableCell>{formatDateTime(agent.lastActivityAt)}</TableCell>
                      <TableCell className="font-medium text-gray-700">{Math.floor(agent.inactiveHours)} ساعة</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={getStatusColor(agent.inactiveHours)}>
                          {agent.inactiveHours > 72 ? 'حرج (> 72 ساعة)' : 'تنبيه (48-72 ساعة)'}
                        </Badge>
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
  );
}