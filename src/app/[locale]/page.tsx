import { createPageMetadata } from "@/i18n/metadata";
import { notFound } from "next/navigation";
import HomePage from "@/components/pages/HomePage";
import { isLocale } from "@/i18n/config";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "en") return {};
  return createPageMetadata(locale, "home");
}

export default async function LocalizedHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "en") notFound();

  return <HomePage locale={locale} />;
}
