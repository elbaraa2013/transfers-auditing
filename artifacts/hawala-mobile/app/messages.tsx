import React from "react";
import { FlatList, Pressable, RefreshControl } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useListConversations, getListConversationsQueryKey } from "@workspace/api-client-react";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card, EmptyState, Row } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { fmtDateTime } from "@/lib/format";

export default function MessagesScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: conversations, isLoading, isRefetching } = useListConversations();

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "رسائل واتساب",
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { fontFamily: "Cairo_700Bold", color: colors.text },
          headerTintColor: colors.primary,
        }}
      />
      <FlatList
        data={conversations ?? []}
        keyExtractor={(c) => String(c.agentId)}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() =>
              queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() })
            }
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          isLoading ? null : <EmptyState icon="message-circle" text="لا توجد محادثات بعد" />
        }
        renderItem={({ item: c }) => (
          <Pressable onPress={() => router.push(`/conversation/${c.agentId}`)}>
            <Card style={{ marginBottom: 8 }}>
              <Row style={{ justifyContent: "space-between", marginBottom: 4 }}>
                <ThemedText style={{ fontFamily: "Cairo_700Bold" }}>{c.agentName}</ThemedText>
                <ThemedText style={{ fontSize: 11, color: colors.mutedForeground }}>
                  {fmtDateTime(c.lastMessageAt)}
                </ThemedText>
              </Row>
              <ThemedText
                numberOfLines={1}
                style={{ fontSize: 13, color: colors.mutedForeground }}
              >
                {c.lastMessage}
              </ThemedText>
            </Card>
          </Pressable>
        )}
      />
    </ThemedView>
  );
}
