import { defaultLocale, isLocale, type Locale } from "./config";
import type { Dictionary } from "./types";

import en from "./dictionaries/en";
import zhCn from "./dictionaries/zh-cn";
import es from "./dictionaries/es";
import de from "./dictionaries/de";
import fr from "./dictionaries/fr";
import ja from "./dictionaries/ja";
import ko from "./dictionaries/ko";
import ptBr from "./dictionaries/pt-br";

export const dictionaries: Record<Locale, Dictionary> = {
  en,
  "zh-cn": zhCn,
  es,
  de,
  fr,
  ja,
  ko,
  "pt-br": ptBr,
};

export function getDictionary(locale: string): Dictionary {
  const resolvedLocale = isLocale(locale) ? locale : defaultLocale;
  return dictionaries[resolvedLocale];
}

export { defaultLocale, isLocale };
export type { Locale, Dictionary };
