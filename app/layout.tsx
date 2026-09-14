import type { Metadata } from "next";
import { Montserrat, Open_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import VoiceOrb from "@/components/VoiceOrb";
import ChatOrb from "@/components/ChatOrb";
import Footer from "@/components/Footer";
import SmoothScroll from "@/components/SmoothScroll";
import ScrollProgress from "@/components/ScrollProgress";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-mont",
  display: "swap",
});

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bangladeshi Association of Utah | Salt Lake City",
  description:
    "BAU is the Bangladeshi community of Salt Lake City, Utah. Festivals, culture, friendship, and community.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${montserrat.variable} ${openSans.variable} antialiased`}>
        <SmoothScroll>
          <ScrollProgress />
          <Navbar />
          <main>{children}</main>
          <Footer />
        </SmoothScroll>
        {/* Voice on the left, chat on the right. Both sit outside the scroll
            wrapper so they stay put rather than travelling with the page. */}
        <VoiceOrb />
        <ChatOrb />
      </body>
    </html>
  );
}
