import { NextRequest, NextResponse } from "next/server";

interface QuoteResult {
  price: string;
  changePercent: string;
  time: string;
  rawVol: number;
  avgVol20: string;
  volRatio: string;
  atr: string;
  atrStopLoss: string;
  stockName?: string;
}

interface TaiexResult {
  price: string;
  changePercent: string;
}

async function fetchTaiex(): Promise<TaiexResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/^TWII?range=1d&interval=1d`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json",
      },
      next: { revalidate: 60 },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const chartData = await res.json();
    if (chartData?.chart?.result?.[0]?.meta) {
      const meta = chartData.chart.result[0].meta;
      const current = meta.regularMarketPrice;
      const prev = meta.chartPreviousClose;
      if (current != null && prev != null) {
        const changePercent = ((current - prev) / prev) * 100;
        return {
          price: Number(current).toFixed(2),
          changePercent: changePercent > 0 ? `+${changePercent.toFixed(2)}` : changePercent.toFixed(2),
        };
      }
    }
  } catch (err) {
    console.warn("TAIEX fetch error:", err);
  }
  return null;
}

async function fetchStock(stockCode: string): Promise<QuoteResult | null> {
  const fetchMarket = async (marketType: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${stockCode}.${marketType}?range=1mo&interval=1d`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json",
      },
      next: { revalidate: 30 },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  };

  try {
    let data = await fetchMarket("TW").catch(() => null);
    if (!data?.chart?.result?.[0]) {
      data = await fetchMarket("TWO").catch(() => null);
    }

    if (data?.chart?.result?.[0]) {
      const resultObj = data.chart.result[0];
      const meta = resultObj.meta;
      const indicators = resultObj.indicators?.quote?.[0];

      const currentPrice = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose;

      if (currentPrice != null && prevClose != null) {
        const change = currentPrice - prevClose;
        const changePercent = (change / prevClose) * 100;

        const dateObj = new Date(meta.regularMarketTime * 1000);
        const formattedDateTime = `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, "0")}/${String(dateObj.getDate()).padStart(2, "0")} ${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`;

        const volumes: (number | null)[] = indicators?.volume || [];
        const validVolumes = volumes.filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
        const currentVol = validVolumes[validVolumes.length - 1] || 0;
        const prev20Vols = validVolumes.slice(-21, -1);
        const avgVol20 = prev20Vols.length > 0 ? prev20Vols.reduce((sum, v) => sum + v, 0) / prev20Vols.length : 0;
        const volRatio = avgVol20 > 0 ? (currentVol / avgVol20).toFixed(2) : "1.00";

        const highs: (number | null)[] = indicators?.high || [];
        const lows: (number | null)[] = indicators?.low || [];
        const closes: (number | null)[] = indicators?.close || [];
        let trSum = 0;
        let trCount = 0;

        const len = closes.length;
        for (let i = Math.max(1, len - 20); i < len; i++) {
          const h = highs[i];
          const l = lows[i];
          const pc = closes[i - 1];
          if (h != null && l != null && pc != null) {
            const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
            trSum += tr;
            trCount++;
          }
        }

        const atr = trCount > 0 ? trSum / trCount : currentPrice * 0.03;
        const atrStopLoss = (atr * 1.5).toFixed(2);

        return {
          price: Number(currentPrice).toFixed(2),
          changePercent: changePercent > 0 ? `+${changePercent.toFixed(2)}` : changePercent.toFixed(2),
          time: formattedDateTime,
          rawVol: currentVol,
          avgVol20: avgVol20.toFixed(0),
          volRatio,
          atr: Number(atr).toFixed(2),
          atrStopLoss,
          stockName: meta.shortName || meta.symbol,
        };
      }
    }
  } catch (err) {
    console.warn("Stock fetch error:", err);
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "";
  const match = symbol.match(/\d{4}/);
  const stockCode = match ? match[0] : null;

  try {
    const [stock, taiex] = await Promise.all([
      stockCode ? fetchStock(stockCode) : Promise.resolve(null),
      fetchTaiex(),
    ]);

    return NextResponse.json({
      stockCode,
      stock,
      taiex,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "無法獲取市場即時指標" },
      { status: 500 }
    );
  }
}
