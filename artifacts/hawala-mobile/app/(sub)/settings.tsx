import React from "react";
import { ScrollView, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useGetAccountMe } from "@workspace/api-client-react";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button, Card, Row } from "@/components/ui";
import { useColors } from "@/hooks/useColors";

export default function SubSettingsScreen() {
  const colors = useColors();
  const { signOut } = useAuth();
  const { data: me } = useGetAccountMe();

  const row = (label: string, value?: string | null) => (
    <Row style={{ justifyContent: "space-between", paddingVertical: 8 }}>
      <ThemedText style={{ fontSize: 13, color: colors.mutedForeground }}>{label}</ThemedText>
      <ThemedText style={{ fontFamily: "Cairo_600SemiBold", fontSize: 13 }}>{value ?? "—"}</ThemedText>
    </Row>
  );

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Card style={{ marginBottom: 16 }}>
          <Row style={{ gap: 12, marginBottom: 12 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.secondary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="user" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={{ fontFamily: "Cairo_700Bold" }}>حساب فرعي (مندوب)</ThemedText>
              <ThemedText style={{ fontSize: 13, color: colors.mutedForeground }}>
                {me?.email ?? ""}
              </ThemedText>
            </View>
          </Row>
          {row("اسم المندوب", me?.agentName)}
          {row("الحساب الرئيسي", me?.ownerEmail)}
        </Card>

        <Button title="تسجيل الخروج" variant="destructive" onPress={() => signOut()} />
      </ScrollView>
    </ThemedView>
  );
}
