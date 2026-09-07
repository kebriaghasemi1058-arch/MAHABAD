import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth-context";
import { PresenceProvider } from "@/lib/presence-context";
import { ThemeProvider } from "@/lib/theme-context";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const vazir = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-vazir",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MAHABAD CITY | مهاباد از نگاه شما",
  description: "سایت معرفی شهر مهاباد با عکس‌های اهالی شهر",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazir.variable}>
      <body className="font-sans min-h-screen flex flex-col">
        <I18nProvider>
          <ThemeProvider>
            <AuthProvider>
              <PresenceProvider>
                <Navbar />
                <main className="max-w-3xl mx-auto px-5 py-8 flex-1 w-full animate-card">{children}</main>
                <Footer />
              </PresenceProvider>
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
