import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Toaster } from 'react-hot-toast';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const metadata: Metadata = {
  title: 'HD Beauty Manager',
  description: 'Quản lý doanh thu nhân viên theo thời gian thực',
  manifest: `${basePath}/manifest.json`,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'HD Beauty',
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: 'HD Beauty Manager',
    description: 'Quản lý doanh thu nhân viên theo thời gian thực',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#A78BFA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href={`${basePath}/icons/icon-192x192.png`} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 3000,
                style: {
                  borderRadius: '16px',
                  background: '#1f2937',
                  color: '#f9fafb',
                  fontSize: '14px',
                  fontWeight: '500',
                  padding: '12px 16px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                },
                success: {
                  iconTheme: { primary: '#A7F3D0', secondary: '#065f46' },
                },
                error: {
                  iconTheme: { primary: '#FCA5A5', secondary: '#7f1d1d' },
                },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
