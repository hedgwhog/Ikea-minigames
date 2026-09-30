// Server component. It reads the theme cookie (a React/Next SERVER API), so the page
// arrives in the right mode straight away.
import { cookies } from "next/headers";
import Link from "next/link";
import PullCord from "@/components/PullCord";
import { ThemeProvider } from "@/context/ThemeContext";
import "./globals.css";

export const metadata = { title: "The Showroom", description: "IKEA-style party minigames" };

export default async function RootLayout({ children }) {
  const theme = (await cookies()).get("theme")?.value === "dark" ? "dark" : "light";
  return (
    <html lang="en" data-theme={theme}>
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700;900&display=swap" />
      </head>
      <body className="min-h-dvh">
        <ThemeProvider initial={theme}>
          <header className="relative bg-blue text-white">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
              <Link href="/" className="text-xl font-black">
                The <span className="text-yellow">Ikea-rooms</span>
              </Link>
            </div>
            <PullCord />
          </header>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
