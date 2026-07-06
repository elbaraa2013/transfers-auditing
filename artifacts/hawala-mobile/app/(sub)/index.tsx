import React from "react";
import { ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  useGetAccountMe,
  useGetAgentStatement,
  getGetAgentStatementQueryKey,
} from "@workspace/api-client-react";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TransferForm } from "@/components/TransferForm";
import { Card } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { errMsg } from "@/lib/format";

export default function SubUploadScreen() {
  const colors = useColors();
  const { data: me, isLoading } = useGetAccountMe();
  const agentId = me?.agentId ?? null;

  const {
    isError: agentMissing,
    error: agentError,
    isLoading: agentLoading,
  } = useGetAgentStatement(agentId ?? 0, {
    query: { enabled: agentId != null, queryKey: getGetAgentStatementQueryKey(agentId ?? 0), retry: 1 },
  });

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {isLoading || (agentId != null && agentLoading) ? (
          <ThemedText style={{ textAlign: "center", color: colors.mutedForeground, marginTop: 40 }}>
            جارٍ التحميل...
          </ThemedText>
        ) : agentId == null ? (
          <Card>
            <ThemedText style={{ textAlign: "center", color: colors.mutedForeground }}>
              حسابك غير مرتبط بمندوب بعد. تواصل مع الحساب الرئيسي.
            </ThemedText>
          </Card>
        ) : agentMissing ? (
          <Card style={{ alignItems: "center", gap: 8 }}>
            <Feather name="alert-triangle" size={32} color={colors.destructive} />
            <ThemedText style={{ textAlign: "center", fontFamily: "Cairo_700Bold" }}>
              تعذّر الوصول إلى حساب المندوب
            </ThemedText>
            <ThemedText style={{ textAlign: "center", color: colors.mutedForeground, fontSize: 13 }}>
              {errMsg(agentError, "قد يكون المندوب المرتبط بحسابك قد حُذف. تواصل مع الحساب الرئيسي لإعادة الربط.")}
            </ThemedText>
          </Card>
        ) : (
          <>
            <Card style={{ marginBottom: 16 }}>
              <ThemedText style={{ fontSize: 13, color: colors.mutedForeground }}>
                ترفع الحوالات باسم
              </ThemedText>
              <ThemedText style={{ fontFamily: "Cairo_700Bold", fontSize: 16 }}>
                {me?.agentName ?? ""}
              </ThemedText>
            </Card>
            <TransferForm fixedAgentId={agentId} fixedAgentName={me?.agentName ?? undefined} />
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}
