import React, { useState } from "react";
import { FlatList, Modal, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAgents,
  useCreateAgent,
  useListInactiveAgents,
  getListAgentsQueryKey,
  getListInactiveAgentsQueryKey,
} from "@workspace/api-client-react";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button, Card, EmptyState, Field, Row } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { errMsg, fmtAmount } from "@/lib/format";

export default function AgentsScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: agents, isLoading, isRefetching } = useListAgents();
  const { data: inactive } = useListInactiveAgents();
  const createAgent = useCreateAgent();

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const submit = () => {
    setError(null);
    if (!name.trim() || !phone.trim()) {
      setError("الاسم ورقم الهاتف مطلوبان");
      return;
    }
    createAgent.mutate(
      { data: { name: name.trim(), phone: phone.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
          setModalOpen(false);
          setName("");
          setPhone("");
        },
        onError: (e) => setError(errMsg(e, "تعذّر إضافة المندوب")),
      },
    );
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <FlatList
        data={agents ?? []}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
              queryClient.invalidateQueries({ queryKey: getListInactiveAgentsQueryKey() });
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: 12, gap: 12 }}>
            <Button title="إضافة مندوب جديد" onPress={() => setModalOpen(true)} />
            {inactive && inactive.length > 0 ? (
              <Pressable onPress={() => setShowInactive((v) => !v)}>
                <Card style={{ borderColor: "#ef4444" }}>
                  <Row style={{ justifyContent: "space-between" }}>
                    <Row style={{ gap: 8 }}>
                      <Feather name="alert-triangle" size={18} color="#ef4444" />
                      <ThemedText style={{ fontFamily: "Cairo_600SemiBold", color: "#ef4444" }}>
                        مناديب غير نشطين ({inactive.length})
                      </ThemedText>
                    </Row>
                    <Feather
                      name={showInactive ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={colors.mutedForeground}
                    />
                  </Row>
                  {showInactive
                    ? inactive.map((a) => (
                        <Row
                          key={a.id}
                          style={{
                            justifyContent: "space-between",
                            marginTop: 10,
                            paddingTop: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                          }}
                        >
                          <ThemedText style={{ fontSize: 13 }}>{a.name}</ThemedText>
                          <ThemedText style={{ fontSize: 12, color: colors.mutedForeground }}>
                            غير نشط منذ {Math.round(a.inactiveHours)} ساعة
                          </ThemedText>
                        </Row>
                      ))
                    : null}
                </Card>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : <EmptyState icon="users" text="لا يوجد مناديب بعد" />
        }
        renderItem={({ item: a }) => (
          <Pressable onPress={() => router.push(`/agent/${a.id}`)}>
            <Card style={{ marginBottom: 8 }}>
              <Row style={{ justifyContent: "space-between", marginBottom: 4 }}>
                <ThemedText style={{ fontFamily: "Cairo_700Bold" }}>{a.name}</ThemedText>
                <ThemedText
                  style={{
                    fontFamily: "Cairo_700Bold",
                    color: a.balance >= 0 ? "#16a34a" : "#ef4444",
                  }}
                >
                  {fmtAmount(a.balance)}
                </ThemedText>
              </Row>
              <Row style={{ justifyContent: "space-between" }}>
                <ThemedText style={{ fontSize: 12, color: colors.mutedForeground }}>{a.phone}</ThemedText>
                <ThemedText style={{ fontSize: 12, color: colors.mutedForeground }}>
                  {a.totalTransfers} حوالة{a.pendingTransfers > 0 ? ` — ${a.pendingTransfers} قيد المراجعة` : ""}
                </ThemedText>
              </Row>
            </Card>
          </Pressable>
        )}
      />

      <Modal visible={modalOpen} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setModalOpen(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.card, borderRadius: colors.radius }]}
            onPress={() => {}}
          >
            <ThemedText type="subtitle" style={{ marginBottom: 12 }}>
              إضافة مندوب
            </ThemedText>
            {error ? (
              <ThemedText type="error" style={{ marginBottom: 8 }}>
                {error}
              </ThemedText>
            ) : null}
            <Field label="اسم المندوب" value={name} onChangeText={setName} placeholder="الاسم" />
            <Field
              label="رقم الهاتف"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="0912345678"
            />
            <Row style={{ gap: 8 }}>
              <Button title="إضافة" onPress={submit} loading={createAgent.isPending} style={{ flex: 1 }} />
              <Button
                title="إلغاء"
                variant="outline"
                onPress={() => setModalOpen(false)}
                style={{ flex: 1 }}
              />
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
