import { Link, useLocation } from "wouter";
import { useState } from "react";
import { LayoutDashboard, FileText, ScanLine, CheckSquare, UserX, BookOpen, MessageCircle, LogOut, Download, Loader2, Banknote } from "lucide-react";
import { useClerk, useUser } from "@clerk/react";
import { useHealthCheck } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const navigation = [
  { name: "نظرة عامة", href: "/overview", icon: LayoutDashboard },
  { name: "إدارة الحوالات", href: "/transfers", icon: FileText },
  { name: "مسح الحوالات", href: "/scan", icon: ScanLine, alert: true },
  { name: "دفع نقدي", href: "/cash", icon: Banknote },
  { name: "المطابقة اليومية", href: "/matching", icon: CheckSquare, alert: true },
  { name: "تقرير الخمول", href: "/inactive", icon: UserX },
  { name: "كشف الحساب", href: "/statement", icon: BookOpen },
  { name: "واتساب", href: "/whatsapp", icon: MessageCircle },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { toast } = useToast();
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleBackup = async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    try {
      const res = await fetch("/api/backup", { credentials: "include" });
      if (!res.ok) throw new Error("backup failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hawala-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "تم تنزيل النسخة الاحتياطية" });
    } catch {
      toast({ title: "تعذّر إنشاء النسخة الاحتياطية", variant: "destructive" });
    } finally {
      setIsBackingUp(false);
    }
  };
  
  // Simulation of alerts, would normally come from specific queries.
  const hasPendingScans = true; 
  const hasPendingMatches = true;

  return (
    <div className="flex h-screen bg-[#F4EEE1] text-gray-900 overflow-hidden font-sans" dir="rtl">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1C1A17] text-white flex flex-col flex-shrink-0 no-print">
        <div className="p-4 flex items-center gap-3 border-b border-[#33302A]">
          <img src={`${basePath}/alwabil-logo.jpg`} alt="أوابل" className="w-10 h-10 rounded-full object-cover ring-2 ring-[#C9A227]/70 flex-shrink-0" />
          <h1 className="text-lg font-bold tracking-tight text-[#F3E6C0]">نظام تدقيق الحوالات</h1>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {navigation.map((item) => {
              const isActive = location === item.href;
              const showAlert = item.alert && ((item.href === '/scan' && hasPendingScans) || (item.href === '/matching' && hasPendingMatches));
              return (
                <li key={item.name}>
                  <Link href={item.href} className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                    isActive ? "bg-[#C9A227] text-[#1C1A17] font-semibold" : "text-[#D9C9A0] hover:bg-[#33302A] hover:text-white"
                  )}>
                    <item.icon className="w-5 h-5" />
                    <span>{item.name}</span>
                    {showAlert && (
                      <span className="mr-auto w-2 h-2 rounded-full bg-[#DC2626]" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 no-print">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-800">
              {navigation.find(n => n.href === location)?.name || "نظام تدقيق الحوالات"}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF4E3] border border-[#EAD9B0]">
              <div className="w-2 h-2 rounded-full bg-[#C9A227] animate-pulse" />
              <span className="text-xs font-medium text-[#6E5410]">متصل</span>
            </div>
            {userEmail && (
              <span className="text-sm text-gray-600 max-w-[180px] truncate" title={userEmail}>
                {userEmail}
              </span>
            )}
            <button
              type="button"
              onClick={handleBackup}
              disabled={isBackingUp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#8A6718] hover:bg-[#FAF4E3] transition-colors disabled:opacity-60"
            >
              {isBackingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>نسخة احتياطية</span>
            </button>
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-[#DC2626] transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>خروج</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 print-main">
          {children}
        </main>
      </div>
    </div>
  );
}