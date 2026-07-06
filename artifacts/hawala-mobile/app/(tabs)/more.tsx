import React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useGetAccountMe, useListSubRequests } from "@workspace/api-client-react";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button, Card, Row } from "@/components/ui";
import { useColors } from "@/hooks/useColors";

export default function MoreScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signOut } = useAuth();
  const { data: me } = useGetAccountMe();
  const { data: subRequests } = useListSubRequests();
  const pendingSubs = (subRequests ?? []).filter((r) => r.status === "pending").length;

  const items = [
    {
      icon: "user-plus" as const,
      label: "طلبات الحسابات الفرعية",
      badge: pendingSubs,
      onPress: () => router.push("/sub-requests"),
    },
    {
      icon: "message-circle" as const,
      label: "رسائل واتساب",
      badge: 0,
      onPress: () => router.push("/messages"),
    },
  ];

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Card style={{ marginBottom: 16 }}>
          <Row style={{ gap: 12 }}>
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
              <Feather name="briefcase" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={{ fontFamily: "Cairo_700Bold" }}>حساب رئيسي</ThemedText>
              <ThemedText style={{ fontSize: 13, color: colors.mutedForeground }}>
                {me?.email ?? ""}
              </ThemedText>
            </View>
          </Row>
        </Card>

        {items.map((item) => (
          <Pressable key={item.label} onPress={item.onPress}>
            <Card style={{ marginBottom: 8 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Row style={{ gap: 12 }}>
                  <Feather name={item.icon} size={20} color={colors.primary} />
                  <ThemedText style={{ fontFamily: "Cairo_600SemiBold" }}>{item.label}</ThemedText>
                </Row>
                <Row style={{ gap: 8 }}>
                  {item.badge > 0 ? (
                    <View
                      style={{
                        backgroundColor: colors.destructive,
                        borderRadius: 999,
                        minWidth: 22,
                        height: 22,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 6,
                      }}
                    >
                      <ThemedText style={{ color: "#fff", fontSize: 12, fontFamily: "Cairo_700Bold" }}>
                        {item.badge}
                      </ThemedText>
                    </View>
                  ) : null}
                  <Feather name="chevron-left" size={18} color={colors.mutedForeground} />
                </Row>
              </Row>
            </Card>
          </Pressable>
        ))}

        <Button
          title="تسجيل الخروج"
          variant="destructive"
          onPress={() => signOut()}
          style={{ marginTop: 24 }}
        />
      </ScrollView>
    </ThemedView>
  );
}
