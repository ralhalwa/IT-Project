import type { AppProps } from "next/app";

import { NextUIProvider } from "@nextui-org/system";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useRouter } from "next/router";

import { fontSans, fontMono } from "@/config/fonts";
import "@/styles/globals.css";
import { useEffect } from "react";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

    useEffect(() => {
    // Create a global fetch interceptor
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      
      // Check for 401 status
      if (response.status === 401) {
        // Redirect to login page
        router.push("/login");
        return response;
      }
      
      return response;
    };

    // Cleanup function to restore original fetch
    return () => {
      window.fetch = originalFetch;
    };
  }, [router]);

  return (
    <NextUIProvider navigate={router.push}>
      <NextThemesProvider>
        <Component {...pageProps} />
      </NextThemesProvider>
    </NextUIProvider>
  );
}

export const fonts = {
  sans: fontSans.style.fontFamily,
  mono: fontMono.style.fontFamily,
};
