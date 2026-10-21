import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Plus, 
  Send, 
  History, 
  Trash2, 
  Sword, 
  ChevronRight, 
  Loader2, 
  Info, 
  Trophy, 
  Scale, 
  Brain, 
  Gavel, 
  Sparkles, 
  Zap,
  Download,
  Laptop,
  Smartphone,
  ExternalLink,
  Copy,
  Check,
  X,
  Monitor,
  AlertCircle,
  Key
} from "lucide-react";

interface Round {
  personaName: string;
  message: string;
}

interface Score {
  personaIndex: number;
  score: number;
}

interface DebateResult {
  id: string;
  topic: string;
  personasUsed: string[];
  rounds: Round[];
  summary: string;
  verdict: string;
  scores: Score[];
  createdAt: string;
}

export default function App() {
  const [topic, setTopic] = useState("");
  const [personas, setPersonas] = useState<string[]>([
    "논리와 사실을 중시하는 AI 과학자",
    "공감과 인간적 가치를 중시하는 AI 예술가"
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentDebate, setCurrentDebate] = useState<DebateResult | null>(null);
  const [history, setHistory] = useState<DebateResult[]>([]);
  const [view, setView] = useState<"new" | "result" | "history">("new");
  const [visibleRoundsCount, setVisibleRoundsCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [currentDebate, visibleRoundsCount]);

  useEffect(() => {
    if (currentDebate && view === "result" && visibleRoundsCount < currentDebate.rounds.length) {
      const timer = setTimeout(() => {
        setVisibleRoundsCount(prev => prev + 1);
      }, 1500); // 1.5초마다 하나씩 공개
      return () => clearTimeout(timer);
    }
  }, [currentDebate, visibleRoundsCount, view]);

  const addPersona = () => {
    if (personas.length < 4) {
      setPersonas([...personas, `개성 넘치는 토론자 ${personas.length + 1}`]);
    }
  };

  const removePersona = (index: number) => {
    if (personas.length > 2) {
      setPersonas(personas.filter((_, i) => i !== index));
    }
  };

  const updatePersona = (index: number, value: string) => {
    const next = [...personas];
    next[index] = value;
    setPersonas(next);
  };

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Bring Your Own Key (BYOK) state for quota exhaustion protection
  const [userApiKey, setUserApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem("user_gemini_api_key") || "";
    } catch {
      return "";
    }
  });
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");
  const [quotaModalInputKey, setQuotaModalInputKey] = useState("");
  const [quotaUrlCopied, setQuotaUrlCopied] = useState(false);
  const [serverQuotaExhausted, setServerQuotaExhausted] = useState(false);
  const [quotaAlertModal, setQuotaAlertModal] = useState<{ show: boolean; message: string; details: string }>({
    show: false,
    message: "",
    details: ""
  });

  // 영구 독립 접속 주소 (Google AI Studio 로그인 없이 24시간 언제든 접속 가능한 Shared App URL)
  const getPermanentAppUrl = () => {
    if (typeof window !== "undefined") {
      if (window.location.hostname.includes("ais-dev-")) {
        return window.location.origin.replace("ais-dev-", "ais-pre-");
      }
      return window.location.origin;
    }
    return "https://ais-pre-jmdd6gdofyxi57cxkhdh73-324830255896.asia-northeast1.run.app";
  };

  const copyApiKeyPageUrl = () => {
    try {
      navigator.clipboard.writeText("https://aistudio.google.com/app/apikey");
      setQuotaUrlCopied(true);
      setTimeout(() => setQuotaUrlCopied(false), 2000);
    } catch {}
  };

  useEffect(() => {
    // 만약 기존에 데스크톱 앱으로 열었는데 주소가 여전히 개발용(ais-dev-)이라면, 영구 주소(ais-pre-)로 자동 전환
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    if (isStandalone && window.location.hostname.includes('ais-dev-')) {
      const target = window.location.href.replace('ais-dev-', 'ais-pre-');
      window.location.replace(target);
      return;
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      
      // install=true 파라미터가 있는 경우 즉시 설치 창 띄우기
      if (window.location.search.includes('install=true')) {
        setTimeout(() => {
          try {
            e.prompt();
          } catch (err) {
            console.log(err);
          }
        }, 500);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    window.addEventListener("appinstalled", () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
      setShowInstallModal(false);
    });

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    // 1. 이미 최상위 창이고 브라우저 설치 준비(deferredPrompt)가 완료된 경우
    if (deferredPrompt && window.self === window.top && !window.location.hostname.includes("ais-dev-")) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          setIsInstallable(false);
          setDeferredPrompt(null);
          return;
        }
      } catch (err) {
        console.error(err);
      }
    }

    // 2. 그 외의 경우 (AI스튜디오 미리보기 내부, 개발자 주소, 또는 브라우저 설치 가이드가 필요한 경우)
    setShowInstallModal(true);
  };

  const handleOpenPermanentWindow = () => {
    const targetUrl = getPermanentAppUrl() + "/?install=true";
    window.open(targetUrl, "_blank");
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(getPermanentAppUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/debates");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setHistory(data);
          try {
            localStorage.setItem("ai_debates_history", JSON.stringify(data));
          } catch (e) {}
          return;
        }
      }
    } catch (err) {
      console.warn("Server history fetch issue, reading local cache", err);
    }
    try {
      const cached = localStorage.getItem("ai_debates_history");
      if (cached) setHistory(JSON.parse(cached));
    } catch (e) {}
  };

  const startDebate = async (overrideKey?: string) => {
    if (!topic || personas.some(p => !p.trim())) return;

    const activeKey = (overrideKey !== undefined ? overrideKey : userApiKey).trim();

    // 사용하기 전 이미 할당량이 소모된 상태이고 개인 키가 없다면 친절 안내 팝업을 바로 띄움
    if (serverQuotaExhausted && !activeKey) {
      setQuotaModalInputKey("");
      setQuotaAlertModal({
        show: true,
        message: "하루 할당량이 다 소모되었습니다. 개인 API키를 입력해주세요",
        details: "오늘 기본 제공되는 무료 API의 하루 할당량이 모두 소모되었습니다. 구글 AI Studio에서 무료로 발급받을 수 있는 개인 API 키를 등록해주세요."
      });
      return;
    }

    setIsGenerating(true);
    setView("result");
    setCurrentDebate(null);
    setVisibleRoundsCount(0);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (activeKey) {
        headers["x-gemini-api-key"] = activeKey;
      }

      const res = await fetch("/api/debate/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({ 
          topic, 
          personas,
          customApiKey: activeKey || undefined
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        if (res.status === 429 || data.isQuotaExhausted) {
          setServerQuotaExhausted(true);
          setQuotaModalInputKey(activeKey);
          setQuotaAlertModal({
            show: true,
            message: data.error || "하루 할당량이 다 소모되었습니다. 개인 API키를 입력해주세요",
            details: data.details || "오늘 기본 제공되는 무료 API의 하루 할당량이 모두 소모되었습니다. 개인 무료 구글 Gemini API 키를 등록하시면 대기 없이 즉시 토론을 계속 이용하실 수 있습니다."
          });
          setView("new");
          return;
        }
        throw new Error(data.error || "토론 생성 중 오류가 발생했습니다.");
      }

      setServerQuotaExhausted(false);
      setCurrentDebate(data);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "토론 생성 중 오류가 발생했습니다.");
      setView("new");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveDebate = async () => {
    if (!currentDebate) return;
    let serverOk = false;
    try {
      const res = await fetch("/api/debates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentDebate),
      });
      if (res.ok) serverOk = true;
    } catch (err) {
      console.warn("Server save fallback to local storage:", err);
    }

    try {
      const cached = JSON.parse(localStorage.getItem("ai_debates_history") || "[]");
      const updated = [currentDebate, ...cached.filter((d: any) => d.id !== currentDebate.id)];
      localStorage.setItem("ai_debates_history", JSON.stringify(updated));
      setHistory(updated);
    } catch (e) {}

    if (serverOk) {
      fetchHistory();
    }
    alert("토론 내용이 아카이브에 성공적으로 저장되었습니다.");
  };

  const deleteDebate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("정말 이 토론 기록을 삭제하시겠습니까?")) return;
    try {
      await fetch(`/api/debates/${id}`, { method: "DELETE" });
    } catch (err) {
      console.warn("Server delete issue, updating local cache:", err);
    }

    try {
      const cached = JSON.parse(localStorage.getItem("ai_debates_history") || "[]");
      const updated = cached.filter((d: any) => d.id !== id);
      localStorage.setItem("ai_debates_history", JSON.stringify(updated));
      setHistory(updated);
      if (currentDebate?.id === id) {
        setCurrentDebate(null);
        setView("new");
      }
    } catch (e) {}
  };

  const selectHistory = (debate: DebateResult) => {
    setCurrentDebate(debate);
    setView("result");
    setVisibleRoundsCount(debate.rounds.length);
  };

  const getPersonaColor = (index: number) => {
    const colors = ["indigo", "rose", "emerald", "amber"];
    return colors[index % colors.length];
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-24">
      {/* 배경 장식 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-50">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-100/60 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-rose-100/60 blur-[140px] rounded-full" />
      </div>

      {/* 헤더 네비게이션 */}
      <nav className="border-b border-neutral-200/60 px-8 py-5 flex items-center justify-between sticky top-0 bg-white/70 backdrop-blur-xl z-50 shadow-sm">
        <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setView("new")}>
          <div className="w-11 h-11 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-all shadow-lg shadow-indigo-600/30">
            <Sword className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none text-neutral-800">AI <span className="text-indigo-600">토론</span></h1>
            <span className="text-[10px] text-neutral-400 uppercase tracking-[0.25em] font-bold mt-1 block">AI Debate</span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-2.5">
          <button 
            onClick={() => { setTempApiKey(userApiKey); setShowApiKeyModal(true); }}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-sm cursor-pointer hover:translate-y-[-2px] active:translate-y-[0px] ${
              userApiKey 
                ? 'bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100' 
                : 'bg-white border border-neutral-200 hover:border-indigo-300 text-neutral-600 hover:bg-neutral-50'
            }`}
            title="Gemini API 키 관리"
          >
            <Key size={14} className={userApiKey ? "text-emerald-600" : "text-neutral-500"} />
            <span className="hidden sm:inline">{userApiKey ? "개인 키 연결됨" : "API 설정"}</span>
          </button>
          <button 
            onClick={handleInstallClick}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 hover:opacity-95 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:translate-y-[-2px] active:translate-y-[0px] transition-all cursor-pointer"
            title="앱 설치"
          >
            <Download size={15} />
            <span>앱 설치</span>
          </button>
          <button 
            onClick={() => setView("history")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all duration-300 ${
              view === 'history' 
                ? 'bg-neutral-900 text-white shadow-xl translate-y-[-2px]' 
                : 'bg-white border border-neutral-200 hover:border-indigo-300 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <History size={15} />
            <span className="hidden sm:inline">아카이브</span>
          </button>
          <button 
            onClick={() => { setView("new"); setCurrentDebate(null); setTopic(""); }}
            className="flex items-center gap-2 bg-white border border-neutral-200 hover:border-indigo-300 text-neutral-700 hover:bg-neutral-50 px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all shadow-sm hover:translate-y-[-2px]"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">새 토론 만들기</span>
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-6 md:p-12 relative z-10">
        <AnimatePresence mode="wait">
          {view === "new" && (
            <motion.div 
              key="new"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-3xl mx-auto"
            >
              <div className="text-center space-y-6 mb-16">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-neutral-200 rounded-full text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm"
                >
                  <Sparkles size={13} />
                  Advanced Reasoning Engine 3.5
                </motion.div>
                <h2 className="text-5xl font-black tracking-tight leading-tight sm:text-7xl text-neutral-900">
                  어떤 주제든 <br/>
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-violet-600 to-rose-600">끝까지 논쟁하세요</span>
                </h2>
              </div>

              <div className="bg-white border border-neutral-200 rounded-[3rem] p-10 space-y-12 shadow-2xl shadow-neutral-200/40 relative overflow-hidden">
                <div className="space-y-5 relative">
                  <label className="text-[11px] uppercase font-black tracking-[0.3em] text-neutral-400 flex items-center gap-2.5 ml-1">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                    토론 주제
                  </label>
                  <div className="relative group">
                    <input 
                      type="text" 
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="예: 현대 사회에서 AI의 예술적 영감 인정 여부"
                      className="w-full bg-neutral-50 border-2 border-neutral-100/80 rounded-2xl px-6 py-5 text-2xl font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder:text-neutral-300"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <div>
                      <label className="text-[11px] uppercase font-black tracking-[0.3em] text-neutral-400 flex items-center gap-2.5 ml-1">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                        참여자 성향 설정 (최대 4명)
                      </label>
                      <p className="text-neutral-400 text-[11px] font-medium ml-1 mt-1">
                        각 참가자의 성향, 가치관, 직업을 적어주시면 AI가 해당 입장의 뉴스·논문·실제 사례를 취합해 토론합니다.
                      </p>
                    </div>
                    {personas.length < 4 && (
                      <button 
                        onClick={addPersona}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 transition-colors bg-indigo-50 px-3.5 py-1.5 rounded-xl cursor-pointer self-start sm:self-auto shrink-0"
                      >
                        <Plus size={14} /> 토론자 추가
                      </button>
                    )}
                  </div>

                  {/* 성향 프리셋 칩 */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">추천 성향 태그 (클릭하여 토론자로 추가)</span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "실증 데이터·통계 중심 경제학자",
                        "헌법·법치주의 엄격 해석 법률가",
                        "기술 혁신·규제 완화 실용주의자",
                        "환경·기후 정의 및 생태 활동가",
                        "의료 공공성 및 생명윤리 보건학자",
                        "노동 인권 및 사회안전망 대변인"
                      ].map((preset, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => {
                            if (personas.length < 4) {
                              setPersonas([...personas, preset]);
                            } else {
                              updatePersona(personas.length - 1, preset);
                            }
                          }}
                          className="text-[11px] font-medium bg-neutral-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 border border-transparent px-3 py-1.5 rounded-xl transition-all cursor-pointer text-neutral-600"
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {personas.map((p, idx) => {
                      const color = getPersonaColor(idx);
                      const bgClass = color === 'indigo' ? 'bg-indigo-50/50 border-indigo-100' :
                                    color === 'rose' ? 'bg-rose-50/50 border-rose-100' :
                                    color === 'emerald' ? 'bg-emerald-50/50 border-emerald-100' :
                                    'bg-amber-50/50 border-amber-100';
                      const textClass = color === 'indigo' ? 'text-indigo-600' :
                                      color === 'rose' ? 'text-rose-600' :
                                      color === 'emerald' ? 'text-emerald-600' :
                                      'text-amber-600';

                      return (
                        <motion.div 
                          key={idx}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`space-y-3 p-5 rounded-3xl border-2 transition-all ${bgClass}`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <label className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${textClass}`}>
                              참가자 {idx + 1} 성향 및 입장
                            </label>
                            {personas.length > 2 && (
                              <button onClick={() => removePersona(idx)} className="text-neutral-300 hover:text-rose-500 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                          <textarea 
                            value={p}
                            onChange={(e) => updatePersona(idx, e.target.value)}
                            rows={3}
                            placeholder="예: 실증 통계와 경제적 파급효과를 중시하는 거시경제학자"
                            className="w-full bg-transparent text-sm font-bold border-none outline-none resize-none placeholder:text-neutral-300 text-neutral-700 leading-normal"
                          />
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* 하루 할당량 소모 시 사전 안내 배너 */}
                {serverQuotaExhausted && !userApiKey && (
                  <motion.div 
                    initial={{ opacity: 0, y: -6 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 sm:p-5 bg-gradient-to-r from-amber-50 to-rose-50 border border-amber-200/80 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                        <AlertCircle size={20} />
                      </div>
                      <div>
                        <div className="font-black text-rose-700 text-xs sm:text-sm">
                          하루 할당량이 다 소모되었습니다. 개인 API키를 입력해주세요
                        </div>
                        <div className="text-neutral-500 text-[11px] font-medium">
                          무료 키를 등록하시면 기다릴 필요 없이 즉시 토론을 시작하실 수 있습니다.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setQuotaModalInputKey("");
                        setQuotaAlertModal({
                          show: true,
                          message: "하루 할당량이 다 소모되었습니다. 개인 API키를 입력해주세요",
                          details: "오늘 기본 제공되는 무료 API의 하루 할당량이 모두 소모되었습니다. 구글 AI Studio에서 무료로 발급받은 개인 API 키를 등록해주세요."
                        });
                      }}
                      className="shrink-0 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Key size={13} />
                      <span>개인 키 입력하기</span>
                    </button>
                  </motion.div>
                )}

                <motion.button 
                  whileHover={{ scale: 1.01, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => startDebate()}
                  disabled={!topic || isGenerating}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:grayscale text-white py-6 rounded-[2.5rem] text-xl font-black uppercase tracking-[0.25em] flex items-center justify-center gap-4 transition-all shadow-xl shadow-indigo-600/30"
                >
                  {isGenerating ? <Loader2 className="animate-spin" /> : <Sword size={26} />}
                  토론 시작하기
                </motion.button>

                {/* API 키 상태 및 설정 안내 */}
                <div className="flex flex-col sm:flex-row items-center justify-between px-3 pt-1 gap-2 text-[11px] text-neutral-400">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${userApiKey ? "bg-emerald-500 animate-pulse" : serverQuotaExhausted ? "bg-rose-500" : "bg-indigo-500"}`} />
                    <span className="font-medium text-neutral-500">
                      {userApiKey 
                        ? `개인 API 키 적용 중 (${userApiKey.slice(0, 6)}••••${userApiKey.slice(-4)}) · 한도 제한 없음` 
                        : serverQuotaExhausted
                          ? "기본 공유 할당량 소진됨 · 개인 무료 키 입력 필요"
                          : "기본 제공 무료 API로 누구나 즉시 이용 가능"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTempApiKey(userApiKey);
                      setShowApiKeyModal(true);
                    }}
                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold transition-colors cursor-pointer"
                  >
                    <Key size={12} />
                    <span>{userApiKey ? "API 키 설정 변경" : "개인 무료 키 직접 등록"}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {view === "result" && (
            <motion.div 
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-[0.3em]">
                    <Zap size={14} /> LIVE DEBATE SESSION
                  </div>
                  <h3 className="text-4xl font-black tracking-tight text-neutral-900 border-l-8 border-indigo-600 pl-6">
                    {currentDebate?.topic || topic}
                  </h3>
                </div>
                {currentDebate && !history.find(h => h.id === currentDebate.id) && (
                  <button 
                    onClick={saveDebate}
                    className="flex items-center gap-2.5 bg-white hover:bg-neutral-900 text-neutral-900 hover:text-white px-7 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border border-neutral-200 shadow-lg"
                  >
                    <History size={16} />
                    <span>아카이브 저장</span>
                  </button>
                )}
              </div>

              <div 
                ref={scrollRef} 
                className="space-y-8 max-h-[70vh] overflow-y-auto pr-6 scrollbar-thin scrollbar-thumb-neutral-200"
                style={{ scrollbarGutter: 'stable' }}
              >
                {!currentDebate ? (
                  <div className="h-96 flex flex-col items-center justify-center space-y-8 bg-white rounded-[3.5rem] border border-neutral-100 border-dashed shadow-inner">
                    <div className="relative">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                        className="w-32 h-32 border-4 border-indigo-500/10 border-t-indigo-600 rounded-full"
                      />
                      <Brain className="absolute inset-0 m-auto w-12 h-12 text-indigo-600 animate-pulse" />
                    </div>
                    <div className="text-center">
                       <p className="text-neutral-400 font-black text-xs uppercase tracking-[0.5em] animate-pulse">지식 대결 생성 중...</p>
                    </div>
                  </div>
                ) : (
                  currentDebate.rounds.slice(0, visibleRoundsCount).map((round, idx) => {
                    const personaIndex = currentDebate.personasUsed.findIndex(p => p.includes(round.personaName) || round.personaName.includes(p));
                    const color = getPersonaColor(personaIndex === -1 ? idx : personaIndex);
                    
                    return (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, y: 25 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex flex-col ${idx % 2 === 0 ? 'items-start' : 'items-end'}`}
                      >
                        <div className={`group relative max-w-[88%] rounded-[2.5rem] p-9 transition-all shadow-sm ${
                          color === 'indigo' ? 'bg-indigo-50 border-indigo-100 text-indigo-950 rounded-bl-none' :
                          color === 'rose' ? 'bg-rose-50 border-rose-100 text-rose-950 rounded-br-none' :
                          color === 'emerald' ? 'bg-emerald-50 border-emerald-100 text-emerald-950 rounded-bl-none' :
                          'bg-amber-50 border-amber-100 text-amber-950 rounded-br-none'
                        }`}>
                          <div className={`absolute top-0 ${idx % 2 === 0 ? 'left-0' : 'right-0'} ${
                            color === 'indigo' ? 'bg-indigo-500' :
                            color === 'rose' ? 'bg-rose-500' :
                            color === 'emerald' ? 'bg-emerald-500' :
                            'bg-amber-500'
                          } w-1.5 h-full opacity-40 rounded-full group-hover:opacity-100 transition-opacity`} />
                          <span className={`text-[10px] font-black uppercase tracking-[0.3em] mb-4 block ${
                            color === 'indigo' ? 'text-indigo-600' :
                            color === 'rose' ? 'text-rose-600' :
                            color === 'emerald' ? 'text-emerald-600' :
                            'text-amber-600'
                          }`}>
                            {round.personaName}
                          </span>
                          <p className="leading-relaxed text-lg font-semibold tracking-tight text-neutral-800/90 whitespace-pre-wrap">
                            {round.message}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {currentDebate && visibleRoundsCount === currentDebate.rounds.length && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-8"
                >
                  <div className="lg:col-span-8 bg-white border border-neutral-200 rounded-[3.5rem] p-12 relative overflow-hidden shadow-xl">
                    <div className="relative z-10 space-y-7">
                      <div className="flex items-center gap-3 text-indigo-600">
                        <Scale size={28} />
                        <h4 className="font-black uppercase tracking-[0.35em] text-sm">토론 분석 요약</h4>
                      </div>
                      <p className="text-neutral-700 text-xl font-medium leading-[1.7] italic">
                        "{currentDebate.summary}"
                      </p>
                    </div>
                  </div>

                  <div className="lg:col-span-4 bg-white border border-neutral-200 rounded-[3.5rem] p-12 flex flex-col justify-center gap-10 shadow-xl">
                    <div className="flex items-center gap-3 text-orange-500">
                      <Trophy size={28} />
                      <h4 className="font-black uppercase tracking-[0.3em] text-sm">참여자별 승률</h4>
                    </div>
                    
                    <div className="space-y-6">
                      {currentDebate.scores.map((s, idx) => {
                        const color = getPersonaColor(s.personaIndex);
                        const name = currentDebate.personasUsed[s.personaIndex]?.split(' ')[0] || `참가자 ${s.personaIndex + 1}`;
                        return (
                          <div key={idx} className="space-y-2">
                            <div className="flex justify-between items-end">
                              <span className={`text-[11px] font-black uppercase tracking-wider ${
                                color === 'indigo' ? 'text-indigo-600' :
                                color === 'rose' ? 'text-rose-600' :
                                color === 'emerald' ? 'text-emerald-600' :
                                'text-amber-600'
                              }`}>{name}</span>
                              <span className="text-2xl font-black text-neutral-900">{s.score}%</span>
                            </div>
                            <div className="h-3 bg-neutral-100 rounded-full overflow-hidden p-0.5 shadow-inner">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${s.score}%` }}
                                transition={{ duration: 1.5, ease: "easeOut", delay: idx * 0.2 }}
                                className={`h-full rounded-full ${
                                  color === 'indigo' ? 'bg-indigo-500' :
                                  color === 'rose' ? 'bg-rose-500' :
                                  color === 'emerald' ? 'bg-emerald-500' :
                                  'bg-amber-500'
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="lg:col-span-12 bg-white border-2 border-indigo-200 rounded-[3.5rem] md:rounded-[4rem] p-8 md:p-14 relative overflow-hidden shadow-2xl">
                    <div className="relative z-10 space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4 text-indigo-600">
                          <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                             <Gavel size={26} />
                          </div>
                          <div>
                            <h4 className="font-black uppercase tracking-[0.35em] text-sm italic">Final Verdict</h4>
                            <span className="text-xs text-indigo-600 font-black uppercase tracking-widest block mt-0.5">AI 심판관 최종 판정</span>
                          </div>
                        </div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-50 to-emerald-50 border border-indigo-200/80 rounded-full text-indigo-800 text-xs font-black self-start sm:self-auto shadow-sm">
                          <Sparkles size={14} className="text-indigo-600" />
                          100% 최적의 종합 솔루션 (Optimal Synthesis)
                        </div>
                      </div>
                      <div className="bg-indigo-50/50 backdrop-blur-md rounded-[2.5rem] p-8 md:p-12 border border-indigo-100 shadow-inner">
                        <p className="text-neutral-900 text-lg md:text-xl leading-[1.85] font-semibold tracking-tight whitespace-pre-wrap">
                          {currentDebate.verdict || "기록된 판정 결과가 없습니다."}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {view === "history" && (
            <motion.div 
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              <div className="flex flex-col items-center justify-center space-y-4 mb-16 text-center">
                <div className="w-16 h-1 bg-gradient-to-r from-indigo-600 to-rose-600 rounded-full" />
                <h2 className="text-5xl font-black italic tracking-tighter text-neutral-900 underline decoration-indigo-600 underline-offset-8">기록 아카이브</h2>
                <p className="text-neutral-400 font-bold uppercase tracking-[0.3em] text-xs">Past Intellectual Clashes</p>
              </div>

              {history.length === 0 ? (
                <div className="py-28 text-center bg-white rounded-[3.5rem] border-2 border-neutral-100 border-dashed shadow-sm">
                  <History className="w-20 h-20 text-neutral-100 mx-auto mb-8" />
                  <p className="text-neutral-400 text-lg font-medium italic">아직 기록된 대결이 없습니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {history.map((debate) => (
                    <motion.div 
                      key={debate.id}
                      whileHover={{ y: -12, scale: 1.02 }}
                      onClick={() => selectHistory(debate)}
                      className="group bg-white hover:bg-neutral-50 border border-neutral-200 rounded-[3rem] p-10 cursor-pointer transition-all relative overflow-hidden flex flex-col justify-between min-h-[300px] shadow-lg hover:shadow-2xl"
                    >
                      <div className="relative">
                        <div className="flex justify-between items-center mb-8">
                          <span className="text-[10px] font-black font-mono text-neutral-300 uppercase tracking-[0.25em]">
                            {new Date(debate.createdAt).toLocaleDateString()}
                          </span>
                          <button 
                            onClick={(e) => deleteDebate(debate.id, e)}
                            className="text-neutral-200 hover:text-rose-500 p-2.5 transition-all hover:bg-rose-50 rounded-2xl"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        <h4 className="text-2xl font-bold mb-6 group-hover:text-neutral-900 transition-colors line-clamp-3 leading-[1.3] text-neutral-700 tracking-tight">{debate.topic}</h4>
                      </div>

                      <div className="relative pt-8 border-t border-neutral-100 flex items-center gap-4">
                        <div className="flex -space-x-3">
                           {debate.personasUsed.map((_, i) => (
                             <div key={i} className={`w-8 h-8 rounded-full border-[3px] border-white shadow-md ${
                               getPersonaColor(i) === 'indigo' ? 'bg-indigo-500' :
                               getPersonaColor(i) === 'rose' ? 'bg-rose-500' :
                               getPersonaColor(i) === 'emerald' ? 'bg-emerald-500' :
                               'bg-amber-500'
                             }`} />
                           ))}
                        </div>
                        <span className="text-[10px] font-black text-neutral-300 uppercase tracking-widest">
                          {debate.personasUsed.length}인 관점 참여
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
         <motion.div 
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="bg-white/80 border border-neutral-200 backdrop-blur-2xl px-14 py-5 rounded-[2.5rem] flex items-center gap-14 shadow-2xl ring-1 ring-neutral-900/5"
         >
            <div className="flex flex-col items-center">
               <span className="text-[9px] font-black uppercase text-neutral-400 tracking-[0.35em]">Active Archives</span>
               <span className="text-base font-black text-indigo-600 mt-0.5">{history.length}</span>
            </div>
            <div className="w-px h-8 bg-neutral-200" />
            <div className="text-[11px] font-bold text-neutral-500 hidden sm:block italic tracking-tight">
               "다양한 목소리가 모여 하나의 논리를 완성합니다."
            </div>
         </motion.div>
      </footer>

      {/* 앱 설치 모달 */}
      <AnimatePresence>
        {showInstallModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-neutral-900/60 backdrop-blur-md"
            onClick={() => setShowInstallModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] p-6 sm:p-9 max-w-xl w-full shadow-2xl space-y-6 relative overflow-hidden max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowInstallModal(false)}
                className="absolute top-6 right-6 text-neutral-400 hover:text-neutral-900 transition-colors p-2 rounded-full hover:bg-neutral-100 cursor-pointer"
              >
                <X size={20} />
              </button>

              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full text-indigo-600 text-[11px] font-black uppercase tracking-widest">
                  <Monitor size={14} /> 앱 설치
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight leading-tight">
                  <span className="text-indigo-600">AI 토론</span> 앱 설치
                </h3>
                <p className="text-neutral-500 text-xs sm:text-sm font-medium leading-relaxed">
                  PC 바탕화면 또는 모바일 기기에 바로가기 앱을 설치하여 편리하게 이용하실 수 있습니다.
                </p>
              </div>

              {/* 주요 액션 버튼 */}
              <div className="space-y-3 pt-1">
                <button
                  onClick={handleOpenPermanentWindow}
                  className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white py-4 px-6 rounded-2xl font-black text-sm tracking-wide shadow-xl shadow-indigo-500/25 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                >
                  <ExternalLink size={18} />
                  <span>앱 설치 창 열기</span>
                </button>
                <div className="flex items-center justify-between gap-3 p-3 bg-neutral-50 border border-neutral-200/70 rounded-2xl">
                  <div className="text-[11px] font-mono text-neutral-500 truncate max-w-[280px]">
                    {getPermanentAppUrl()}
                  </div>
                  <button
                    onClick={handleCopyUrl}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-200 text-neutral-700 hover:text-indigo-600 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    <span>{copied ? "복사됨!" : "주소 복사"}</span>
                  </button>
                </div>
              </div>

              {/* PC / 모바일 설치 순서 */}
              <div className="space-y-3 pt-1">
                <h4 className="text-xs font-black text-neutral-400 uppercase tracking-widest">설치 방법</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-neutral-800">
                      <Laptop size={16} className="text-indigo-600" />
                      <span>PC (Chrome / Edge)</span>
                    </div>
                    <ol className="list-decimal list-inside text-neutral-500 space-y-1 text-[11px] leading-relaxed">
                      <li>위 [앱 설치 창 열기]를 클릭합니다.</li>
                      <li>주소창 우측의 <strong>[설치 🖥️]</strong> 아이콘을 누릅니다.</li>
                      <li>바탕화면에 아이콘이 생성됩니다.</li>
                    </ol>
                  </div>

                  <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-neutral-800">
                      <Smartphone size={16} className="text-indigo-600" />
                      <span>모바일 (스마트폰)</span>
                    </div>
                    <ol className="list-decimal list-inside text-neutral-500 space-y-1 text-[11px] leading-relaxed">
                      <li>Safari: 하단 [공유] &gt; <strong>[홈 화면에 추가]</strong></li>
                      <li>Chrome: 우측 상단 [⋮] &gt; <strong>[앱 설치]</strong></li>
                      <li>홈 화면에 바로가기 앱이 등록됩니다.</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="text-center pt-1">
                <button 
                  onClick={() => setShowInstallModal(false)}
                  className="text-xs text-neutral-400 hover:text-neutral-600 font-bold transition-colors cursor-pointer py-1"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API 키 설정 모달 (BYOK & 무료 한도 방어) */}
      <AnimatePresence>
        {showApiKeyModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-neutral-900/60 backdrop-blur-md"
            onClick={() => setShowApiKeyModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] p-6 sm:p-9 max-w-xl w-full shadow-2xl space-y-6 relative overflow-hidden max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowApiKeyModal(false)}
                className="absolute top-6 right-6 text-neutral-400 hover:text-neutral-900 transition-colors p-2 rounded-full hover:bg-neutral-100 cursor-pointer"
              >
                <X size={20} />
              </button>

              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full text-indigo-600 text-[11px] font-black uppercase tracking-widest">
                  <Key size={14} /> Gemini API 설정
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight leading-tight">
                  <span className="text-indigo-600">API 키</span> 관리
                </h3>
                <p className="text-neutral-500 text-xs sm:text-sm font-medium leading-relaxed">
                  본 앱은 기본적으로 서버 공유 무료 API로 즉시 이용할 수 있습니다. 개인 전용 키를 등록하시면 불특정 다수의 동시 접속으로 인한 한도 제한 없이 쾌적하게 사용하실 수 있습니다.
                </p>
              </div>

              {/* 현재 상태 뱃지 */}
              <div className="p-4 rounded-2xl border transition-all text-xs flex items-center justify-between gap-3 bg-neutral-50 border-neutral-200">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${userApiKey ? "bg-emerald-500 animate-pulse" : "bg-indigo-500"}`} />
                  <div>
                    <div className="font-bold text-neutral-800">
                      {userApiKey ? "개인 전용 API 키 활성화됨" : "서버 기본 무료 키 사용 중"}
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      {userApiKey 
                        ? `등록된 키: ${userApiKey.slice(0, 6)}••••••••${userApiKey.slice(-4)}`
                        : "별도 설정 없이도 누구나 기본 토론 생성이 가능합니다."
                      }
                    </div>
                  </div>
                </div>
                {userApiKey && (
                  <button
                    onClick={() => {
                      localStorage.removeItem("user_gemini_api_key");
                      setUserApiKey("");
                      setTempApiKey("");
                    }}
                    className="shrink-0 px-2.5 py-1.5 bg-neutral-200 hover:bg-rose-100 text-neutral-600 hover:text-rose-600 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                  >
                    초기화
                  </button>
                )}
              </div>

              {/* 입력 폼 */}
              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase tracking-widest text-neutral-400 block">
                  개인 Gemini API Key 등록
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    placeholder="AIzaSy... 키를 붙여넣으세요"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3.5 text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                  />
                </div>
                <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-neutral-600 truncate font-mono text-[11px]">
                    <ExternalLink size={12} className="text-indigo-600 shrink-0" />
                    <span className="truncate">https://aistudio.google.com/app/apikey</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={copyApiKeyPageUrl}
                      className="px-2.5 py-1 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg text-[11px] font-bold text-neutral-700 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      {quotaUrlCopied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                      <span>{quotaUrlCopied ? "복사됨" : "링크 복사"}</span>
                    </button>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>발급 사이트</span>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
                <div className="text-[10px] text-neutral-400">
                  🔒 등록하신 키는 서버에 저장되지 않고 본인 브라우저(LocalStorage)에만 안전하게 보관됩니다.
                </div>
              </div>

              {/* 저장 버튼 */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => {
                    const cleaned = tempApiKey.trim();
                    if (cleaned) {
                      localStorage.setItem("user_gemini_api_key", cleaned);
                      setUserApiKey(cleaned);
                    } else {
                      localStorage.removeItem("user_gemini_api_key");
                      setUserApiKey("");
                    }
                    setShowApiKeyModal(false);
                    if (quotaAlertModal.show) {
                      setQuotaAlertModal({ show: false, message: "", details: "" });
                    }
                  }}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs tracking-wide shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
                >
                  설정 저장하기
                </button>
                <button
                  onClick={() => setShowApiKeyModal(false)}
                  className="w-full py-2.5 text-neutral-400 hover:text-neutral-600 text-xs font-bold transition-colors cursor-pointer"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 무료 사용량(Quota) 초과 시 친절 안내 모달 */}
      <AnimatePresence>
        {quotaAlertModal.show && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-neutral-900/70 backdrop-blur-md"
            onClick={() => setQuotaAlertModal({ show: false, message: "", details: "" })}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] p-6 sm:p-9 max-w-xl w-full shadow-2xl space-y-6 relative overflow-hidden max-h-[92vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* 상단 닫기 버튼 */}
              <button 
                onClick={() => setQuotaAlertModal({ show: false, message: "", details: "" })}
                className="absolute top-6 right-6 text-neutral-400 hover:text-neutral-900 transition-colors p-2 rounded-full hover:bg-neutral-100 cursor-pointer"
              >
                <X size={20} />
              </button>

              {/* 헤더 & 정확한 사용자 요청 문구 */}
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-full text-amber-700 text-[11px] font-black uppercase tracking-widest">
                  <AlertCircle size={14} /> 일일 무료 사용량 안내
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight leading-snug">
                  하루 할당량이 다 소모되었습니다.<br />
                  <span className="text-indigo-600">개인 API키를 입력해주세요</span>
                </h3>
                <p className="text-neutral-600 text-xs sm:text-sm leading-relaxed">
                  오늘 기본 제공되는 서버 무료 API의 하루 할당량이 모두 소진되었습니다. 구글에서 <strong>누구나 100% 무료</strong>로 발급받을 수 있는 개인 API 키 코드를 등록하시면 대기 시간 없이 즉시 토론을 무제한으로 계속 이용하실 수 있습니다.
                </p>
              </div>

              {/* 1. API 코드 복사/발급 링크 카드 */}
              <div className="p-4 sm:p-5 bg-indigo-50/60 border border-indigo-100 rounded-3xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ExternalLink size={13} className="text-indigo-600" /> Google API Key 발급 링크
                  </span>
                  <span className="text-[10px] text-indigo-600 font-bold bg-indigo-100/70 px-2 py-0.5 rounded-full">
                    100% 무료 · 카드등록 불필요
                  </span>
                </div>
                
                <div className="flex items-center gap-2 bg-white p-2.5 rounded-2xl border border-indigo-100 text-xs text-neutral-700 font-mono">
                  <span className="truncate flex-1 select-all text-neutral-600 font-medium text-[11px]">
                    https://aistudio.google.com/app/apikey
                  </span>
                  <button
                    onClick={copyApiKeyPageUrl}
                    className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                  >
                    {quotaUrlCopied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{quotaUrlCopied ? "복사됨!" : "링크 복사"}</span>
                  </button>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer shadow-sm"
                  >
                    <span>사이트 열기</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>

              {/* 2. 상세 방법 안내 (4단계 가이드) */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
                  📖 개인 API 키 1분 발급 방법 안내
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-1">
                    <div className="font-black text-neutral-800 flex items-center gap-1.5 text-[11px]">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                      발급 페이지 접속
                    </div>
                    <p className="text-[11px] text-neutral-500 leading-snug">
                      위 발급 링크를 클릭하여 Google 계정으로 간편 로그인합니다.
                    </p>
                  </div>

                  <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-1">
                    <div className="font-black text-neutral-800 flex items-center gap-1.5 text-[11px]">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                      키 생성 버튼 클릭
                    </div>
                    <p className="text-[11px] text-neutral-500 leading-snug">
                      화면 왼쪽 위의 파란색 <strong>&apos;Create API key&apos;</strong> 버튼을 클릭합니다.
                    </p>
                  </div>

                  <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-1">
                    <div className="font-black text-neutral-800 flex items-center gap-1.5 text-[11px]">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                      API 코드 복사
                    </div>
                    <p className="text-[11px] text-neutral-500 leading-snug">
                      생성된 팝업에서 본인의 <strong>API 코드(AIzaSy...)</strong>를 복사합니다.
                    </p>
                  </div>

                  <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-1">
                    <div className="font-black text-neutral-800 flex items-center gap-1.5 text-[11px]">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">4</span>
                      아래 입력 후 시작
                    </div>
                    <p className="text-[11px] text-neutral-500 leading-snug">
                      아래 입력창에 붙여넣고 버튼을 누르면 즉시 토론이 시작됩니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. 인라인 API 키 입력창 */}
              <div className="space-y-2 pt-1">
                <label className="text-[11px] font-black uppercase tracking-wider text-neutral-600 block">
                  복사한 개인 API 코드 붙여넣기
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={quotaModalInputKey}
                    onChange={(e) => setQuotaModalInputKey(e.target.value)}
                    placeholder="AIzaSy... 복사한 코드를 여기에 붙여넣어 주세요"
                    className="w-full bg-neutral-50 border border-neutral-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-2xl px-4 py-3.5 text-xs text-neutral-800 font-mono outline-none transition-all"
                  />
                </div>
                <div className="text-[10px] text-neutral-400 flex items-center justify-between">
                  <span>🔒 입력하신 키는 브라우저 내부(LocalStorage)에만 안전하게 보관됩니다.</span>
                </div>
              </div>

              {/* 4. 액션 버튼 */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => {
                    const cleaned = quotaModalInputKey.trim();
                    if (!cleaned) {
                      alert("복사한 Gemini API 키 코드를 입력해주세요.");
                      return;
                    }
                    localStorage.setItem("user_gemini_api_key", cleaned);
                    setUserApiKey(cleaned);
                    setServerQuotaExhausted(false);
                    setQuotaAlertModal({ show: false, message: "", details: "" });
                    // 즉시 토론 진행 재개!
                    startDebate(cleaned);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 hover:opacity-95 text-white rounded-2xl font-bold text-xs tracking-wide shadow-xl shadow-indigo-500/25 transition-all cursor-pointer"
                >
                  <Key size={15} />
                  <span>키 저장하고 바로 토론 시작하기</span>
                </button>
                <button
                  onClick={() => setQuotaAlertModal({ show: false, message: "", details: "" })}
                  className="w-full py-2.5 text-neutral-400 hover:text-neutral-600 text-xs font-bold transition-colors cursor-pointer"
                >
                  나중에 하기 / 닫기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
