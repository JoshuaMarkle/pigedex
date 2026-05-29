import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PwaInit from "@/components/PwaInit";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Pigedex",
  description: "The all-in-one solution for modern loft management.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pigedex",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/favicon.ico" },
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png" }],
    other: [
      {
        rel: "android-chrome",
        url: "/icons/android-chrome-192x192.png",
      },
      {
        rel: "android-chrome",
        url: "/icons/android-chrome-512x512.png",
      },
    ],
  },
};

export const viewport = {
  themeColor: "#1e96eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full flex flex-col">
        <PwaInit />
        {children}
      </body>
    </html>
  );
}
