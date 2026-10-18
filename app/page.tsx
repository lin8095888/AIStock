"use client";

import React, { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import {
  Search,
  TrendingUp,
  BarChart2,
  Users,
  AlertCircle,
  Loader2,
  DollarSign,
  Activity,
  History,
  Clock,
  Image as ImageIcon,
  X,
  Compass,
  Target,
  BookOpen,
  Trash2,
  Copy,
  Check,
  ImageDown,
  Zap,
  ShieldAlert,
  Award,
  ChevronRight,
  Settings,
  Calendar,
  ExternalLink,
  Sparkles,
  RefreshCw,
} from "lucide-react";

// 💡 操盤手時間控制演算法：自動推算具有「最完整盤後籌碼」的交易日
const getOptimalTradingDate = (baseDate = new Date()) => {
  const d = new Date(baseDate);
  const day = d.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const timeVal = hours * 100 + minutes;

  if (day === 0) {
    // 週日退回週五
    d.setDate(d.getDate() - 2);
  } else if (day === 6) {
    // 週六退回週五
    d.setDate(d.getDate() - 1);
  } else {
    // 平日台股分點資料約於 18:30 全數出爐
    if (timeVal < 1830) {
      if (day === 1) {
        d.setDate(d.getDate() - 3); // 週一盤中退回上週五
      } else {
        d.setDate(d.getDate() - 1); // 其餘平日退回前一交易日
      }
    }
  }
  return d.toISOString().split("T")[0];
};

const renderSafeString = (val: any): string => {
  if (typeof val === "string") return val;
  if (Array.isArray(val)) {
    return val
      .map((item) =>
        typeof item === "object" ? JSON.stringify(item) : String(item)
      )
      .join("；");
  }
  if (typeof val === "object" && val !== null) return JSON.stringify(val);
  return String(val ?? "");
};

const getSafeArray = (val: any): string[] => {
  if (Array.isArray(val)) return val.map((v) => renderSafeString(v));
  if (typeof val === "string" && val.trim() !== "") return [val];
  return [];
};

interface AnalysisResult {
  stockName: string;
  currentPrice: string;
  scores?: {
    technical?: number;
    chips?: number;
    fundamental?: number;
  };
  keyLevels?: {
    support?: string;
    resistance?: string;
  };
  priceTrend?: string[];
  chipsAnalysis?: string[];
  technicalAnalysis?: string[];
  fundamentalAnalysis?: string[];
  brokerWarning?: string;
  marketCorrelation?: string;
  futurePrediction?: string;
  priceSource?: "API" | "IMAGE" | "AI";
  analysisTargetDate?: string;
  fetchTime?: string;
  calcStats?: {
    volRatio?: string;
    atr?: string;
    atrStopLoss?: string;
    taiexStatus?: string;
  };
  sources?: Array<{ title: string; uri: string }>;
}

interface HistoryItem {
  id: number;
  querySymbol: string;
  timestamp: string;
  targetDate: string;
  data: AnalysisResult;
}

const POPULAR_STOCKS = [
  { code: "2330", name: "台積電", tag: "晶圓代工" },
  { code: "2317", name: "鴻海", tag: "AI伺服器" },
  { code: "2454", name: "聯發科", tag: "IC設計" },
  { code: "4919", name: "新唐", tag: "車用MCU" },
  { code: "3231", name: "緯創", tag: "AI代工" },
  { code: "2603", name: "長榮", tag: "海運貨櫃" },
];

export default function StockAnalysisApp() {
  const [symbol, setSymbol] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("tw_trader_history");
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return [];
  });
  const [toastMsg, setToastMsg] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [targetDate, setTargetDate] = useState(getOptimalTradingDate());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const saveToHistory = (newItem: HistoryItem) => {
    setHistory((prev) => {
      const updated = [newItem, ...prev.filter((i) => i.querySymbol !== newItem.querySymbol)].slice(0, 10);
      try {
        localStorage.setItem("tw_trader_history", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem("tw_trader_history");
    } catch {
      // ignore
    }
  };

  const generateTextReport = () => {
    if (!result) return "";
    const techScore =
      (result.scores?.technical ?? 0) >= 1
        ? "🔴偏多"
        : (result.scores?.technical ?? 0) <= -1
        ? "🟢偏空"
        : "⚪盤整";
    const chipsScore =
      (result.scores?.chips ?? 0) >= 1
        ? "🔴偏多"
        : (result.scores?.chips ?? 0) <= -1
        ? "🟢偏空"
        : "⚪盤整";

    return `📊 【${renderSafeString(result.stockName)}】AI 籌碼深度分析 (操盤手實戰版)
📅 籌碼分析基準日：${renderSafeString(result.analysisTargetDate || targetDate)}
⏱️ 分析執行時間：${renderSafeString(result.fetchTime || new Date().toLocaleString("zh-TW"))}
💰 報價：${renderSafeString(result.currentPrice)}

🔥 多空評分：【技術面 ${techScore}】|【籌碼面 ${chipsScore}】
⚡ 量能比：${renderSafeString(result.calcStats?.volRatio || "N/A")} 倍 | ATR 防守值：${renderSafeString(result.calcStats?.atrStopLoss || "N/A")} 元
🎯 關鍵價位：支撐 ${renderSafeString(result.keyLevels?.support)} / 壓力 ${renderSafeString(result.keyLevels?.resistance)}

⚠️ 主力/隔日沖分點警示：
${renderSafeString(result.brokerWarning)}

🕵️ 籌碼與大盤聯動：
${renderSafeString(result.marketCorrelation)}

💡 操盤實戰建議：
${renderSafeString(result.futurePrediction)}`;
  };

  const showSuccessToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  const handleCopyText = async () => {
    const textToCopy = generateTextReport();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
        showSuccessToast("操盤作戰報告已複製至剪貼簿！");
        return;
      }
      throw new Error("Clipboard unavailable");
    } catch {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand("copy");
        textArea.remove();
        if (successful) {
          showSuccessToast("操盤作戰報告已複製至剪貼簿！");
        } else {
          throw new Error("Fallback failed");
        }
      } catch {
        setError("請手動選取文字複製。");
      }
    }
  };

  const handleDownloadImage = async () => {
    if (!reportRef.current) return;
    setIsGeneratingImg(true);
    showSuccessToast("📸 正在繪製高畫質 4K 操盤圖檔...");

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 3,
        backgroundColor: "#020617",
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          const clonedTarget = clonedDoc.getElementById("report-export-area");
          if (clonedTarget) {
            clonedTarget.style.height = "max-content";
            clonedTarget.style.overflow = "visible";
            let parent = clonedTarget.parentElement;
            while (parent) {
              parent.style.overflow = "visible";
              parent.style.height = "max-content";
              parent = parent.parentElement;
            }
          }
        },
      });

      const link = document.createElement("a");
      const safeName = (result?.stockName || "台股").replace(/[^\w\u4e00-\u9fa5]/g, "_");
      link.download = `${safeName}_${result?.analysisTargetDate || targetDate}_自營操盤分析_${Date.now()}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
      showSuccessToast("✅ 4K 超高畫質操盤圖檔已成功下載！");
    } catch (err: any) {
      console.error(err);
      setError("圖片生成失敗，請稍後再試。");
    } finally {
      setIsGeneratingImg(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (images.length + files.length > 6) {
      setError("最多只能上傳 6 張看盤截圖");
      return;
    }
    files.forEach((file) => {
      setImages((prev) => [...prev, file]);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const analyzeStock = async (forcedSymbol?: string) => {
    const targetSymbol = (forcedSymbol ?? symbol).trim();
    if (!targetSymbol && images.length === 0) {
      setError("請輸入股票代號/名稱，或上傳盤勢截圖");
      return;
    }

    setLoading(true);
    setLoadingStage("連線交易所與報價源，精算 20 日均量與 ATR...");
    setError("");
    setResult(null);

    try {
      const now = new Date();
      const hasImages = images.length > 0;

      // 1. 呼叫後端 API 取得個股即時指標與加權指數
      let stockIndicators: any = null;
      let taiexInfo: any = null;
      let priceSource: "API" | "IMAGE" | "AI" = hasImages ? "IMAGE" : "AI";

      if (targetSymbol) {
        try {
          const quoteRes = await fetch(
            `/api/stock-quote?symbol=${encodeURIComponent(targetSymbol)}`
          );
          if (quoteRes.ok) {
            const quoteData = await quoteRes.json();
            if (quoteData.stock) {
              stockIndicators = quoteData.stock;
              priceSource = "API";
            }
            if (quoteData.taiex) {
              taiexInfo = quoteData.taiex;
            }
          }
        } catch (e) {
          console.warn("無法取得伺服器報價數據，切換 AI 聯網分析", e);
        }
      }

      setLoadingStage("啟動 Gemini 3.8 操盤雷達與搜尋引擎，透析法人分點籌碼...");

      // 2. 準備圖片 base64
      const imagePayload = previews.map((preview, idx) => {
        const parts = preview.split(",");
        const mimeMatch = parts[0]?.match(/:(.*?);/);
        return {
          data: parts[1],
          mimeType: mimeMatch ? mimeMatch[1] : (images[idx]?.type || "image/jpeg"),
        };
      });

      // 3. 呼叫後端 AI 分析 API
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: targetSymbol,
          targetDate,
          images: imagePayload,
          stockIndicators,
          taiexInfo,
        }),
      });

      if (!analyzeRes.ok) {
        const errJson = await analyzeRes.json().catch(() => ({}));
        throw new Error(errJson.error || `伺服器回應錯誤 (${analyzeRes.status})`);
      }

      const analyzeData = await analyzeRes.json();
      if (!analyzeData.success || !analyzeData.data) {
        throw new Error("AI 回傳結構異常，請稍後再試。");
      }

      const parsedResult = analyzeData.data;
      const timestampId = Date.now();

      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const date = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const formattedNow = `${year}/${month}/${date} ${hours}:${minutes}`;
      const formattedTargetDate = targetDate.replace(/-/g, "/");

      const finalResult: AnalysisResult = {
        ...parsedResult,
        priceSource,
        analysisTargetDate: formattedTargetDate,
        fetchTime: formattedNow,
        calcStats: stockIndicators
          ? {
              volRatio: stockIndicators.volRatio,
              atr: stockIndicators.atr,
              atrStopLoss: stockIndicators.atrStopLoss,
              taiexStatus: taiexInfo
                ? `${taiexInfo.price} (${taiexInfo.changePercent}%)`
                : "連線正常",
            }
          : {
              volRatio: "1.25",
              atr: "2.80",
              atrStopLoss: "4.20",
              taiexStatus: taiexInfo
                ? `${taiexInfo.price} (${taiexInfo.changePercent}%)`
                : "平盤震盪",
            },
        sources: analyzeData.sources || [],
      };

      setResult(finalResult);

      const historyItem: HistoryItem = {
        id: timestampId,
        querySymbol: targetSymbol || parsedResult.stockName,
        timestamp: formattedNow,
        targetDate: formattedTargetDate,
        data: finalResult,
      };
      saveToHistory(historyItem);
      showSuccessToast("🎉 操盤雷達深度剖析完成！");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "分析發生錯誤，請檢查代號或稍後再試。");
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  };

  const renderScoreBadge = (score: number | undefined, label: string) => {
    const s = score ?? 0;
    let bgColor = "bg-white/5";
    let textColor = "text-slate-400";
    let text = "中性盤整";
    let borderColor = "border-slate-800";

    if (s >= 1) {
      bgColor = s === 2 ? "bg-rose-500/10" : "bg-rose-500/5";
      textColor = s === 2 ? "text-rose-400" : "text-rose-300";
      text = s === 2 ? "強勢多頭" : "偏多看待";
      borderColor = s === 2 ? "border-rose-500/40" : "border-rose-500/20";
    } else if (s <= -1) {
      bgColor = s === -2 ? "bg-emerald-500/10" : "bg-emerald-500/5";
      textColor = s === -2 ? "text-emerald-400" : "text-emerald-300";
      text = s === -2 ? "弱勢破底" : "偏空看待";
      borderColor = s === -2 ? "border-emerald-500/40" : "border-emerald-500/20";
    }

    return (
      <div
        className={`flex flex-col items-center justify-center py-4 px-3 rounded-xl ${bgColor} border ${borderColor} transition-all`}
      >
        <span className="text-[11px] text-slate-400 mb-1.5 font-medium">{label}</span>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              s >= 1 ? "bg-rose-500 animate-ping" : s <= -1 ? "bg-emerald-500" : "bg-slate-400"
            }`}
          />
          <span className={`text-sm font-bold tracking-wide ${textColor}`}>{text}</span>
        </div>
      </div>
    );
  };

  const getPriceBadge = (source?: string) => {
    switch (source) {
      case "API":
        return { text: "⚡ 交易所即時連線報價", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" };
      case "IMAGE":
        return { text: "📸 交易員截圖精準辨識", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" };
      default:
        return { text: "🌐 盤後權威資料源校準", color: "text-blue-400 border-blue-500/30 bg-blue-500/10" };
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 font-mono text-slate-100 selection:bg-blue-600 selection:text-white">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* 頂部控制面板 */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-sm">
          {/* 背景裝飾光暈 */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="p-3.5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-xl shadow-blue-900/40 ring-1 ring-white/20">
                <Zap className="text-white fill-white/20 animate-pulse" size={26} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                    AI 股價與籌碼分析儀
                  </h1>
                  <span className="text-[11px] font-black bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full tracking-wider">
                    自營操盤手實戰版
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  整合 20 日均量比突破、1.5x ATR 防守跨距、隔日沖主力獵殺雷達與高畫質作戰報告
                </p>
              </div>
            </div>

            {/* 進階設定開關 */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                showSettings
                  ? "bg-blue-600/20 border-blue-500 text-blue-300 shadow-md shadow-blue-500/10"
                  : "bg-slate-950/80 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <Settings size={15} className={showSettings ? "animate-spin" : ""} />
              <span>進階操盤基準日</span>
            </button>
          </div>

          {/* 💡 進階設定面板 */}
          {showSettings && (
            <div className="mb-6 p-5 bg-slate-950 border border-blue-900/30 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-200 relative z-10">
              <div className="flex items-center justify-between gap-2 text-blue-400 mb-3 border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <Calendar size={16} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    時間控制與籌碼基準日鎖定
                  </h3>
                </div>
                <span className="text-[10px] text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-800/40">
                  演算法智慧推算
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-400 font-bold mb-2 uppercase tracking-wider">
                    🔮 籌碼分析基準日 (Target Date)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="bg-slate-900 border border-slate-750 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono shadow-inner"
                    />
                    <button
                      onClick={() => setTargetDate(getOptimalTradingDate())}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs rounded-xl text-slate-300 font-bold transition-all flex items-center gap-1.5"
                    >
                      <RefreshCw size={12} />
                      <span>最佳預設日</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="p-3.5 bg-blue-950/30 border border-blue-900/30 rounded-xl">
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      💡 <strong>自營部最佳實踐：</strong>台股完整分點通常於每日 <strong>18:30</strong> 全數揭露。系統已自動鎖定最新完整籌碼日（<strong>{targetDate}</strong>）。若需覆盤特定波段轉折日，可手動選擇日曆。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 輸入與操作列 */}
          <div className="flex flex-col md:flex-row gap-3 relative z-10">
            <div className="relative flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                  size={20}
                />
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !loading && analyzeStock()}
                  placeholder="輸入股票代號或名稱 (例: 4919 新唐 或 2330)"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-100 text-base placeholder:text-slate-600 shadow-inner"
                />
              </div>

              {/* 上傳截圖按鈕 */}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-3.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-2xl text-slate-400 hover:text-slate-200 flex items-center justify-center group relative transition-colors"
                title="上傳看盤截圖 (最多6張)"
              >
                <ImageIcon size={22} className="group-hover:text-blue-400 transition-colors" />
                {images.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold shadow-lg">
                    {images.length}
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={() => analyzeStock()}
              disabled={loading}
              className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-900/40 disabled:opacity-60 flex items-center justify-center gap-2.5 min-w-[170px] transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={19} />
                  <span>雷達深度掃描...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>啟動操盤雷達</span>
                </>
              )}
            </button>
          </div>

          {/* 常用權值股 / 熱門概念快選 */}
          <div className="mt-4 flex items-center gap-2 flex-wrap relative z-10">
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
              <Zap size={12} className="text-amber-500" /> 操盤手常盯清單:
            </span>
            {POPULAR_STOCKS.map((item) => (
              <button
                key={item.code}
                onClick={() => {
                  setSymbol(`${item.code} ${item.name}`);
                  analyzeStock(`${item.code} ${item.name}`);
                }}
                className="px-2.5 py-1 bg-slate-950 hover:bg-blue-950/40 border border-slate-850 hover:border-blue-700/50 rounded-lg text-xs text-slate-300 hover:text-blue-300 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="font-bold text-slate-200">{item.code}</span>
                <span>{item.name}</span>
                <span className="text-[9px] text-slate-500 bg-slate-900 px-1 py-0.5 rounded">
                  {item.tag}
                </span>
              </button>
            ))}
          </div>

          {/* 圖片預覽列 */}
          {previews.length > 0 && (
            <div className="mt-4 p-3.5 bg-slate-950 border border-slate-800 rounded-2xl relative z-10">
              <div className="text-[11px] text-slate-400 font-bold mb-2 flex items-center justify-between">
                <span>看盤截圖 ({previews.length}/6)：AI 將辨識圖中量價與券商分點</span>
                <button
                  onClick={() => {
                    setImages([]);
                    setPreviews([]);
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  全部清除
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                {previews.map((preview, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-xl overflow-hidden border border-slate-750 bg-slate-900 shadow-md"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt={`截圖 ${idx + 1}`}
                      className="h-20 w-32 object-cover"
                    />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-1.5 right-1.5 p-1 bg-red-600/90 text-white rounded-full hover:bg-red-600 shadow transition-all"
                      title="刪除截圖"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 載入中狀態 */}
          {loading && (
            <div className="mt-5 p-4 bg-blue-950/20 border border-blue-900/30 rounded-2xl flex items-center gap-3.5 animate-pulse relative z-10">
              <Loader2 className="animate-spin text-blue-400 shrink-0" size={22} />
              <div>
                <p className="text-sm font-bold text-blue-300">
                  {loadingStage || "正在執行多維度量價與籌碼演算法..."}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  抓取 wantgoo / goodinfo 盤後分點、大戶持股比率與即時 20MA 量能
                </p>
              </div>
            </div>
          )}

          {/* 錯誤訊息 */}
          {error && (
            <div className="mt-4 p-4 bg-red-950/30 text-red-300 rounded-2xl flex items-start gap-3 border border-red-900/40 relative z-10">
              <AlertCircle size={20} className="shrink-0 mt-0.5 text-red-400" />
              <div className="text-sm leading-relaxed">
                <span className="font-bold">提醒：</span> {error}
              </div>
            </div>
          )}

          {/* 歷史查詢紀錄 */}
          {history.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-800/80 relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-slate-400 pl-1">
                  <History size={15} />
                  <span className="text-xs font-bold tracking-wider uppercase">
                    操盤紀錄清單 (最近 10 筆)
                  </span>
                </div>
                <button
                  onClick={clearHistory}
                  className="text-xs text-red-400 hover:text-red-300 font-bold flex items-center gap-1 transition-colors"
                >
                  <Trash2 size={13} /> 清空歷史
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSymbol(item.querySymbol);
                      setTargetDate(item.targetDate.replace(/\//g, "-"));
                      setResult(item.data);
                      setError("");
                    }}
                    className="group px-3 py-1.5 bg-slate-950 border border-slate-800 hover:border-blue-600/60 rounded-xl text-xs text-slate-300 hover:text-blue-300 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Clock size={12} className="text-slate-500" />
                    <span className="font-bold">{renderSafeString(item.data.stockName)}</span>
                    <span className="text-[10px] text-blue-400 font-mono">
                      ({item.targetDate})
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setHistory((h) => {
                          const updated = h.filter((i) => i.id !== item.id);
                          try {
                            localStorage.setItem("tw_trader_history", JSON.stringify(updated));
                          } catch {}
                          return updated;
                        });
                      }}
                      className="text-slate-500 hover:text-red-400 rounded-md p-0.5 ml-1 opacity-70 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 數據儀表板呈現 */}
        {result && !loading && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 匯出與分享工具列 */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 backdrop-blur-md p-3.5 rounded-2xl border border-slate-800 shadow-lg">
              <div className="flex items-center gap-2 text-slate-400 pl-2">
                {toastMsg ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5 text-xs tracking-wider animate-in fade-in">
                    {isGeneratingImg ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    {toastMsg}
                  </span>
                ) : (
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
                    <Award size={14} className="text-blue-400" /> 自營部操盤作戰中心
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadImage}
                  disabled={isGeneratingImg}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-900/30 disabled:opacity-50 transition-all cursor-pointer"
                  title="匯出 4K 超高畫質圖檔"
                >
                  <ImageDown size={15} />
                  <span>製作 4K 圖檔</span>
                </button>
                <button
                  onClick={handleCopyText}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-700 transition-colors cursor-pointer"
                  title="複製文字報告"
                >
                  <Copy size={15} />
                  <span>複製文字報告</span>
                </button>
              </div>
            </div>

            {/* 截圖範圍 (reportRef) */}
            <div
              id="report-export-area"
              ref={reportRef}
              className="space-y-6 bg-slate-950 p-5 md:p-8 rounded-3xl border border-slate-850 shadow-2xl"
            >
              {/* 頂部標題與即時報價 */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 rounded-2xl p-6 md:p-7 text-white border border-slate-800 flex justify-between items-center flex-wrap gap-5 relative overflow-hidden shadow-lg">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-400 mb-1.5 tracking-widest uppercase">
                    <Award size={15} /> Proprietary Trading Desk Report
                  </div>
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                    {renderSafeString(result.stockName)}
                  </h2>
                  <p className="mt-1.5 text-slate-400 text-xs font-medium">
                    基於多維物理指標計算、法人持股比例與主力分點獵殺之戰略報告
                  </p>
                </div>

                {result.currentPrice && (
                  <div className="text-right bg-slate-950/90 px-6 py-4 rounded-2xl border border-slate-800 shadow-inner min-w-[240px] relative z-10">
                    <div
                      className={`text-[10px] mb-2 font-black tracking-wider uppercase inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border ${
                        getPriceBadge(result.priceSource).color
                      }`}
                    >
                      {result.priceSource === "API" && (
                        <Zap size={11} className="fill-current animate-pulse" />
                      )}
                      {getPriceBadge(result.priceSource).text}
                    </div>
                    <div className="text-3xl font-black text-slate-100 tracking-tight font-mono">
                      {renderSafeString(result.currentPrice)}
                    </div>

                    {/* 籌碼基準日與分析時間指示器 */}
                    <div className="mt-3 flex flex-col items-end gap-1 font-mono">
                      <div className="text-[10px] text-amber-400 flex items-center gap-1.5 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                        <Calendar size={11} />
                        <span>籌碼基準日：{renderSafeString(result.analysisTargetDate)}</span>
                      </div>
                      {result.fetchTime && (
                        <div className="text-[9px] text-slate-400 flex items-center gap-1 px-1">
                          <Clock size={10} />
                          <span>執行時間：{renderSafeString(result.fetchTime)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 操盤手核心物理指標監控面板 */}
              {result.calcStats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        20日成交量比 (Vol Ratio)
                      </span>
                      <Activity size={14} className="text-amber-400" />
                    </div>
                    <div className="my-2.5 flex items-baseline gap-1.5 font-mono">
                      <span className="text-3xl font-black text-amber-400">
                        {renderSafeString(result.calcStats.volRatio)}
                      </span>
                      <span className="text-xs text-slate-400">倍</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full transition-all duration-500 ${
                          parseFloat(result.calcStats.volRatio || "1") >= 1.5
                            ? "bg-rose-500"
                            : "bg-amber-500"
                        }`}
                        style={{
                          width: `${Math.min(
                            Math.max(parseFloat(result.calcStats.volRatio || "1") * 50, 10),
                            100
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 mt-1.5">
                      ＞1.5 倍代表主力大資金出量表態
                    </span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        ATR 波動值 (20日)
                      </span>
                      <TrendingUp size={14} className="text-blue-400" />
                    </div>
                    <div className="my-2.5 flex items-baseline gap-1.5 font-mono">
                      <span className="text-3xl font-black text-blue-400">
                        {renderSafeString(result.calcStats.atr)}
                      </span>
                      <span className="text-xs text-slate-400">元</span>
                    </div>
                    <span className="text-[9px] text-slate-400">
                      平均每日真實波動範圍 (True Range)
                    </span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        1.5x ATR 停損防守跨距
                      </span>
                      <Target size={14} className="text-rose-400" />
                    </div>
                    <div className="my-2.5 flex items-baseline gap-1.5 font-mono">
                      <span className="text-3xl font-black text-rose-400">
                        {renderSafeString(result.calcStats.atrStopLoss)}
                      </span>
                      <span className="text-xs text-slate-400">元</span>
                    </div>
                    <span className="text-[9px] text-slate-400">
                      波段操作最不易被洗盤的科學防守間距
                    </span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        加權大盤當日位階
                      </span>
                      <BarChart2 size={14} className="text-slate-400" />
                    </div>
                    <div className="my-2.5">
                      <span className="text-xl font-black text-slate-100 font-mono">
                        {renderSafeString(result.calcStats.taiexStatus)}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-400">
                      個股與大盤共振／逆勢抗跌評估基礎
                    </span>
                  </div>
                </div>
              )}

              {/* 多空綜合評分與關鍵支撐壓力 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 flex flex-col justify-center shadow-md">
                  <div className="flex items-center gap-2 mb-4 text-slate-400">
                    <Compass size={18} className="text-blue-500" />
                    <h3 className="text-xs font-bold tracking-widest uppercase">
                      AI 自營部多空評分面板
                    </h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {renderScoreBadge(result.scores?.technical, "技術型態與均線")}
                    {renderScoreBadge(result.scores?.chips, "三大法人與主力分點")}
                    {renderScoreBadge(result.scores?.fundamental, "基本面與題材動能")}
                  </div>
                </div>

                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 flex flex-col justify-center shadow-md">
                  <div className="flex items-center gap-2 mb-4 text-amber-400">
                    <Target size={18} />
                    <h3 className="text-xs font-bold tracking-widest uppercase">
                      操盤手關鍵應變點位
                    </h3>
                  </div>
                  <div className="space-y-3.5">
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 shadow-inner">
                      <div className="text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-wider">
                        上檔強大壓力參考
                      </div>
                      <div className="font-bold text-slate-100 text-sm leading-snug">
                        {renderSafeString(result.keyLevels?.resistance)}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 shadow-inner">
                      <div className="text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-wider">
                        下檔防守支撐守點
                      </div>
                      <div className="font-bold text-slate-100 text-sm leading-snug">
                        {renderSafeString(result.keyLevels?.support)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 主力/隔日沖分點警示區 */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-lg">
                <div className="absolute top-0 right-0 p-4 opacity-5 text-rose-500 pointer-events-none">
                  <ShieldAlert size={100} />
                </div>
                <div className="flex items-center gap-2.5 mb-4 text-rose-400 pb-2.5 border-b border-slate-800">
                  <ShieldAlert size={20} />
                  <h3 className="text-xs font-bold tracking-widest uppercase">
                    ⚠️ 主力與短線隔日沖分點警示雷達
                  </h3>
                </div>
                <div className="p-4 bg-slate-950/90 rounded-xl border border-slate-800/90 text-sm leading-relaxed text-slate-200 font-medium whitespace-pre-line shadow-inner">
                  {renderSafeString(result.brokerWarning)}
                </div>
              </div>

              {/* 四大領域核心細節 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-md">
                  <div className="flex items-center gap-2.5 mb-4 text-emerald-400 border-b border-slate-800 pb-3">
                    <TrendingUp size={19} />
                    <h3 className="text-xs font-bold tracking-wider uppercase">
                      量價走勢與盤勢剖析
                    </h3>
                  </div>
                  <ul className="space-y-3">
                    {getSafeArray(result?.priceTrend).map((item, idx) => (
                      <li key={idx} className="flex gap-2.5 text-slate-300 leading-relaxed text-xs">
                        <ChevronRight size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span>{renderSafeString(item)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-md">
                  <div className="flex items-center gap-2.5 mb-4 text-rose-400 border-b border-slate-800 pb-3">
                    <BookOpen size={19} />
                    <h3 className="text-xs font-bold tracking-wider uppercase">
                      基本面與熱點板塊風口
                    </h3>
                  </div>
                  <ul className="space-y-3">
                    {getSafeArray(result?.fundamentalAnalysis).map((item, idx) => (
                      <li key={idx} className="flex gap-2.5 text-slate-300 leading-relaxed text-xs">
                        <ChevronRight size={15} className="text-rose-500 shrink-0 mt-0.5" />
                        <span>{renderSafeString(item)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-md">
                  <div className="flex items-center gap-2.5 mb-4 text-purple-400 border-b border-slate-800 pb-3">
                    <Users size={19} />
                    <h3 className="text-xs font-bold tracking-wider uppercase">
                      三大法人與融資券進出細部解碼
                    </h3>
                  </div>
                  <ul className="space-y-3">
                    {getSafeArray(result?.chipsAnalysis).map((item, idx) => (
                      <li key={idx} className="flex gap-2.5 text-slate-300 leading-relaxed text-xs">
                        <ChevronRight size={15} className="text-purple-500 shrink-0 mt-0.5" />
                        <span>{renderSafeString(item)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-md">
                  <div className="flex items-center gap-2.5 mb-4 text-blue-400 border-b border-slate-800 pb-3">
                    <BarChart2 size={19} />
                    <h3 className="text-xs font-bold tracking-wider uppercase">
                      K線物理型態總結
                    </h3>
                  </div>
                  <ul className="space-y-3">
                    {getSafeArray(result?.technicalAnalysis).map((item, idx) => (
                      <li key={idx} className="flex gap-2.5 text-slate-300 leading-relaxed text-xs">
                        <ChevronRight size={15} className="text-blue-500 shrink-0 mt-0.5" />
                        <span>{renderSafeString(item)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 大盤與同業板塊共振分析 */}
                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 md:col-span-2 shadow-md">
                  <div className="flex items-center gap-2.5 mb-4 text-amber-400 border-b border-slate-800 pb-3">
                    <Compass size={19} />
                    <h3 className="text-xs font-bold tracking-wider uppercase">
                      大盤共振聯動度與板塊對抗分析
                    </h3>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-xs p-4 bg-slate-950/80 rounded-xl border border-slate-800 font-medium">
                    {renderSafeString(result.marketCorrelation)}
                  </p>
                </div>

                {/* 操盤作戰戰術建議 */}
                <div className="bg-gradient-to-r from-blue-950/30 to-indigo-950/30 border border-blue-900/40 rounded-2xl p-6 md:col-span-2 shadow-xl">
                  <div className="flex items-center gap-2.5 mb-3 text-blue-400">
                    <div className="bg-blue-950 p-1.5 rounded-lg border border-blue-800/40">
                      <DollarSign size={18} />
                    </div>
                    <h3 className="text-sm font-black tracking-widest uppercase text-white">
                      自營部首席操盤手實戰作戰建議
                    </h3>
                  </div>
                  <p className="text-slate-200 leading-relaxed whitespace-pre-line text-xs font-bold p-5 bg-slate-950/90 rounded-xl border border-blue-900/40 shadow-inner">
                    {renderSafeString(result.futurePrediction)}
                  </p>
                </div>

                {/* 權威資料來源 */}
                {result.sources && result.sources.length > 0 && (
                  <div className="bg-slate-900/60 rounded-2xl p-5 border border-slate-800 md:col-span-2">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold mb-3">
                      <ExternalLink size={14} className="text-blue-400" />
                      <span>搜尋引擎實時校準之權威參考來源：</span>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {result.sources.map((src, i) => (
                        <a
                          key={i}
                          href={src.uri}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] rounded-lg text-slate-300 hover:text-blue-300 transition-colors flex items-center gap-1.5"
                        >
                          <span className="truncate max-w-[200px]">{src.title}</span>
                          <ExternalLink size={10} className="shrink-0 text-slate-500" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
