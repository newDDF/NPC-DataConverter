export const locales = [
  "en",
  "zh-cn",
  "es",
  "de",
  "fr",
  "ja",
  "ko",
  "pt-br",
] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  "zh-cn": "简体中文",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  ja: "日本語",
  ko: "한국어",
  "pt-br": "Português (Brasil)",
};

export const localeHtmlTags: Record<Locale, string> = {
  en: "en",
  "zh-cn": "zh-CN",
  es: "es",
  de: "de",
  fr: "fr",
  ja: "ja",
  ko: "ko",
  "pt-br": "pt-BR",
};

export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale === value);
}

export function localizedPath(locale: Locale, path = ""): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (locale === defaultLocale) {
    return normalizedPath === "/" ? "/" : normalizedPath;
  }

  return normalizedPath === "/"
    ? `/${locale}`
    : `/${locale}${normalizedPath}`;
}
