import type { MetadataRoute } from "next";

export const dynamic = "force-static";
import { locales, localeHtmlTags, localizedPath } from "@/i18n/config";

const siteUrl = "https://dataconverter.x0u0x.xyz";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["", "/streaming"];

  return paths.flatMap((path) => {
    const languages = Object.fromEntries(
      locales.map((locale) => [
        localeHtmlTags[locale],
        `${siteUrl}${localizedPath(locale, path)}`,
      ]),
    );

    return locales.map((locale) => ({
      url: `${siteUrl}${localizedPath(locale, path)}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.8,
      alternates: {
        languages: {
          ...languages,
          "x-default": `${siteUrl}${path || "/"}`,
        },
      },
    }));
  });
}
