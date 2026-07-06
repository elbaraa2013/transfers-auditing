import React, { useState } from "react";
import { FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTransfer,
  useApproveTransfer,
  useRejectTransfer,
  useDeleteTransfer,
  useChangeTransferAgent,
  useListAgents,
  getGetTransferQueryKey,
  getListTransfersQueryKey,
  getListPendingTransfersQueryKey,
  getGetTransferStatsQueryKey,
  getListAgentsQueryKey,
  getGetAgentStatementQueryKey,
} from "@workspace/api-client-react";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button, Card, Field, Row, StatusChip } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { errMsg, fmtAmount, fmtDate, fmtDateTime } from "@/lib/format";

function haptic(type: "success" | "warning") {
  if (Platform.OS !== "web") {
    Haptics.notificationAsync(
      type === "success"
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    ).catch(() => {});
  }
}

export default function TransferDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const transferId = Number(id);

  const { data: t, isLoading } = useGetTransfer(transferId, {
    query: { enabled: Number.isInteger(transferId), queryKey: getGetTransferQueryKey(transferId) },
  });
  const { data: agents } = useListAgents();

  const approve = useApproveTransfer();
  const reject = useRejectTransfer();
  const del = useDeleteTransfer();
  const changeAgent = useChangeTransferAgent();

  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [agentOpen, setAgentOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const invalidate = (extraAgentId?: number) => {
    queryClient.invalidateQueries({ queryKey: getGetTransferQueryKey(transferId) });
    queryClient.invalidateQueries({ queryKey: getListTransfersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListPendingTransfersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTransferStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
    if (t?.agentId != null) {
      queryClient.invalidateQueries({ queryKey: getGetAgentStatementQueryKey(t.agentId) });
    }
    if (extraAgentId != null && extraAgentId !== t?.agentId) {
      queryClient.invalidateQueries({ queryKey: getGetAgentStatementQueryKey(extraAgentId) });
    }
  };

  const doApprove = () => {
    setError(null);
    approve.mutate(
      { id: transferId },
      {
        onSuccess: () => {
          haptic("success");
          invalidate();
        },
        onError: (e) => setError(errMsg(e, "تعذّر اعتماد الحوالة")),
      },
    );
  };

  const doReject = () => {
    setError(null);
    reject.mutate(
      { id: transferId, data: { reason: reason.trim() || undefined } },
      {
        onSuccess: () => {
          haptic("warning");
          invalidate();
          setRejectOpen(false);
          setReason("");
        },
        onError: (e) => setError(errMsg(e, "تعذّر رفض الحوالة")),
      },
    );
  };

  const doDelete = () => {
    setError(null);
    del.mutate(
      { id: transferId },
      {
        onSuccess: () => {
          haptic("warning");
          invalidate();
          router.back();
        },
        onError: (e) => {
          setConfirmDelete(false);
          setError(errMsg(e, "تعذّر حذف الحوالة"));
        },
      },
    );
  };

  const doChangeAgent = (agentId: number) => {
    setError(null);
    changeAgent.mutate(
      { id: transferId, data: { agentId } },
      {
        onSuccess: () => {
          haptic("success");
          invalidate(agentId);
          setAgentOpen(false);
        },
        onError: (e) => {
          setAgentOpen(false);
          setError(errMsg(e, "تعذّر تغيير المندوب"));
        },
      },
    );
  };

  const detail = (label: string, value?: string | null) =>
    value ? (
      <Row style={{ justifyContent: "space-between", paddingVertical: 6 }}>
        <ThemedText style={{ color: colors.mutedForeground, fontSize: 13 }}>{label}</ThemedText>
        <ThemedText style={{ fontFamily: "Cairo_600SemiBold", fontSize: 13, flexShrink: 1 }}>
          {value}
        </ThemedText>
      </Row>
    ) : null;

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "تفاصيل الحوالة",
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { fontFamily: "Cairo_700Bold", color: colors.text },
          headerTintColor: colors.primary,
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {isLoading || !t ? (
          <ThemedText style={{ textAlign: "center", color: colors.mutedForeground, marginTop: 40 }}>
            {isLoading ? "جارٍ التحميل..." : "الحوالة غير موجودة"}
          </ThemedText>
        ) : (
          <>
            {error ? (
              <ThemedText type="error" style={{ marginBottom: 12 }}>
                {error}
              </ThemedText>
            ) : null}

            <Card style={{ marginBottom: 12, alignItems: "center", gap: 8 }}>
              <ThemedText style={{ fontSize: 28, fontFamily: "Cairo_700Bold", color: colors.primary }}>
                {fmtAmount(t.amount)}
              </ThemedText>
              <StatusChip status={t.status} />
              {t.rejectionReason ? (
                <ThemedText style={{ color: colors.destructive, fontSize: 13, textAlign: "center" }}>
                  سبب الرفض: {t.rejectionReason}
                </ThemedText>
              ) : null}
            </Card>

            <Card style={{ marginBottom: 12 }}>
              {detail("رقم العملية", t.operationNumber)}
              {detail("المندوب", t.agentName)}
              {detail("طريقة الدفع", t.paymentMethod === "cash" ? "نقدي" : "بنكك")}
              {detail("من حساب", t.fromAccount)}
              {detail("إلى حساب", t.toAccount)}
              {detail("المستلم", t.recipientName)}
              {detail("تاريخ الحوالة", t.transferDate ? fmtDate(t.transferDate) : null)}
              {detail("تاريخ التسجيل", fmtDateTime(t.createdAt))}
              {detail("الملاحظة", t.comment)}
              {detail(
                "درجة الخطورة",
                t.riskLevel === "high" ? "مرتفعة" : t.riskLevel === "medium" ? "متوسطة" : "منخفضة",
              )}
            </Card>

            {t.status === "pending" ? (
              <View style={{ gap: 8 }}>
                <Button title="اعتماد الحوالة" variant="success" onPress={doApprove} loading={approve.isPending} />
                <Row style={{ gap: 8 }}>
                  <Button
                    title="رفض"
                    variant="destructive"
                    onPress={() => setRejectOpen(true)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="تغيير المندوب"
                    variant="outline"
                    onPress={() => setAgentOpen(true)}
                    style={{ flex: 1 }}
                  />
                </Row>
                <Button
                  title={confirmDelete ? "تأكيد الحذف" : "حذف الحوالة"}
                  variant={confirmDelete ? "destructive" : "outline"}
                  onPress={() => (confirmDelete ? doDelete() : setConfirmDelete(true))}
                  loading={del.isPending}
                />
              </View>
            ) : t.status === "rejected" ? (
              <Button
                title={confirmDelete ? "تأكيد الحذف" : "حذف الحوالة"}
                variant={confirmDelete ? "destructive" : "outline"}
                onPress={() => (confirmDelete ? doDelete() : setConfirmDelete(true))}
                loading={del.isPending}
              />
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal visible={rejectOpen} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setRejectOpen(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.card, borderRadius: colors.radius }]}
            onPress={() => {}}
          >
            <ThemedText type="subtitle" style={{ marginBottom: 12 }}>
              رفض الحوالة
            </ThemedText>
            <Field
              label="سبب الرفض (اختياري)"
              value={reason}
              onChangeText={setReason}
              placeholder="مثال: رقم العملية غير صحيح"
            />
            <Row style={{ gap: 8 }}>
              <Button
                title="تأكيد الرفض"
                variant="destructive"
                onPress={doReject}
                loading={reject.isPending}
                style={{ flex: 1 }}
              />
              <Button title="إلغاء" variant="outline" onPress={() => setRejectOpen(false)} style={{ flex: 1 }} />
            </Row>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={agentOpen} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setAgentOpen(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.card, borderRadius: colors.radius }]}
            onPress={() => {}}
          >
            <ThemedText type="subtitle" style={{ marginBottom: 12 }}>
              تغيير المندوب
            </ThemedText>
            <FlatList
              data={agents ?? []}
              keyExtractor={(a) => String(a.id)}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => doChangeAgent(item.id)}
                  style={{
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    flexDirection: "row-reverse",
                    justifyContent: "space-between",
                  }}
                >
                  <ThemedText style={{ fontFamily: "Cairo_600SemiBold" }}>{item.name}</ThemedText>
                  {t?.agentId === item.id ? (
                    <Feather name="check" size={18} color={colors.primary} />
                  ) : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    padding: 20,
  },
});
