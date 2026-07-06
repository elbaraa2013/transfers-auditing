import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewProps,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useColors } from "@/hooks/useColors";
import { statusColors, statusLabels } from "@/lib/format";

export function Card({ style, ...rest }: ViewProps) {
  const colors = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
        },
        style,
      ]}
      {...rest}
    />
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  small,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "destructive" | "success";
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: object;
}) {
  const colors = useColors();
  const bg =
    variant === "primary"
      ? colors.primary
      : variant === "destructive"
        ? colors.destructive
        : variant === "success"
          ? "#16a34a"
          : "transparent";
  const fg = variant === "outline" ? colors.primary : "#ffffff";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: colors.radius,
          paddingVertical: small ? 8 : 14,
          paddingHorizontal: small ? 14 : 20,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: colors.primary,
          opacity: disabled || loading ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <ThemedText
          style={{
            color: fg,
            fontFamily: "Cairo_700Bold",
            fontSize: small ? 13 : 15,
            textAlign: "center",
          }}
        >
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function StatusChip({ status }: { status: string }) {
  const color = statusColors[status] ?? "#8A6718";
  return (
    <View
      style={{
        backgroundColor: `${color}1A`,
        borderColor: color,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 2,
        alignSelf: "flex-start",
      }}
    >
      <ThemedText style={{ color, fontSize: 12, fontFamily: "Cairo_600SemiBold" }}>
        {statusLabels[status] ?? status}
      </ThemedText>
    </View>
  );
}

export function EmptyState({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) {
  const colors = useColors();
  return (
    <View style={{ alignItems: "center", paddingVertical: 48, gap: 12 }}>
      <Feather name={icon} size={40} color={colors.mutedForeground} />
      <ThemedText style={{ color: colors.mutedForeground, textAlign: "center" }}>{text}</ThemedText>
    </View>
  );
}

export function Field({
  label,
  ...rest
}: TextInputProps & { label?: string }) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? (
        <ThemedText style={{ fontFamily: "Cairo_600SemiBold", marginBottom: 6, fontSize: 13 }}>
          {label}
        </ThemedText>
      ) : null}
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          {
            borderColor: colors.border,
            borderRadius: colors.radius,
            backgroundColor: colors.card,
            color: colors.text,
          },
        ]}
        {...rest}
      />
    </View>
  );
}

export function Row({ style, ...rest }: ViewProps) {
  return <View style={[{ flexDirection: "row-reverse", alignItems: "center" }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    padding: 12,
    fontFamily: "Cairo_400Regular",
    textAlign: "right",
    writingDirection: "rtl",
  },
});
