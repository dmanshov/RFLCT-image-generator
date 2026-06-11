import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RFLCT · Vastgoedfoto Generator",
  description:
    "Genereer voor/na vastgoedbeelden en een Nederlandse caption voor de RFLCT-socials.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
