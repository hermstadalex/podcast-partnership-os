import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import Providers from "@/components/Providers";
import { Sidebar } from "@/components/Sidebar";

import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: "PodcastPartnership OS",
  description: "Internal Admin Command Center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", "dark", inter.variable, "font-sans")}
    >
      <body className="min-h-full flex bg-zinc-950 text-zinc-50">
        <TooltipProvider>
          <Providers>
            <Sidebar />
            <main className="flex-1 min-w-0 overflow-y-auto">
              {children}
            </main>
          </Providers>
        </TooltipProvider>
      </body>
    </html>
  );
}
