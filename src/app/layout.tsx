import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {default: "Interview Pal — Your practice space", template: "%s · Interview Pal"},
  description: "A personal workspace for coding practice, behavioral stories, and thoughtful mock interviews.",
  robots: {index: false, follow: false},
};
export default function RootLayout({children}: {children: React.ReactNode}) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
