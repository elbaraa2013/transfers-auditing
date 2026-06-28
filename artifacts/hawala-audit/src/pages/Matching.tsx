import { useQueryClient } from "@tanstack/react-query";
import { 
  useListPendingTransfers, 
  getListPendingTransfersQueryKey,
  useApproveTransfer,
  useRejectTransfer
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Check, X, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Matching() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: transfers, isLoading } = useListPendingTransfers();

  const approveMutation = useApproveTransfer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPendingTransfersQueryKey() });
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
        queryClient.invalidateQueries({ queryKey: getListPendingTransfersQueryKey() });
        toast({ title: "تم الرفض", description: "تم رفض الحوالة بنجاح" });
      },
      onError: (err: any) => {
        toast({ title: "خطأ", description: err?.message || "حدث خطأ أثناء الرفض", variant: "destructive" });
      }
    }
  });

  const hasHighRisk = transfers?.some(t => t.riskScore > 0.6);

  return (
    <div className="space-y-6">
      {hasHighRisk && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="text-red-800 font-bold">تحذير: حوالات عالية المخاطر</h3>
            <p className="text-red-600 text-sm mt-1">توجد حوالات معلقة تتطلب انتباهاً خاصاً ومراجعة دقيقة.</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <Skeleton className="h-10 w-48 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3 mb-6" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : transfers?.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-lg border border-gray-200">
          <Check className="w-16 h-16 text-[#C9A227] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800">كل شيء مطابق!</h2>
          <p className="text-gray-500 mt-2">لا توجد حوالات معلقة في الوقت الحالي.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {transfers?.map(transfer => {
            const isHighRisk = transfer.riskScore > 0.6;
            
            return (
              <Card key={transfer.id} className={`overflow-hidden ${isHighRisk ? 'ring-2 ring-red-500 shadow-lg shadow-red-100' : ''}`}>
                {isHighRisk && (
                  <div className="bg-red-500 text-white text-xs font-bold px-3 py-1 text-center">
                    عالية المخاطر ({Math.round(transfer.riskScore * 100)}%)
                  </div>
                )}
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600 border border-gray-200">
                      {transfer.operationNumber}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(transfer.createdAt)}</span>
                  </div>
                  
                  <div className="mb-6">
                    <h3 className="text-3xl font-bold text-gray-900 mb-1">{formatCurrency(transfer.amount)}</h3>
                    <div className="flex items-center justify-between text-sm mt-3">
                      <span className="text-gray-500">المرسل إليه:</span>
                      <span className="font-semibold text-gray-800">{transfer.recipientName || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-gray-500">المندوب:</span>
                      <span className="font-semibold text-gray-800">{transfer.agentName}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      className="w-full bg-[#C9A227] hover:bg-[#B8902F] text-[#1C1A17] h-12 text-base font-semibold"
                      onClick={() => approveMutation.mutate({ id: transfer.id })}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      <Check className="w-5 h-5 ml-2" />
                      اعتماد
                    </Button>
                    <Button 
                      variant="outline"
                      className="w-full border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 h-12 text-base font-semibold"
                      onClick={() => rejectMutation.mutate({ id: transfer.id, data: { reason: "رفض من شاشة المطابقة السريعة" } })}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      <X className="w-5 h-5 ml-2" />
                      رفض
                    </Button>
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