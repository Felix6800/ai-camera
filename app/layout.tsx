import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Camera - 姿势引导',
  description: '实时骨骼检测与姿势引导应用',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
