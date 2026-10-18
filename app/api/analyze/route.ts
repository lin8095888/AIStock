import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/gemini";

interface ImageInput {
  data: string; // base64
  mimeType: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      symbol = "",
      targetDate = "",
      images = [] as ImageInput[],
      stockIndicators,
      taiexInfo,
    } = body;

    if (!symbol.trim() && (!images || images.length === 0)) {
      return NextResponse.json(
        { error: "請輸入股票代號/名稱，或上傳盤勢截圖" },
        { status: 400 }
      );
    }

    const formattedTargetDate = (targetDate || "").replace(/-/g, "/");

    let systemPrompt = `你是一位擁有20年交易經驗、操作過數十億資金的台灣股市自營部首席操盤手（Chief Proprietary Trader）。你的任務是針對指定的「籌碼分析基準日」為另一位專業交易員撰寫一份完全去水份、直擊籌碼本質的實戰作戰報告。

🚨🚨🚨【基準日核心戰略要求】🚨🚨🚨
- 本次分析的【籌碼與量價分析基準日】已被強制鎖定在：【${formattedTargetDate || "最新台股盤後交易日"}】。
- 你在利用搜尋引擎查找三大法人買賣超（外資、投信、自營商）、融資融券、主力分點明細、法說題材時，【必須】以【${formattedTargetDate}當日盤後最新發布數據】為核心依據！
- 若資料因時間差未全數公告，請明確警示。

【最高指導原則 - 限定權威資料源】：
請重點參考 wantgoo.com、goodinfo.tw、cnyes.com 分析籌碼；參考 money.udn.com 或 ctee.com.tw 獲取法說、月營收與產業題材。

【特別防備：隔日沖主力蹤跡】：
檢視基準日當日與前3天買賣超券商分點是否包含知名「隔日沖或短波段大戶」（如：美林、凱基台北、富邦建國、元大土城永寧、群益金鼎、摩根大通、國泰敦南）。若有，請在 brokerWarning 詳細發出警戒（說明買超張數、佔比與次日開盤應對技巧）。

【實體量價數據】：\n`;

    if (stockIndicators) {
      systemPrompt += `- 基準日即時股價：${stockIndicators.price} (${stockIndicators.changePercent}%)\n` +
        `- 基準日20日均量比：${stockIndicators.volRatio} 倍 (今日成交約 ${stockIndicators.rawVol || 'N/A'}，20日均量 ${stockIndicators.avgVol20 || 'N/A'})\n` +
        `- ATR 波動度：${stockIndicators.atr} 元 | 1.5x ATR 停損防守跨距：${stockIndicators.atrStopLoss} 元\n` +
        `- 加權大盤指數（TAIEX）：${taiexInfo ? `${taiexInfo.price} (${taiexInfo.changePercent}%)` : '平盤震盪'}\n`;
    }

    systemPrompt += `\n【回傳純 JSON 格式規範】：
嚴格返回標準 JSON 格式，請勿在開頭或結尾加上任何額外文字或引言。結構必須完全符合下列欄位：
{
  "stockName": "股票名稱與代號 (例如: 4919 新唐)",
  "currentPrice": "基準日收盤股價與漲跌幅 (例如: 112.5 (+3.2%))",
  "scores": {
    "technical": 1, 
    "chips": 1, 
    "fundamental": 0 
  },
  "keyLevels": {
    "support": "下檔防守支撐與均線對應 (例如: 108.5元 (季線支撐與前低))",
    "resistance": "上檔壓力參考 (例如: 118.0元 (前波大量套牢區))"
  },
  "priceTrend": [
    "量價型態與盤勢解析要點1",
    "量價型態與盤勢解析要點2"
  ],
  "chipsAnalysis": [
    "三大法人動向解讀 (外資、投信具體買賣超)",
    "主力分點與融資券資券比分析"
  ],
  "technicalAnalysis": [
    "K線型態、均線扣抵與指標 (KD/MACD/RSI) 總結"
  ],
  "fundamentalAnalysis": [
    "基本面、月營收營益率與最新產業題材"
  ],
  "brokerWarning": "隔日沖分點警示說明 (註明有無特定分點如凱基台北、美林鎖碼，隔日開盤是否需防範下殺倒貨)",
  "marketCorrelation": "大盤共振與同業板塊對抗分析 (相對加權指數是強勢還是跟跌)",
  "futurePrediction": "操作建議與 ATR 停損戰術交代 (具體進出場防守價位與加減碼紀律)"
}
其中 scores 的數值規範：2=強勢多頭, 1=偏多看待, 0=中性盤整, -1=偏空看待, -2=弱勢破底。`;

    let promptText = `請以自營部操盤手高標準，深度分析台股：${symbol || "附圖股票"}。基準日：${formattedTargetDate || "最新交易日"}。`;
    if (images && images.length > 0) {
      promptText += ` 交易員已上傳 ${images.length} 張實時看盤截圖，請務必辨識截圖中的K線圖、分點買賣表或報價數字進行綜合研判。`;
    }

    // Build parts
    const parts: any[] = [];
    if (images && images.length > 0) {
      images.forEach((img: ImageInput) => {
        parts.push({
          inlineData: {
            data: img.data,
            mimeType: img.mimeType || "image/jpeg",
          },
        });
      });
    }
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: { parts },
      config: {
        systemInstruction: systemPrompt,
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
      },
    });

    const responseText = response.text || "";
    // Clean markdown wrappers if any
    const cleanedJson = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsedResult: any;
    try {
      parsedResult = JSON.parse(cleanedJson);
    } catch (parseErr) {
      // If direct parse fails, try extracting substring between { and }
      const firstBrace = cleanedJson.indexOf("{");
      const lastBrace = cleanedJson.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const candidate = cleanedJson.substring(firstBrace, lastBrace + 1);
        parsedResult = JSON.parse(candidate);
      } else {
        throw new Error("無法解析 AI 操盤報告之 JSON 結構");
      }
    }

    // Extract search grounding metadata
    const groundingChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const webSources = groundingChunks
      .map((chunk: any) => chunk.web)
      .filter((web: any) => Boolean(web && web.uri))
      .map((web: any) => ({
        title: web.title || web.uri,
        uri: web.uri,
      }))
      .slice(0, 6);

    return NextResponse.json({
      success: true,
      data: parsedResult,
      sources: webSources,
    });
  } catch (error: any) {
    console.error("API /api/analyze error:", error);
    return NextResponse.json(
      {
        error: error.message || "操盤雷達運算發生異常，請稍後重試。",
      },
      { status: 500 }
    );
  }
}
