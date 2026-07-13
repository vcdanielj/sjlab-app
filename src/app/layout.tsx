import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

export const metadata: Metadata = {
  title: {
    default: "SJ Lab — Sistema de Gestión",
    template: "%s | SJ Lab",
  },
  description:
    "Sistema de gestión integral para laboratorio dental protésico. Producción, finanzas y portal de clientes.",
  applicationName: "SJ Lab",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SJ Lab",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={GeistSans.variable}>
      <body>
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
