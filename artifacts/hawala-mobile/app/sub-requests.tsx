import React, { useState } from "react";
import { FlatList, Modal, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSubRequests,
  useApproveSubRequest,
  useRejectSubRequest,
  useListAgents,
  getListSubRequestsQueryKey,
  getListAgentsQueryKey,
  type SubRequest,
} from "@workspace/api-client-react";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button, Card, EmptyState, Field, Row, StatusChip } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { errMsg, fmtDate } from "@/lib/format";

export default function SubRequestsScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { data: requests, isLoading, isRefetching } = useListSubRequests();
  const { data: agents } = useListAgents();
  const approve = useApproveSubRequest();
  const reject = useRejectSubRequest();

  const [target, setTarget] = useState<SubRequest | null>(null);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentPhone, setNewAgentPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListSubRequestsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
  };

  const openApprove = (r: SubRequest) => {
    setTarget(r);
    setMode("existing");
    setSelectedAgentId(null);
    setNewAgentName("");
    setNewAgentPhone("");
    setError(null);
  };

  const doApprove = () => {
    if (!target) return;
    setError(null);
    if (mode === "existing" && selectedAgentId == null) {
      setError("يجب اختيار مندوب");
      return;
    }
    if (mode === "new" && !newAgentName.trim()) {
      setError("اسم المندوب الجديد مطلوب");
      return;
    }
    approve.mutate(
      {
        id: target.id,
        data:
          mode === "existing"
            ? { agentId: selectedAgentId! }
            : { newAgentName: newAgentName.trim(), newAgentPhone: newAgentPhone.trim() || undefined },
      },
      {
        onSuccess: () => {
          invalidate();
          setTarget(null);
        },
        onError: (e) => setError(errMsg(e, "تعذّر اعتماد الطلب")),
      },
    );
  };

  const doReject = (r: SubRequest) => {
    setListError(null);
    reject.mutate(
      { id: r.id },
      {
        onSuccess: invalidate,
        onError: (e) => setListError(errMsg(e, "تعذّر رفض الطلب")),
      },
    );
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "طلبات الحسابات الفرعية",
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { fontFamily: "Cairo_700Bold", color: colors.text },
          headerTintColor: colors.primary,
        }}
      />
      <FlatList
        data={requests ?? []}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={invalidate} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          listError ? (
            <ThemedText type="error" style={{ marginBottom: 12 }}>
              {listError}
            </ThemedText>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState icon="user-plus" text="لا توجد طلبات ربط حسابات فرعية بعد" />
          )
        }
        renderItem={({ item: r }) => (
          <Card style={{ marginBottom: 8 }}>
            <Row style={{ justifyContent: "space-between", marginBottom: 4 }}>
              <ThemedText style={{ fontFamily: "Cairo_700Bold", fontSize: 14 }}>{r.subEmail}</ThemedText>
              <StatusChip status={r.status} />
            </Row>
            <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <ThemedText style={{ fontSize: 12, color: colors.mutedForeground }}>
                {r.agentName ? `مرتبط بالمندوب: ${r.agentName}` : "غير مرتبط بمندوب"}
              </ThemedText>
              <ThemedText style={{ fontSize: 12, color: colors.mutedForeground }}>
                {fmtDate(r.createdAt)}
              </ThemedText>
            </Row>
            {r.status === "pending" ? (
              <Row style={{ gap: 8 }}>
                <Button title="موافقة" variant="success" small onPress={() => openApprove(r)} style={{ flex: 1 }} />
                <Button
                  title="رفض"
                  variant="destructive"
                  small
                  onPress={() => doReject(r)}
                  loading={reject.isPending}
                  style={{ flex: 1 }}
                />
              </Row>
            ) : null}
          </Card>
        )}
      />

      <Modal visible={target != null} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setTarget(null)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.card, borderRadius: colors.radius }]}
            onPress={() => {}}
          >
            <ThemedText type="subtitle" style={{ marginBottom: 4 }}>
              الموافقة على الطلب
            </ThemedText>
            <ThemedText style={{ fontSize: 13, color: colors.mutedForeground, marginBottom: 12 }}>
              اربط {target?.subEmail} بمندوب ليتمكن من رفع الحوالات
            </ThemedText>

            {error ? (
              <ThemedText type="error" style={{ marginBottom: 8 }}>
                {error}
              </ThemedText>
            ) : null}

            <Row style={{ gap: 8, marginBottom: 12 }}>
              <Pressable
                onPress={() => setMode("existing")}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: colors.radius,
                  alignItems: "center",
                  backgroundColor: mode === "existing" ? colors.primary : colors.secondary,
                }}
              >
                <ThemedText
                  style={{
                    fontSize: 13,
                    fontFamily: "Cairo_600SemiBold",
                    color: mode === "existing" ? colors.primaryForeground : colors.secondaryForeground,
                  }}
                >
                  مندوب موجود
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setMode("new")}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: colors.radius,
                  alignItems: "center",
                  backgroundColor: mode === "new" ? colors.primary : colors.secondary,
                }}
              >
                <ThemedText
                  style={{
                    fontSize: 13,
                    fontFamily: "Cairo_600SemiBold",
                    color: mode === "new" ? colors.primaryForeground : colors.secondaryForeground,
                  }}
                >
                  مندوب جديد
                </ThemedText>
              </Pressable>
            </Row>

            {mode === "existing" ? (
              <View style={{ maxHeight: 240, marginBottom: 12 }}>
                {(agents ?? []).length === 0 ? (
                  <ThemedText style={{ color: colors.mutedForeground, paddingVertical: 12 }}>
                    لا يوجد مناديب — أنشئ مندوباً جديداً
                  </ThemedText>
                ) : (
                  (agents ?? []).map((a) => (
                    <Pressable
                      key={a.id}
                      onPress={() => setSelectedAgentId(a.id)}
                      style={{
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                        flexDirection: "row-reverse",
                        justifyContent: "space-between",
                      }}
                    >
                      <ThemedText style={{ fontFamily: "Cairo_600SemiBold", fontSize: 14 }}>
                        {a.name}
                      </ThemedText>
                      {selectedAgentId === a.id ? (
                        <Feather name="check" size={18} color={colors.primary} />
                      ) : null}
                    </Pressable>
                  ))
                )}
              </View>
            ) : (
              <>
                <Field label="اسم المندوب الجديد" value={newAgentName} onChangeText={setNewAgentName} />
                <Field
                  label="رقم الهاتف"
                  value={newAgentPhone}
                  onChangeText={setNewAgentPhone}
                  keyboardType="phone-pad"
                  placeholder="اختياري"
                />
              </>
            )}

            <Row style={{ gap: 8 }}>
              <Button title="موافقة وربط" onPress={doApprove} loading={approve.isPending} style={{ flex: 1 }} />
              <Button title="إلغاء" variant="outline" onPress={() => setTarget(null)} style={{ flex: 1 }} />
            </Row>
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
