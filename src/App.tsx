import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Send, Bot, User, Loader2, Briefcase } from 'lucide-react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '안녕하세요! **옴므랩스 & 스레디** 전용 프리랜서 스케줄 및 급여 관리 어시스턴트입니다.\n\n날짜와 작업 내용(직군, 작업량 또는 매출)을 입력해주세요.\n\n*예시: "오늘 사진 작가 3착장 촬영했어요", "10월 25일 스레디 매출 500만원입니다."*'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: input.trim(),
        config: {
          systemInstruction: `당신은 '옴므랩스 & 스레디'의 전용 프리랜서 스케줄 및 급여 관리 어시스턴트입니다.
사용자의 입력에서 날짜, 프리랜서 직군, 작업량(또는 매출액)을 추출하세요.
직군은 다음 중 하나로 매핑해야 합니다: '사진 작가', '스타일리스트', '보정 작가', '콘텐츠 대행 직원(스레디)'.
정보가 부족하다면 isValid를 false로 하고 message에 어떤 정보가 더 필요한지 친절하게 물어보세요.
특히 '스레디'나 '콘텐츠 대행'이라는 단어가 있으면 '콘텐츠 대행 직원(스레디)'로 매핑하세요.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING, description: "작업 날짜 (예: 2023년 10월 25일, 10/25, 오늘 등)" },
              role: { type: Type.STRING, description: "프리랜서 직군 ('사진 작가', '스타일리스트', '보정 작가', '콘텐츠 대행 직원(스레디)' 중 하나)" },
              workAmount: { type: Type.NUMBER, description: "작업량 (착장 수, 사진 장수, 또는 매출액). 매출액의 경우 '원' 단위의 전체 숫자로 변환하여 입력 (예: 100만원 -> 1000000)." },
              isValid: { type: Type.BOOLEAN, description: "입력된 정보가 급여 계산을 하기에 충분한지 여부" },
              message: { type: Type.STRING, description: "정보가 부족할 경우 사용자에게 추가 정보를 요청하는 메시지, 충분할 경우 빈 문자열" }
            },
            required: ["date", "role", "workAmount", "isValid", "message"]
          }
        }
      });

      const text = response.text;
      if (text) {
        const data = JSON.parse(text);
        
        if (!data.isValid) {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: data.message
          }]);
        } else {
          let totalAmount = 0;
          let unit = '';
          
          switch (data.role) {
            case '사진 작가':
              totalAmount = data.workAmount * 25000;
              unit = `${data.workAmount}착장`;
              break;
            case '스타일리스트':
              totalAmount = data.workAmount * 8000;
              unit = `${data.workAmount}착장`;
              break;
            case '보정 작가':
              totalAmount = data.workAmount * 1500;
              unit = `${data.workAmount}장`;
              break;
            case '콘텐츠 대행 직원(스레디)':
              totalAmount = data.workAmount * 0.4;
              unit = `매출 ${data.workAmount.toLocaleString()}원`;
              break;
            default:
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: `알 수 없는 직군입니다: ${data.role}. '사진 작가', '스타일리스트', '보정 작가', '콘텐츠 대행 직원(스레디)' 중 하나를 입력해주세요.`
              }]);
              setIsLoading(false);
              return;
          }

          const actualPayment = Math.floor(totalAmount * (1 - 0.033));

          const formattedResponse = `📅 작업 일자: ${data.date}
🧑‍💼 프리랜서 직군: ${data.role}
📝 작업 내역: ${unit}
💰 총 발생 금액: ${totalAmount.toLocaleString()}원
📉 실 지급액 (3.3% 공제): ${actualPayment.toLocaleString()}원`;

          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: formattedResponse
          }]);
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: '오류가 발생했습니다. 다시 시도해주세요.',
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center shadow-sm sticky top-0 z-10">
        <div className="bg-indigo-100 p-2 rounded-lg mr-3">
          <Briefcase className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">옴므랩스 & 스레디</h1>
          <p className="text-xs text-slate-500 font-medium tracking-wide">급여 관리 어시스턴트</p>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex max-w-[85%] sm:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                  msg.role === 'user' ? 'bg-indigo-600 ml-3' : 'bg-slate-200 mr-3'
                }`}>
                  {msg.role === 'user' ? (
                    <User className="w-5 h-5 text-white" />
                  ) : (
                    <Bot className="w-5 h-5 text-slate-600" />
                  )}
                </div>
                <div
                  className={`px-4 py-3 rounded-2xl shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : msg.isError
                      ? 'bg-red-50 text-red-600 border border-red-100 rounded-tl-none'
                      : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                  }`}
                >
                  <div className="whitespace-pre-wrap leading-relaxed text-[15px]">
                    {msg.content}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex max-w-[85%] sm:max-w-[75%] flex-row">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-200 mr-3 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-slate-600" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-white border border-slate-100 rounded-tl-none shadow-sm flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                  <span className="text-sm text-slate-500">계산 중...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t border-slate-200 p-4">
        <div className="max-w-3xl mx-auto relative flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="날짜와 작업 내용을 입력하세요 (예: 오늘 사진 작가 5착장)"
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none min-h-[52px] max-h-[120px] text-[15px]"
            rows={1}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 bottom-2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="max-w-3xl mx-auto mt-2 text-center">
          <p className="text-[11px] text-slate-400">
            단가: 사진 작가(2.5만/착장), 스타일리스트(0.8만/착장), 보정 작가(1.5천/장), 스레디(매출 40%)
          </p>
        </div>
      </footer>
    </div>
  );
}
