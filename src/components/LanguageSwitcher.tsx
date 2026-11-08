"use client";

import { usePathname } from "next/navigation";
import {
  defaultLocale,
  isLocale,
  localeLabels,
  locales,
  localizedPath,
  type Locale,
} from "@/i18n/config";

const shortLocaleLabels: Record<Locale, string> = {
  en: "EN",
  "zh-cn": "中",
  es: "ES",
  de: "DE",
  fr: "FR",
  ja: "日",
  ko: "한",
  "pt-br": "PT",
};

export default function LanguageSwitcher() {
  const pathname = usePathname() || "/";
  const segments = pathname.split("/").filter(Boolean);
  const hasLocalePrefix = segments.length > 0 && isLocale(segments[0]);
  const currentLocale: Locale = hasLocalePrefix
    ? segments[0] as Locale
    : defaultLocale;

  const pagePath = hasLocalePrefix
    ? `/${segments.slice(1).join("/")}`
    : pathname;

  const handleChange = (nextLocale: Locale) => {
    window.location.href = localizedPath(nextLocale, pagePath);
  };

  return (
    <>
      <select
        aria-label="Language"
        value={currentLocale}
        onChange={(event) => handleChange(event.target.value as Locale)}
        className="sm:hidden min-w-[3.25rem] rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-600 outline-none transition-colors hover:border-[#ff6be4] focus:border-[#ff6be4] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {shortLocaleLabels[locale]}
          </option>
        ))}
      </select>

      <select
        aria-label="Language"
        value={currentLocale}
        onChange={(event) => handleChange(event.target.value as Locale)}
        className="hidden sm:block rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 outline-none transition-colors hover:border-[#ff6be4] focus:border-[#ff6be4] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {localeLabels[locale]}
          </option>
        ))}
      </select>
    </>
  );
}
