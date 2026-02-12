import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import AppLayout from "@/components/layout/AppLayout";
import { I18nProvider } from "@/lib/i18n";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "SuperScrap CRM - Pipeline de Ventas",
  description: "CRM para gestión de leads y pipeline de ventas B2B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${plusJakarta.variable} font-sans antialiased`}>
        <I18nProvider>
          <AppLayout>{children}</AppLayout>
        </I18nProvider>
      </body>
    </html>
  );
}
