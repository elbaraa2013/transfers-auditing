import React, { useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAgentStatement,
  useUpdateAgent,
  getGetAgentStatementQueryKey,
  getListAgentsQueryKey,
} from "@workspace/api-client-react";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button, Card, EmptyState, Field, Row, StatusChip } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { errMsg, fmtAmount, fmtDate } from "@/lib/format";

export default function AgentStatementScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const agentId = Number(id);

  const { data: statement, isLoading, isRefetching } = useGetAgentStatement(agentId, {
    query: { enabled: Number.isInteger(agentId), queryKey: getGetAgentStatementQueryKey(agentId) },
  });
  const updateAgent = useUpdateAgent();

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openEdit = () => {
    if (!statement) return;
    setName(statement.agent.name);
    setPhone(statement.agent.phone);
    setError(null);
    setEditOpen(true);
  };

  const saveEdit = () => {
    setError(null);
    if (!name.trim() || !phone.trim()) {
      setError("الاسم ورقم الهاتف مطلوبان");
      return;
    }
    updateAgent.mutate(
      { id: agentId, data: { name: name.trim(), phone: phone.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAgentStatementQueryKey(agentId) });
          queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
          setEditOpen(false);
        },
        onError: (e) => setError(errMsg(e, "تعذّر تعديل المندوب")),
      },
    );
  };

  const s = statement?.summary;

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: statement?.agent.name ?? "كشف الحساب",
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { fontFamily: "Cairo_700Bold", color: colors.text },
          headerTintColor: colors.primary,
        }}
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() =>
              queryClient.invalidateQueries({ queryKey: getGetAgentStatementQueryKey(agentId) })
            }
            tintColor={colors.primary}
          />
        }
      >
        {isLoading || !statement ? (
          <ThemedText style={{ textAlign: "center", color: colors.mutedForeground, marginTop: 40 }}>
            {isLoading ? "جارٍ التحميل..." : "المندوب غير موجود"}
          </ThemedText>
        ) : (
          <>
            <Card style={{ marginBottom: 12 }}>
              <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <View>
                  <ThemedText style={{ fontFamily: "Cairo_700Bold", fontSize: 18 }}>
                    {statement.agent.name}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 13, color: colors.mutedForeground }}>
                    {statement.agent.phone}
                  </ThemedText>
                </View>
                <Pressable onPress={openEdit} style={{ padding: 8 }}>
                  <Feather name="edit-2" size={18} color={colors.primary} />
                </Pressable>
              </Row>
              <Row style={{ justifyContent: "space-between" }}>
                <ThemedText style={{ color: colors.mutedForeground, fontSize: 13 }}>الرصيد</ThemedText>
                <ThemedText
                  style={{
                    fontFamily: "Cairo_700Bold",
                    fontSize: 18,
                    color: statement.balance >= 0 ? "#16a34a" : "#ef4444",
                  }}
                >
                  {fmtAmount(statement.balance)}
                </ThemedText>
              </Row>
            </Card>

            {s ? (
              <View style={styles.grid}>
                <Card style={styles.statCard}>
                  <ThemedText style={{ fontSize: 12, color: colors.mutedForeground }}>مقبولة</ThemedText>
                  <ThemedText style={{ fontFamily: "Cairo_700Bold", color: "#16a34a" }}>
                    {s.approvedCount} — {fmtAmount(s.approvedAmount)}
                  </ThemedText>
                </Card>
                <Card style={styles.statCard}>
                  <ThemedText style={{ fontSize: 12, color: colors.mutedForeground }}>قيد المراجعة</ThemedText>
                  <ThemedText style={{ fontFamily: "Cairo_700Bold", color: "#A6791E" }}>
                    {s.pendingCount} — {fmtAmount(s.pendingAmount)}
                  </ThemedText>
                </Card>
                <Card style={styles.statCard}>
                  <ThemedText style={{ fontSize: 12, color: colors.mutedForeground }}>مرفوضة</ThemedText>
                  <ThemedText style={{ fontFamily: "Cairo_700Bold", color: "#ef4444" }}>
                    {s.rejectedCount} — {fmtAmount(s.rejectedAmount)}
                  </ThemedText>
                </Card>
                <Card style={styles.statCard}>
                  <ThemedText style={{ fontSize: 12, color: colors.mutedForeground }}>الإجمالي</ThemedText>
                  <ThemedText style={{ fontFamily: "Cairo_700Bold", color: colors.primary }}>
                    {s.totalCount} — {fmtAmount(s.totalAmount)}
                  </ThemedText>
                </Card>
              </View>
            ) : null}

            <ThemedText type="subtitle" style={{ marginTop: 20, marginBottom: 12 }}>
              الحوالات
            </ThemedText>
            {statement.transfers.length === 0 ? (
              <EmptyState icon="inbox" text="لا توجد حوالات لهذا المندوب" />
            ) : (
              statement.transfers.map((t) => (
                <Pressable key={t.id} onPress={() => router.push(`/transfer/${t.id}`)}>
                  <Card style={{ marginBottom: 8 }}>
                    <Row style={{ justifyContent: "space-between", marginBottom: 4 }}>
                      <ThemedText style={{ fontFamily: "Cairo_700Bold" }}>{fmtAmount(t.amount)}</ThemedText>
                      <StatusChip status={t.status} />
                    </Row>
                    <Row style={{ justifyContent: "space-between" }}>
                      <ThemedText style={{ fontSize: 12, color: colors.mutedForeground }}>
                        {t.operationNumber}
                      </ThemedText>
                      <ThemedText style={{ fontSize: 12, color: colors.mutedForeground }}>
                        {fmtDate(t.transferDate || t.createdAt)}
                      </ThemedText>
                    </Row>
                  </Card>
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={editOpen} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setEditOpen(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.card, borderRadius: colors.radius }]}
            onPress={() => {}}
          >
            <ThemedText type="subtitle" style={{ marginBottom: 12 }}>
              تعديل المندوب
            </ThemedText>
            {error ? (
              <ThemedText type="error" style={{ marginBottom: 8 }}>
                {error}
              </ThemedText>
            ) : null}
            <Field label="الاسم" value={name} onChangeText={setName} />
            <Field label="رقم الهاتف" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Row style={{ gap: 8 }}>
              <Button title="حفظ" onPress={saveEdit} loading={updateAgent.isPending} style={{ flex: 1 }} />
              <Button title="إلغاء" variant="outline" onPress={() => setEditOpen(false)} style={{ flex: 1 }} />
            </Row>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    flexBasis: "47%",
    flexGrow: 1,
    gap: 2,
    padding: 12,
  },
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
