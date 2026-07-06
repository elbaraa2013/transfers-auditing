import React from "react";
import { FlatList, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useGetConversation, getGetConversationQueryKey } from "@workspace/api-client-react";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { EmptyState } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { fmtDateTime } from "@/lib/format";

export default function ConversationScreen() {
  const colors = useColors();
  const { agentId } = useLocalSearchParams<{ agentId: string }>();
  const numericAgentId = Number(agentId);

  const { data: messages, isLoading } = useGetConversation(numericAgentId, {
    query: {
      enabled: Number.isInteger(numericAgentId),
      queryKey: getGetConversationQueryKey(numericAgentId),
    },
  });

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "المحادثة",
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { fontFamily: "Cairo_700Bold", color: colors.text },
          headerTintColor: colors.primary,
        }}
      />
      <FlatList
        data={messages ?? []}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        ListEmptyComponent={
          isLoading ? null : <EmptyState icon="message-circle" text="لا توجد رسائل" />
        }
        renderItem={({ item: m }) => (
          <View
            style={{
              alignSelf: m.direction === "incoming" ? "flex-end" : "flex-start",
              maxWidth: "80%",
              backgroundColor: m.direction === "incoming" ? colors.card : colors.secondary,
              borderRadius: colors.radius,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 10,
              marginBottom: 8,
            }}
          >
            {m.type === "image" && m.imageUrl ? (
              <Image
                source={{ uri: m.imageUrl }}
                style={{ width: 200, height: 200, borderRadius: 8, marginBottom: 6 }}
                contentFit="cover"
              />
            ) : null}
            {m.content ? <ThemedText style={{ fontSize: 14 }}>{m.content}</ThemedText> : null}
            <ThemedText style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 4 }}>
              {fmtDateTime(m.sentAt)}
            </ThemedText>
          </View>
        )}
      />
    </ThemedView>
  );
}
