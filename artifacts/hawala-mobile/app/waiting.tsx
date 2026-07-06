import React, { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";
import {
  useGetAccountMe,
  useRegisterSubAccount,
  getGetAccountMeQueryKey,
} from "@workspace/api-client-react";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button, Card, Field } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { errMsg } from "@/lib/format";

export default function WaitingScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const { data: me, refetch, isRefetching } = useGetAccountMe();
  const registerSub = useRegisterSubAccount();
  const [ownerEmail, setOwnerEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onRefresh = async () => {
    const { data } = await refetch();
    if (data?.role === "sub" && data.subStatus === "approved") {
      router.replace("/");
    }
  };

  const reRequest = () => {
    setError(null);
    if (!ownerEmail.trim()) {
      setError("البريد الإلكتروني للحساب الرئيسي مطلوب");
      return;
    }
    registerSub.mutate(
      { data: { ownerEmail: ownerEmail.trim() } },
      {
        onSuccess: async () => {
          setOwnerEmail("");
          await queryClient.invalidateQueries({ queryKey: getGetAccountMeQueryKey() });
        },
        onError: (e) => setError(errMsg(e, "تعذّر إرسال الطلب")),
      },
    );
  };

  const rejected = me?.subStatus === "rejected";

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.container, Platform.OS === "web" && { paddingTop: 67 }]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Feather
          name={rejected ? "x-circle" : "clock"}
          size={56}
          color={rejected ? colors.destructive : colors.primary}
          style={{ alignSelf: "center", marginBottom: 16 }}
        />
        <ThemedText type="title" style={{ textAlign: "center", marginBottom: 8 }}>
          {rejected ? "تم رفض طلبك" : "في انتظار الموافقة"}
        </ThemedText>
        <ThemedText style={{ textAlign: "center", color: colors.mutedForeground, marginBottom: 24 }}>
          {rejected
            ? "رفض الحساب الرئيسي طلب الربط. يمكنك إرسال طلب جديد."
            : "تم إرسال طلبك إلى الحساب الرئيسي. اسحب للأسفل للتحديث بعد الموافقة."}
        </ThemedText>

        {me?.ownerEmail && !rejected ? (
          <Card style={{ marginBottom: 16 }}>
            <ThemedText style={{ fontSize: 13, color: colors.mutedForeground }}>
              الحساب الرئيسي المرتبط
            </ThemedText>
            <ThemedText style={{ fontFamily: "Cairo_600SemiBold" }}>{me.ownerEmail}</ThemedText>
          </Card>
        ) : null}

        {rejected ? (
          <Card style={{ marginBottom: 16 }}>
            {error ? (
              <ThemedText type="error" style={{ marginBottom: 8 }}>
                {error}
              </ThemedText>
            ) : null}
            <Field
              label="البريد الإلكتروني للحساب الرئيسي"
              value={ownerEmail}
              onChangeText={setOwnerEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="example@email.com"
            />
            <Button title="إعادة إرسال الطلب" onPress={reRequest} loading={registerSub.isPending} />
          </Card>
        ) : (
          <Button title="تحديث الحالة" variant="outline" onPress={onRefresh} loading={isRefetching} />
        )}

        <Button
          title="تسجيل الخروج"
          variant="destructive"
          onPress={() => signOut()}
          style={{ marginTop: 16 }}
        />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 120,
  },
});
