import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecallLoop — Save it. Learn it. Remember it.",
  description:
    "Turn saved articles into personalized recall cards and remember what matters.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
