import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTransferStats,
  useListPendingTransfers,
  getGetTransferStatsQueryKey,
  getListPendingTransfersQueryKey,
} from "@workspace/api-client-react";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card, EmptyState, Row, StatusChip } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { fmtAmount, fmtDate } from "@/lib/format";

export default function OverviewScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useGetTransferStats();
  const { data: pending, isRefetching } = useListPendingTransfers();

  const onRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetTransferStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListPendingTransfersQueryKey() });
  };

  const cards = [
    { label: "الإجمالي", count: stats?.total ?? 0, amount: stats?.totalAmount ?? 0, color: colors.primary, icon: "layers" as const },
    { label: "قيد المراجعة", count: stats?.pending ?? 0, amount: stats?.pendingAmount ?? 0, color: "#A6791E", icon: "clock" as const },
    { label: "مقبولة", count: stats?.approved ?? 0, amount: stats?.approvedAmount ?? 0, color: "#16a34a", icon: "check-circle" as const },
    { label: "مرفوضة", count: stats?.rejected ?? 0, amount: stats?.rejectedAmount ?? 0, color: "#ef4444", icon: "x-circle" as const },
  ];

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.grid}>
          {cards.map((c) => (
            <Card key={c.label} style={styles.statCard}>
              <Row style={{ justifyContent: "space-between" }}>
                <ThemedText style={{ fontSize: 13, color: colors.mutedForeground }}>{c.label}</ThemedText>
                <Feather name={c.icon} size={16} color={c.color} />
              </Row>
              <ThemedText style={{ fontSize: 22, fontFamily: "Cairo_700Bold", color: c.color }}>
                {statsLoading ? "…" : c.count}
              </ThemedText>
              <ThemedText style={{ fontSize: 12, color: colors.mutedForeground }}>
                {fmtAmount(c.amount)}
              </ThemedText>
            </Card>
          ))}
        </View>

        <Row style={{ justifyContent: "space-between", marginTop: 24, marginBottom: 12 }}>
          <ThemedText type="subtitle">بانتظار التدقيق</ThemedText>
          <Pressable onPress={() => router.push("/(tabs)/transfers")}>
            <ThemedText type="link" style={{ fontSize: 13 }}>عرض الكل</ThemedText>
          </Pressable>
        </Row>

        {!pending || pending.length === 0 ? (
          <EmptyState icon="inbox" text="لا توجد حوالات بانتظار التدقيق" />
        ) : (
          pending.slice(0, 6).map((t) => (
            <Pressable key={t.id} onPress={() => router.push(`/transfer/${t.id}`)}>
              <Card style={{ marginBottom: 8 }}>
                <Row style={{ justifyContent: "space-between", marginBottom: 4 }}>
                  <ThemedText style={{ fontFamily: "Cairo_700Bold" }}>{fmtAmount(t.amount)}</ThemedText>
                  <StatusChip status={t.status} />
                </Row>
                <Row style={{ justifyContent: "space-between" }}>
                  <ThemedText style={{ fontSize: 13, color: colors.mutedForeground }}>
                    {t.agentName} — {t.operationNumber}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 12, color: colors.mutedForeground }}>
                    {fmtDate(t.transferDate || t.createdAt)}
                  </ThemedText>
                </Row>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 120,
  },
  grid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    flexBasis: "47%",
    flexGrow: 1,
    gap: 2,
  },
});
