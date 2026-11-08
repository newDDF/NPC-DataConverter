import { createPageMetadata } from "@/i18n/metadata";
import { notFound } from "next/navigation";
import StreamingWorkspace from "@/components/streaming/StreamingWorkspace";
import { isLocale } from "@/i18n/config";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "en") return {};
  return createPageMetadata(locale, "streaming");
}

export default async function LocalizedStreamingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "en") notFound();

  return <StreamingWorkspace locale={locale} />;
}
