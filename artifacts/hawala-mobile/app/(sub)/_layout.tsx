import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform } from "react-native";

import { useColors } from "@/hooks/useColors";

export default function SubTabLayout() {
  const colors = useColors();
  const isWeb = Platform.OS === "web";

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
          title: "رفع حوالة",
          tabBarIcon: ({ color }) => <Feather name="upload" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="statement"
        options={{
          title: "كشف الحساب",
          tabBarIcon: ({ color }) => <Feather name="file-text" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "الإعدادات",
          tabBarIcon: ({ color }) => <Feather name="settings" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
