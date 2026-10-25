import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecallLoop — Give your reading a second life.",
  description:
    "Turn saved articles into lasting knowledge with Gemma-powered recall and spaced repetition.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
