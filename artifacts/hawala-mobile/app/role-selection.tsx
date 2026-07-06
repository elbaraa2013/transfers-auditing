import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";
import {
  useRegisterMainAccount,
  useRegisterSubAccount,
  getGetAccountMeQueryKey,
} from "@workspace/api-client-react";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button, Card, Field } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { errMsg } from "@/lib/format";

export default function RoleSelectionScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const [choice, setChoice] = useState<"main" | "sub" | null>(null);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const registerMain = useRegisterMainAccount();
  const registerSub = useRegisterSubAccount();

  const submitMain = () => {
    setError(null);
    registerMain.mutate(undefined as never, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getGetAccountMeQueryKey() });
        router.replace("/");
      },
      onError: (e) => setError(errMsg(e, "تعذّر إنشاء الحساب الرئيسي")),
    });
  };

  const submitSub = () => {
    setError(null);
    if (!ownerEmail.trim()) {
      setError("البريد الإلكتروني للحساب الرئيسي مطلوب");
      return;
    }
    registerSub.mutate(
      { data: { ownerEmail: ownerEmail.trim() } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: getGetAccountMeQueryKey() });
          router.replace("/waiting");
        },
        onError: (e) => setError(errMsg(e, "تعذّر إرسال الطلب")),
      },
    );
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          Platform.OS === "web" && { paddingTop: 67 },
        ]}
      >
        <ThemedText type="title" style={styles.title}>
          نوع الحساب
        </ThemedText>
        <ThemedText style={{ textAlign: "center", color: colors.mutedForeground, marginBottom: 24 }}>
          اختر نوع حسابك للمتابعة
        </ThemedText>

        {error ? (
          <ThemedText type="error" style={{ marginBottom: 16, textAlign: "center" }}>
            {error}
          </ThemedText>
        ) : null}

        <Pressable onPress={() => setChoice("main")}>
          <Card
            style={[
              styles.option,
              choice === "main" && { borderColor: colors.primary, borderWidth: 2 },
            ]}
          >
            <View style={styles.optionRow}>
              <Feather name="briefcase" size={28} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <ThemedText type="subtitle">حساب رئيسي</ThemedText>
                <ThemedText style={{ fontSize: 13, color: colors.mutedForeground }}>
                  صاحب العمل — يدقق الحوالات ويعتمدها ويدير المناديب
                </ThemedText>
              </View>
            </View>
          </Card>
        </Pressable>

        <Pressable onPress={() => setChoice("sub")}>
          <Card
            style={[
              styles.option,
              choice === "sub" && { borderColor: colors.primary, borderWidth: 2 },
            ]}
          >
            <View style={styles.optionRow}>
              <Feather name="user" size={28} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <ThemedText type="subtitle">حساب فرعي (مندوب)</ThemedText>
                <ThemedText style={{ fontSize: 13, color: colors.mutedForeground }}>
                  مندوب مبيعات — يرفع الحوالات ويتابع كشف حسابه
                </ThemedText>
              </View>
            </View>
          </Card>
        </Pressable>

        {choice === "sub" ? (
          <Card style={{ marginTop: 8, marginBottom: 16 }}>
            <Field
              label="البريد الإلكتروني للحساب الرئيسي"
              value={ownerEmail}
              onChangeText={setOwnerEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="example@email.com"
            />
            <ThemedText style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 12 }}>
              سيتم إرسال طلب ربط إلى الحساب الرئيسي، ولن تتمكن من رفع الحوالات حتى تتم الموافقة.
            </ThemedText>
            <Button
              title="إرسال طلب الربط"
              onPress={submitSub}
              loading={registerSub.isPending}
            />
          </Card>
        ) : null}

        {choice === "main" ? (
          <Button
            title="متابعة كحساب رئيسي"
            onPress={submitMain}
            loading={registerMain.isPending}
            style={{ marginTop: 8 }}
          />
        ) : null}

        <Pressable onPress={() => signOut()} style={{ marginTop: 32, alignItems: "center" }}>
          <ThemedText style={{ color: colors.mutedForeground, fontSize: 13 }}>
            تسجيل الخروج
          </ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 80,
  },
  title: {
    textAlign: "center",
    marginBottom: 4,
  },
  option: {
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 16,
  },
});
