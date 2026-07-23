import type { Metadata } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import { Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StoryFlow",
  description: "Storyboard com IA — do roteiro ao vídeo, cena a cena",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const ua = (await headers()).get("user-agent") ?? "";
  const isElectron = ua.includes("Electron");
  // React Grab intercepta ponteiro/scroll — não carregar dentro do Electron.
  const enableReactGrab =
    process.env.NODE_ENV === "development" && !isElectron;

  return (
    <html
      lang="pt-BR"
      className={cn("dark h-full antialiased font-sans", inter.variable, geistMono.variable)}
      suppressHydrationWarning
    >
      <head>
        {enableReactGrab && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster theme="dark" richColors position="bottom-right" />
      </body>
    </html>
  );
}
