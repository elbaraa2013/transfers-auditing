import React, { useState } from "react";
import { Image, Modal, Platform, StyleSheet, View, Pressable, FlatList } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useScanTransferImage,
  useCreateTransfer,
  useCreateCashPayment,
  useListAgents,
  getListTransfersQueryKey,
  getListPendingTransfersQueryKey,
  getGetTransferStatsQueryKey,
  getListAgentsQueryKey,
  getGetAgentStatementQueryKey,
  type ScanResult,
} from "@workspace/api-client-react";
import { ThemedText } from "@/components/ThemedText";
import { Button, Card, Field, Row } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { errMsg } from "@/lib/format";

type Mode = "scan" | "manual" | "cash";

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
}

export function TransferForm({
  fixedAgentId,
  fixedAgentName,
  allowCash = false,
  onSuccess,
}: {
  fixedAgentId?: number;
  fixedAgentName?: string;
  allowCash?: boolean;
  onSuccess?: () => void;
}) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("scan");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);

  // Form fields
  const [operationNumber, setOperationNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [fromAccount, setFromAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [comment, setComment] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [riskScore, setRiskScore] = useState(0);
  const [agentId, setAgentId] = useState<number | null>(fixedAgentId ?? null);
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);

  const { data: agents } = useListAgents({
    query: { enabled: fixedAgentId == null, queryKey: getListAgentsQueryKey() },
  });
  const selectedAgent =
    fixedAgentId != null
      ? { id: fixedAgentId, name: fixedAgentName ?? "" }
      : agents?.find((a) => a.id === agentId);

  const scanMutation = useScanTransferImage();
  const createMutation = useCreateTransfer();
  const cashMutation = useCreateCashPayment();

  const resetForm = () => {
    setOperationNumber("");
    setAmount("");
    setFromAccount("");
    setToAccount("");
    setRecipientName("");
    setComment("");
    setTransferDate("");
    setRiskScore(0);
    setImageUri(null);
    setScanned(false);
    setConfidence(null);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListTransfersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListPendingTransfersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTransferStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
    if (selectedAgent?.id != null) {
      queryClient.invalidateQueries({ queryKey: getGetAgentStatementQueryKey(selectedAgent.id) });
    }
  };

  const applyScan = (r: ScanResult) => {
    setOperationNumber(r.operationNumber ?? "");
    setAmount(r.amount != null ? String(r.amount) : "");
    setFromAccount(r.fromAccount ?? "");
    setToAccount(r.toAccount ?? "");
    setRecipientName(r.recipientName ?? "");
    setComment(r.comment ?? "");
    setTransferDate(r.transferDate ?? "");
    setRiskScore(r.riskScore ?? 0);
    setConfidence(r.confidence ?? null);
    setScanned(true);
  };

  const pickImage = async (fromCamera: boolean) => {
    setError(null);
    setSuccess(null);
    try {
      if (fromCamera && Platform.OS !== "web") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setError("يجب السماح بالوصول إلى الكاميرا");
          return;
        }
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            base64: true,
            quality: 0.7,
          });
      if (result.canceled || !result.assets?.[0]?.base64) return;
      setImageUri(result.assets[0].uri);
      scanMutation.mutate(
        { data: { imageBase64: result.assets[0].base64 } },
        {
          onSuccess: (r) => applyScan(r),
          onError: (e) => setError(errMsg(e, "تعذّر تحليل الصورة")),
        },
      );
    } catch {
      setError("تعذّر فتح الصورة");
    }
  };

  const submitTransfer = () => {
    setError(null);
    setSuccess(null);
    const numericAmount = Number(amount);
    if (!operationNumber.trim()) {
      setError("رقم العملية مطلوب");
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("المبلغ غير صحيح");
      return;
    }
    const finalAgentId = fixedAgentId ?? agentId;
    if (finalAgentId == null) {
      setError("يجب اختيار المندوب");
      return;
    }
    createMutation.mutate(
      {
        data: {
          operationNumber: operationNumber.trim(),
          amount: numericAmount,
          fromAccount: fromAccount.trim() || undefined,
          toAccount: toAccount.trim() || undefined,
          recipientName: recipientName.trim() || undefined,
          comment: comment.trim() || undefined,
          agentId: finalAgentId,
          riskScore,
          transferDate: transferDate.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          haptic();
          invalidate();
          resetForm();
          setSuccess("تم تسجيل الحوالة بنجاح");
          onSuccess?.();
        },
        onError: (e) => setError(errMsg(e, "تعذّر تسجيل الحوالة")),
      },
    );
  };

  const submitCash = () => {
    setError(null);
    setSuccess(null);
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("المبلغ غير صحيح");
      return;
    }
    const finalAgentId = fixedAgentId ?? agentId;
    if (finalAgentId == null) {
      setError("يجب اختيار المندوب");
      return;
    }
    cashMutation.mutate(
      {
        data: {
          agentId: finalAgentId,
          amount: numericAmount,
          recipientName: recipientName.trim() || undefined,
          comment: comment.trim() || undefined,
          transferDate: transferDate.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          haptic();
          invalidate();
          resetForm();
          setSuccess("تم تسجيل الدفعة النقدية بنجاح");
          onSuccess?.();
        },
        onError: (e) => setError(errMsg(e, "تعذّر تسجيل الدفعة")),
      },
    );
  };

  const modes: { key: Mode; label: string }[] = [
    { key: "scan", label: "مسح إيصال" },
    { key: "manual", label: "إدخال يدوي" },
    ...(allowCash ? [{ key: "cash" as Mode, label: "دفعة نقدية" }] : []),
  ];

  const agentPicker =
    fixedAgentId == null ? (
      <View style={{ marginBottom: 12 }}>
        <ThemedText style={{ fontFamily: "Cairo_600SemiBold", marginBottom: 6, fontSize: 13 }}>
          المندوب
        </ThemedText>
        <Pressable
          onPress={() => setAgentPickerOpen(true)}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: colors.radius,
            backgroundColor: colors.card,
            padding: 12,
            flexDirection: "row-reverse",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <ThemedText style={{ color: selectedAgent ? colors.text : colors.mutedForeground }}>
            {selectedAgent?.name || "اختر المندوب"}
          </ThemedText>
          <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
        </Pressable>
        <Modal visible={agentPickerOpen} transparent animationType="fade">
          <Pressable style={styles.modalBackdrop} onPress={() => setAgentPickerOpen(false)}>
            <View
              style={[
                styles.modalCard,
                { backgroundColor: colors.card, borderRadius: colors.radius },
              ]}
            >
              <ThemedText type="subtitle" style={{ marginBottom: 12 }}>
                اختر المندوب
              </ThemedText>
              <FlatList
                data={agents ?? []}
                keyExtractor={(a) => String(a.id)}
                style={{ maxHeight: 320 }}
                ListEmptyComponent={
                  <ThemedText style={{ color: colors.mutedForeground, paddingVertical: 16 }}>
                    لا يوجد مناديب بعد
                  </ThemedText>
                }
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      setAgentId(item.id);
                      setAgentPickerOpen(false);
                    }}
                    style={{
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      flexDirection: "row-reverse",
                      justifyContent: "space-between",
                    }}
                  >
                    <ThemedText style={{ fontFamily: "Cairo_600SemiBold" }}>{item.name}</ThemedText>
                    {agentId === item.id ? (
                      <Feather name="check" size={18} color={colors.primary} />
                    ) : null}
                  </Pressable>
                )}
              />
            </View>
          </Pressable>
        </Modal>
      </View>
    ) : null;

  const transferFields = (
    <>
      {agentPicker}
      <Field
        label="رقم العملية"
        value={operationNumber}
        onChangeText={setOperationNumber}
        placeholder="رقم العملية من الإيصال"
      />
      <Field
        label="المبلغ (ج.س)"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholder="0"
      />
      <Field label="من حساب" value={fromAccount} onChangeText={setFromAccount} placeholder="اختياري" />
      <Field label="إلى حساب" value={toAccount} onChangeText={setToAccount} placeholder="اختياري" />
      <Field
        label="اسم المستلم"
        value={recipientName}
        onChangeText={setRecipientName}
        placeholder="اختياري"
      />
      <Field label="تاريخ الحوالة" value={transferDate} onChangeText={setTransferDate} placeholder="اختياري" />
      <Field label="ملاحظة" value={comment} onChangeText={setComment} placeholder="اختياري" />
      <Button
        title="تسجيل الحوالة"
        onPress={submitTransfer}
        loading={createMutation.isPending}
      />
    </>
  );

  return (
    <View>
      <Row style={{ gap: 8, marginBottom: 16 }}>
        {modes.map((m) => (
          <Pressable
            key={m.key}
            onPress={() => {
              setMode(m.key);
              setError(null);
              setSuccess(null);
            }}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: colors.radius,
              alignItems: "center",
              backgroundColor: mode === m.key ? colors.primary : colors.secondary,
            }}
          >
            <ThemedText
              style={{
                fontFamily: "Cairo_700Bold",
                fontSize: 13,
                color: mode === m.key ? colors.primaryForeground : colors.secondaryForeground,
              }}
            >
              {m.label}
            </ThemedText>
          </Pressable>
        ))}
      </Row>

      {error ? (
        <ThemedText type="error" style={{ marginBottom: 12 }}>
          {error}
        </ThemedText>
      ) : null}
      {success ? (
        <ThemedText style={{ marginBottom: 12, color: "#16a34a", fontFamily: "Cairo_600SemiBold" }}>
          {success}
        </ThemedText>
      ) : null}

      {mode === "scan" ? (
        <Card>
          {!scanned ? (
            <>
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: "100%", height: 180, borderRadius: 8, marginBottom: 12 }}
                  resizeMode="contain"
                />
              ) : (
                <View style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
                  <Feather name="camera" size={36} color={colors.mutedForeground} />
                  <ThemedText style={{ color: colors.mutedForeground, textAlign: "center" }}>
                    صوّر إيصال بنكك أو اختر صورة من المعرض ليتم استخراج البيانات تلقائياً
                  </ThemedText>
                </View>
              )}
              {scanMutation.isPending ? (
                <Button title="جارٍ تحليل الصورة..." onPress={() => {}} loading />
              ) : (
                <Row style={{ gap: 8 }}>
                  {Platform.OS !== "web" ? (
                    <Button
                      title="الكاميرا"
                      onPress={() => pickImage(true)}
                      style={{ flex: 1 }}
                    />
                  ) : null}
                  <Button
                    title="اختيار صورة"
                    variant={Platform.OS !== "web" ? "outline" : "primary"}
                    onPress={() => pickImage(false)}
                    style={{ flex: 1 }}
                  />
                </Row>
              )}
            </>
          ) : (
            <>
              <Row style={{ justifyContent: "space-between", marginBottom: 12 }}>
                <ThemedText type="subtitle">مراجعة البيانات المستخرجة</ThemedText>
                {confidence != null ? (
                  <ThemedText style={{ fontSize: 12, color: colors.mutedForeground }}>
                    الدقة: {Math.round(confidence * 100)}%
                  </ThemedText>
                ) : null}
              </Row>
              {transferFields}
              <Button
                title="مسح صورة أخرى"
                variant="outline"
                onPress={() => {
                  resetForm();
                }}
                style={{ marginTop: 8 }}
              />
            </>
          )}
        </Card>
      ) : mode === "manual" ? (
        <Card>{transferFields}</Card>
      ) : (
        <Card>
          {agentPicker}
          <Field
            label="المبلغ (ج.س)"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0"
          />
          <Field
            label="اسم المستلم"
            value={recipientName}
            onChangeText={setRecipientName}
            placeholder="اختياري"
          />
          <Field label="تاريخ الدفعة" value={transferDate} onChangeText={setTransferDate} placeholder="اختياري" />
          <Field label="ملاحظة" value={comment} onChangeText={setComment} placeholder="اختياري" />
          <Button title="تسجيل الدفعة النقدية" onPress={submitCash} loading={cashMutation.isPending} />
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    padding: 20,
  },
});
