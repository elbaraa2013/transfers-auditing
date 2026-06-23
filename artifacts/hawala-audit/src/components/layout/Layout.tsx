import { Link, useLocation } from "wouter";
import { LayoutDashboard, FileText, ScanLine, CheckSquare, UserX, BookOpen, MessageCircle, Landmark } from "lucide-react";
import { useHealthCheck } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "نظرة عامة", href: "/", icon: LayoutDashboard },
  { name: "إدارة الحوالات", href: "/transfers", icon: FileText },
  { name: "مسح الحوالات", href: "/scan", icon: ScanLine, alert: true },
  { name: "المطابقة اليومية", href: "/matching", icon: CheckSquare, alert: true },
  { name: "تقرير الخمول", href: "/inactive", icon: UserX },
  { name: "كشف الحساب", href: "/statement", icon: BookOpen },
  { name: "واتساب", href: "/whatsapp", icon: MessageCircle },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck();
  
  // Simulation of alerts, would normally come from specific queries.
  const hasPendingScans = true; 
  const hasPendingMatches = true;

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden font-sans" dir="rtl">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0F6E56] text-white flex flex-col flex-shrink-0 no-print">
        <div className="p-4 flex items-center gap-3 border-b border-[#128266]">
          <Landmark className="w-8 h-8 text-white" />
          <h1 className="text-xl font-bold tracking-tight">نظام تدقيق الحوالات</h1>
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
                    isActive ? "bg-[#128266] text-white" : "text-emerald-50 hover:bg-[#128266]/50 hover:text-white"
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
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-800">متصل</span>
            </div>
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