import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'AI 股價與籌碼分析儀 (自營操盤手實戰版)',
  description: '專業台股 AI 籌碼深度分析儀，整合 20 日均量比、ATR 波動防守跨距、主力與隔日沖分點監控及高畫質操盤報告匯出。',
  openGraph: {
    title: 'AI 股價與籌碼分析儀 (自營操盤手實戰版)',
    description: '專業台股 AI 籌碼深度分析儀，整合 20 日均量比、ATR 波動防守跨距、主力與隔日沖分點監控及高畫質操盤報告匯出。',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI 股價與籌碼分析儀 (自營操盤手實戰版)',
    description: '專業台股 AI 籌碼深度分析儀，整合 20 日均量比、ATR 波動防守跨距、主力與隔日沖分點監控及高畫質操盤報告匯出。',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
