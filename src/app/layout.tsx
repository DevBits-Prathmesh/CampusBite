import type { Metadata, Viewport } from "next";
import { Nunito_Sans } from "next/font/google";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

const nunito = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "CampusBite",
  description: "Smart canteen pre-ordering and queue management",
  applicationName: "CampusBite",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f2f0eb",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} h-full`}>
      <body className={`${nunito.className} min-h-full antialiased`}>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
