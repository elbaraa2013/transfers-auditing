import React from "react";
import { ScrollView } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { TransferForm } from "@/components/TransferForm";

export default function ScanScreen() {
  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <TransferForm allowCash />
      </ScrollView>
    </ThemedView>
  );
}
