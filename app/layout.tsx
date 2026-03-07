import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "FormCheck — Análisis de Técnica Calistenia",
  description: "Analizá tu técnica de calistenia con IA. Muscle up, dominadas, flexiones, fondos, plancha y L-sit.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className={`${geistMono.variable} font-mono antialiased bg-[#060609]`}>
        {children}
      </body>
    </html>
  );
}
