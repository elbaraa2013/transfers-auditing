import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAccountMe,
  useGetAgentStatement,
  getGetAgentStatementQueryKey,
} from "@workspace/api-client-react";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card, EmptyState, Row, StatusChip } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { errMsg, fmtAmount, fmtDate } from "@/lib/format";

export default function SubStatementScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { data: me } = useGetAccountMe();
  const agentId = me?.agentId ?? null;

  const { data: statement, isLoading, isRefetching, isError, error } = useGetAgentStatement(
    agentId ?? 0,
    {
      query: { enabled: agentId != null, queryKey: getGetAgentStatementQueryKey(agentId ?? 0), retry: 1 },
    },
  );

  const s = statement?.summary;

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              if (agentId != null) {
                queryClient.invalidateQueries({ queryKey: getGetAgentStatementQueryKey(agentId) });
              }
            }}
            tintColor={colors.primary}
          />
        }
      >
        {agentId == null ? (
          <Card>
            <ThemedText style={{ textAlign: "center", color: colors.mutedForeground }}>
              حسابك غير مرتبط بمندوب بعد
            </ThemedText>
          </Card>
        ) : isError ? (
          <Card style={{ alignItems: "center", gap: 8 }}>
            <ThemedText style={{ textAlign: "center", fontFamily: "Cairo_700Bold" }}>
              تعذّر تحميل كشف الحساب
            </ThemedText>
            <ThemedText style={{ textAlign: "center", color: colors.mutedForeground, fontSize: 13 }}>
              {errMsg(error, "قد يكون المندوب المرتبط بحسابك قد حُذف. تواصل مع الحساب الرئيسي.")}
            </ThemedText>
          </Card>
        ) : isLoading || !statement ? (
          <ThemedText style={{ textAlign: "center", color: colors.mutedForeground, marginTop: 40 }}>
            جارٍ التحميل...
          </ThemedText>
        ) : (
          <>
            <Card style={{ marginBottom: 12, alignItems: "center", gap: 4 }}>
              <ThemedText style={{ fontSize: 13, color: colors.mutedForeground }}>الرصيد الحالي</ThemedText>
              <ThemedText
                style={{
                  fontSize: 26,
                  fontFamily: "Cairo_700Bold",
                  color: statement.balance >= 0 ? "#16a34a" : "#ef4444",
                }}
              >
                {fmtAmount(statement.balance)}
              </ThemedText>
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
              حوالاتي
            </ThemedText>
            {statement.transfers.length === 0 ? (
              <EmptyState icon="inbox" text="لم ترفع أي حوالات بعد" />
            ) : (
              statement.transfers.map((t) => (
                <Card key={t.id} style={{ marginBottom: 8 }}>
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
                  {t.rejectionReason ? (
                    <ThemedText style={{ fontSize: 12, color: colors.destructive, marginTop: 4 }}>
                      سبب الرفض: {t.rejectionReason}
                    </ThemedText>
                  ) : null}
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
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
});
