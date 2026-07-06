import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform } from "react-native";
import { useListSubRequests } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";

export default function TabLayout() {
  const colors = useColors();
  const isWeb = Platform.OS === "web";
  const { data: subRequests } = useListSubRequests();
  const pendingSubs = (subRequests ?? []).filter((r) => r.status === "pending").length;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: "Cairo_700Bold", color: colors.text },
        headerTitleAlign: "center",
        ...(isWeb ? { headerStatusBarHeight: 24 } : {}),
        tabBarLabelStyle: { fontFamily: "Cairo_600SemiBold", fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="transfers"
        options={{
          title: "الحوالات",
          tabBarIcon: ({ color }) => <Feather name="list" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "إضافة",
          tabBarIcon: ({ color }) => <Feather name="plus-circle" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="agents"
        options={{
          title: "المناديب",
          tabBarIcon: ({ color }) => <Feather name="users" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "المزيد",
          tabBarIcon: ({ color }) => <Feather name="menu" size={22} color={color} />,
          ...(pendingSubs > 0
            ? { tabBarBadge: pendingSubs, tabBarBadgeStyle: { backgroundColor: colors.destructive } }
            : {}),
        }}
      />
    </Tabs>
  );
}
