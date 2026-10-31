import type { Metadata } from "next";
import ClientLayout from "@/components/layout/ClientLayout";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Rise On AI",
  description: "Intelligent Journal App",
  icons: {
    icon: [
      { url: "/logo/Without Text.png", type: "image/png" },
    ],
    apple: [
      { url: "/logo/Without Text.png", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased">
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
