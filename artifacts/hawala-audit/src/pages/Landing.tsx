import { Link } from "wouter";
import { ShieldCheck, ScanLine, LockKeyhole } from "lucide-react";

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
    <div dir="rtl" className="min-h-[100dvh] bg-[#F4EEE1] text-gray-900 font-sans flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <img src={`${basePath}/alwabil-logo.jpg`} alt="أوابل" className="w-11 h-11 rounded-full object-cover ring-2 ring-[#C9A227]/60" />
          <span className="text-lg font-bold">نظام تدقيق الحوالات</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="px-4 py-2 text-sm font-semibold text-[#A6791E] hover:bg-[#FAF4E3] rounded-lg transition-colors"
          >
            تسجيل الدخول
          </Link>
          <Link
            href="/sign-up"
            className="px-4 py-2 text-sm font-semibold text-white bg-[#1C1A17] hover:bg-[#33302A] rounded-lg transition-colors"
          >
            إنشاء حساب
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
            دقّق حوالات مناديبك
            <span className="text-[#A6791E]"> بثقة وأمان</span>
          </h1>
          <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
            منصة متكاملة لتدقيق التحويلات البنكية الخاصة بمناديب المبيعات — مسح،
            مطابقة، واعتماد، مع عزل كامل لبيانات كل حساب.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="px-6 py-3 text-base font-semibold text-white bg-[#1C1A17] hover:bg-[#33302A] rounded-xl transition-colors"
            >
              ابدأ الآن مجاناً
            </Link>
            <Link
              href="/sign-in"
              className="px-6 py-3 text-base font-semibold text-[#A6791E] border border-[#A6791E]/30 hover:bg-[#FAF4E3] rounded-xl transition-colors"
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
              <div className="w-11 h-11 rounded-xl bg-[#FAF4E3] flex items-center justify-center mb-4">
                <f.icon className="w-6 h-6 text-[#A6791E]" />
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
