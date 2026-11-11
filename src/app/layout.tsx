import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from '@/components/app/theme-provider';

export const metadata: Metadata = {
  title: 'StreamSiphon',
  description: 'Descarga video y audio de YouTube.',
  // icon.png es cuadrado (256×256); el logo.png original (1344×768) se deformaba en la pestaña
  icons: { icon: '/icon.png', apple: '/icon.png' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-body antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
