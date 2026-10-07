"use client";

import * as React from "react";

export type Language = "en" | "ar";

interface LanguageContextType {
  lang: Language;
  dir: "ltr" | "rtl";
  isAr: boolean;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
}

const LanguageContext = React.createContext<LanguageContextType>({
  lang: "en",
  dir: "ltr",
  isAr: false,
  setLang: () => {},
  toggleLang: () => {},
});

const STORAGE_KEY = "quazlink_preferred_lang";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Default to English as requested by the user
  const [lang, setLangState] = React.useState<Language>("en");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (saved === "ar" || saved === "en") {
        setLangState(saved);
      }
    } catch {
      // Ignore storage access errors
    }
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore storage write errors
    }
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang, mounted]);

  const setLang = React.useCallback((newLang: Language) => {
    setLangState(newLang);
  }, []);

  const toggleLang = React.useCallback(() => {
    setLangState((prev) => (prev === "en" ? "ar" : "en"));
  }, []);

  const dir = lang === "ar" ? "rtl" : "ltr";
  const isAr = lang === "ar";

  return (
    <LanguageContext.Provider value={{ lang, dir, isAr, setLang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = React.useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
