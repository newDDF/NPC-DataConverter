import { defaultLocale, isLocale, type Locale } from "../config";
import type { LegalDocuments } from "./types";
import en from "./en";
import zhCn from "./zh-cn";
import es from "./es";
import de from "./de";
import fr from "./fr";
import ja from "./ja";
import ko from "./ko";
import ptBr from "./pt-br";

const legalDocuments: Partial<Record<Locale, LegalDocuments>> = {
  en,
  "zh-cn": zhCn,
  es,
  de,
  fr,
  ja,
  ko,
  "pt-br": ptBr,
};

export function getLegalDocuments(locale: string): LegalDocuments {
  const resolvedLocale = isLocale(locale) ? locale : defaultLocale;
  return legalDocuments[resolvedLocale] ?? en;
}

export type { LegalDocuments, LegalDocument, LegalSection } from "./types";
