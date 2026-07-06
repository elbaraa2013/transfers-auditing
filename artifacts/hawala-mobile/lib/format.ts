export function errMsg(e: unknown, fallback = "حدث خطأ غير متوقع"): string {
  const data = (e as { data?: { error?: string } } | null)?.data;
  if (data && typeof data.error === "string" && data.error.trim()) return data.error;
  return fallback;
}

export function fmtAmount(n: number): string {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ج.س`;
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric" });
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("ar", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const clerkErrorMessages: Record<string, string> = {
  form_identifier_not_found: "لا يوجد حساب بهذا البريد الإلكتروني. أنشئ حساباً جديداً أولاً.",
  form_password_incorrect: "كلمة المرور غير صحيحة.",
  form_param_format_invalid: "البريد الإلكتروني غير صالح. تأكد من كتابته بشكل صحيح.",
  form_identifier_exists: "هذا البريد مسجل مسبقاً. جرّب تسجيل الدخول بدلاً من إنشاء حساب.",
  form_password_pwned: "كلمة المرور هذه مسربة في اختراقات سابقة. اختر كلمة مرور أخرى.",
  form_password_length_too_short: "كلمة المرور قصيرة جداً. استخدم 8 أحرف على الأقل.",
  form_code_incorrect: "رمز التحقق غير صحيح.",
  verification_expired: "انتهت صلاحية رمز التحقق. أعد المحاولة.",
  too_many_requests: "محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.",
  session_exists: "أنت مسجل الدخول بالفعل.",
};

export function clerkErrMsg(e: unknown, fallback = "حدث خطأ. أعد المحاولة."): string {
  const errors = (e as { errors?: { code?: string; longMessage?: string; message?: string }[] } | null)
    ?.errors;
  const first = errors?.[0];
  if (first?.code && clerkErrorMessages[first.code]) return clerkErrorMessages[first.code];
  if (first?.longMessage) return first.longMessage;
  if (first?.message) return first.message;
  return fallback;
}

export const statusLabels: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "مقبولة",
  rejected: "مرفوضة",
};

export const statusColors: Record<string, string> = {
  pending: "#A6791E",
  approved: "#16a34a",
  rejected: "#ef4444",
};
