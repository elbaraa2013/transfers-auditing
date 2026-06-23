import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  useListConversations, 
  useGetConversation,
  getGetConversationQueryKey
} from "@workspace/api-client-react";
import { formatDateTime } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Send, Image as ImageIcon, CheckCheck, User } from "lucide-react";

export default function Whatsapp() {
  const [, setLocation] = useLocation();
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading: loadingConversations } = useListConversations();
  const { data: messages, isLoading: loadingMessages } = useGetConversation(selectedAgentId!, {
    query: {
      enabled: !!selectedAgentId,
      queryKey: getGetConversationQueryKey(selectedAgentId!)
    }
  });

  const filteredConversations = conversations?.filter(c => 
    c.agentName.toLowerCase().includes(search.toLowerCase())
  );

  const selectedAgentName = conversations?.find(c => c.agentId === selectedAgentId)?.agentName;

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleScanImage = (imageUrl: string) => {
    // In a real app, we might pass the URL to the scan page, or download it.
    // Here we just navigate to the scan page to let the user upload it.
    setLocation('/scan');
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
      {/* Sidebar - Chat List */}
      <div className="w-80 flex-shrink-0 border-l border-gray-200 flex flex-col bg-gray-50">
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="relative">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="البحث في المحادثات..." 
              className="pl-3 pr-10 bg-gray-100 border-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4 border-b border-gray-100">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))
          ) : filteredConversations?.length === 0 ? (
            <div className="p-8 text-center text-gray-500">لا توجد محادثات</div>
          ) : (
            filteredConversations?.map((conv) => (
              <div 
                key={conv.agentId}
                className={`flex items-start gap-3 p-4 border-b border-gray-100 cursor-pointer transition-colors ${selectedAgentId === conv.agentId ? 'bg-emerald-50' : 'hover:bg-gray-100'}`}
                onClick={() => setSelectedAgentId(conv.agentId)}
              >
                <Avatar className="w-12 h-12 border border-gray-200">
                  <AvatarFallback className="bg-[#0F6E56] text-white">
                    {conv.agentName.substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h4 className="font-semibold text-gray-900 truncate">{conv.agentName}</h4>
                    <span className="text-xs text-gray-500 whitespace-nowrap mr-2">
                      {new Date(conv.lastMessageAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-600 truncate">{conv.lastMessage}</p>
                    {conv.unreadCount > 0 && (
                      <span className="bg-[#16A34A] text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ml-1 flex-shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[#efeae2]">
        {!selectedAgentId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-50">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4 border-8 border-white shadow-sm">
              <User className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-medium text-gray-700">نظام تدقيق الحوالات</h3>
            <p className="mt-2 text-sm">اختر محادثة للبدء في المراسلة</p>
          </div>
        ) : loadingMessages ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-[#0F6E56] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="h-16 px-6 bg-white border-b border-gray-200 flex items-center gap-3 shadow-sm z-10 relative">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-[#0F6E56] text-white">
                  {selectedAgentName?.substring(0, 2) || "م"}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-gray-900">{selectedAgentName}</h3>
                <p className="text-xs text-green-600">متصل</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
              {messages?.map((msg) => {
                const isOutgoing = msg.direction === 'outgoing';
                return (
                  <div key={msg.id} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-lg p-3 shadow-sm relative ${isOutgoing ? 'bg-[#dcf8c6] rounded-tl-none' : 'bg-white rounded-tr-none'}`}>
                      {msg.type === 'image' && msg.imageUrl ? (
                        <div className="mb-2">
                          <img src={msg.imageUrl} alt="صورة مرسلة" className="rounded-md max-h-64 object-cover cursor-pointer" />
                          {!isOutgoing && (
                            <Button 
                              size="sm" 
                              variant="secondary" 
                              className="w-full mt-2 bg-[#0F6E56]/10 hover:bg-[#0F6E56]/20 text-[#0F6E56] font-semibold"
                              onClick={() => handleScanImage(msg.imageUrl!)}
                            >
                              <ImageIcon className="w-4 h-4 ml-2" />
                              مسح واستخراج البيانات
                            </Button>
                          )}
                        </div>
                      ) : null}
                      <p className="text-gray-800 text-sm whitespace-pre-wrap">{msg.content}</p>
                      <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-gray-500">
                        <span>{new Date(msg.sentAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                        {isOutgoing && <CheckCheck className="w-3 h-3 text-blue-500" />}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <div className="flex gap-2 items-center bg-white p-2 rounded-full border border-gray-300 shadow-sm focus-within:border-[#0F6E56] focus-within:ring-1 focus-within:ring-[#0F6E56]">
                <Input 
                  placeholder="اكتب رسالة..." 
                  className="flex-1 border-none shadow-none focus-visible:ring-0 bg-transparent px-4"
                />
                <Button size="icon" className="rounded-full bg-[#0F6E56] hover:bg-[#0b5341] flex-shrink-0">
                  <Send className="w-4 h-4 mr-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}