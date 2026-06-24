import { Link } from "wouter";
import { Landmark, ShieldCheck, ScanLine, LockKeyhole } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const features = [
  {
    icon: ScanLine,
    title: "مسح الحوالات تلقائياً",
    desc: "ارفع صور الإشعارات واستخرج بيانات الحوالة فوراً دون إدخال يدوي.",
  },
  {
    icon: ShieldCheck,
    title: "تدقيق ومطابقة دقيقة",
    desc: "راجع الحوالات المعلّقة، طابقها مع المناديب، واعتمدها بثقة.",
  },
  {
    icon: LockKeyhole,
    title: "بياناتك معزولة وآمنة",
    desc: "كل حساب يرى بياناته فقط، مع إمكانية تنزيل نسخة احتياطية في أي وقت.",
  },
];

export default function Landing() {
  return (
    <div dir="rtl" className="min-h-[100dvh] bg-gray-50 text-gray-900 font-sans flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0F6E56] flex items-center justify-center">
            <Landmark className="w-6 h-6 text-white" />
          </div>
          <span className="text-lg font-bold">نظام تدقيق الحوالات</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="px-4 py-2 text-sm font-semibold text-[#0F6E56] hover:bg-emerald-50 rounded-lg transition-colors"
          >
            تسجيل الدخول
          </Link>
          <Link
            href="/sign-up"
            className="px-4 py-2 text-sm font-semibold text-white bg-[#0F6E56] hover:bg-[#128266] rounded-lg transition-colors"
          >
            إنشاء حساب
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
            دقّق حوالات مناديبك
            <span className="text-[#0F6E56]"> بثقة وأمان</span>
          </h1>
          <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
            منصة متكاملة لتدقيق التحويلات البنكية الخاصة بمناديب المبيعات — مسح،
            مطابقة، واعتماد، مع عزل كامل لبيانات كل حساب.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="px-6 py-3 text-base font-semibold text-white bg-[#0F6E56] hover:bg-[#128266] rounded-xl transition-colors"
            >
              ابدأ الآن مجاناً
            </Link>
            <Link
              href="/sign-in"
              className="px-6 py-3 text-base font-semibold text-[#0F6E56] border border-[#0F6E56]/30 hover:bg-emerald-50 rounded-xl transition-colors"
            >
              لديّ حساب
            </Link>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 pb-24 grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-2xl border border-gray-200 p-6 text-right"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
                <f.icon className="w-6 h-6 text-[#0F6E56]" />
              </div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white py-6 text-center text-sm text-gray-500">
        نظام تدقيق الحوالات © {new Date().getFullYear()}
      </footer>
    </div>
  );
}

export { basePath };
