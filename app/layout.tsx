import type { Metadata } from "next";
import { Space_Grotesk, Hind_Siliguri, Noto_Serif_Bengali } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SmoothScroll from "@/components/SmoothScroll";
import ScrollProgress from "@/components/ScrollProgress";

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  display: "swap",
});

const hindSiliguri = Hind_Siliguri({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["bengali"],
  variable: "--font-bengali",
  display: "swap",
});

const notoSerifBengali = Noto_Serif_Bengali({
  weight: ["400", "600", "700", "900"],
  subsets: ["bengali"],
  variable: "--font-bengali-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Utha USA — Bangladeshi Community",
  description:
    "Utha USA — the Bangladeshi community of Salt Lake City, Utah. Festivals, culture, friendship, and community. Utha means to rise.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${grotesk.variable} ${hindSiliguri.variable} ${notoSerifBengali.variable} antialiased`}
      >
        <SmoothScroll>
          <ScrollProgress />
          <Navbar />
          <main>{children}</main>
          <Footer />
        </SmoothScroll>
      </body>
    </html>
  );
}
