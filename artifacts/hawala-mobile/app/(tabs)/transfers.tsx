import React, { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTransfers,
  getListTransfersQueryKey,
  type ListTransfersStatus,
} from "@workspace/api-client-react";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card, EmptyState, Row, StatusChip } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { fmtAmount, fmtDate } from "@/lib/format";

const filters: { key: ListTransfersStatus | "all"; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "pending", label: "قيد المراجعة" },
  { key: "approved", label: "مقبولة" },
  { key: "rejected", label: "مرفوضة" },
];

export default function TransfersScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ListTransfersStatus | "all">("all");
  const [search, setSearch] = useState("");

  const params = useMemo(
    () => (filter === "all" ? {} : { status: filter }),
    [filter],
  );
  const { data: transfers, isLoading, isRefetching } = useListTransfers(params);

  const filtered = useMemo(() => {
    if (!transfers) return [];
    if (!search.trim()) return transfers;
    const q = search.trim().toLowerCase();
    return transfers.filter(
      (t) =>
        t.operationNumber.toLowerCase().includes(q) ||
        t.agentName.toLowerCase().includes(q) ||
        (t.recipientName ?? "").toLowerCase().includes(q),
    );
  }, [transfers, search]);

  return (
    <ThemedView style={{ flex: 1 }}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="بحث برقم العملية أو المندوب"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.search,
            {
              borderColor: colors.border,
              borderRadius: colors.radius,
              backgroundColor: colors.card,
              color: colors.text,
            },
          ]}
        />
        <Row style={{ gap: 8, marginTop: 12, marginBottom: 12 }}>
          {filters.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: filter === f.key ? colors.primary : colors.secondary,
              }}
            >
              <ThemedText
                style={{
                  fontSize: 12,
                  fontFamily: "Cairo_600SemiBold",
                  color: filter === f.key ? colors.primaryForeground : colors.secondaryForeground,
                }}
              >
                {f.label}
              </ThemedText>
            </Pressable>
          ))}
        </Row>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: getListTransfersQueryKey() })}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          isLoading ? null : <EmptyState icon="inbox" text="لا توجد حوالات مطابقة" />
        }
        renderItem={({ item: t }) => (
          <Pressable onPress={() => router.push(`/transfer/${t.id}`)}>
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
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  search: {
    borderWidth: 1,
    padding: 12,
    fontFamily: "Cairo_400Regular",
    textAlign: "right",
    writingDirection: "rtl",
  },
});
