import type { Metadata } from "next";
import "@myheritage/tokens/css";
import "./globals.css";
import "./premium-tables.css";

export const metadata: Metadata = {
  title: "CampusOne",
  description: "CampusOne education portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      style={{
        "--font-sans": 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        "--font-display": '"Trebuchet MS", ui-sans-serif, system-ui, sans-serif',
        "--font-cert-body": 'Georgia, "Times New Roman", serif',
        "--font-cert-display": 'Georgia, "Times New Roman", serif',
      } as React.CSSProperties}
    >
      <body>{children}</body>
    </html>
  );
}
