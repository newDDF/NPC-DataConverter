import type { Metadata } from "next";
import { locales, localeHtmlTags, localizedPath, type Locale } from "./config";

const siteUrl = "https://dataconverter.x0u0x.xyz";
const brand = "NPC-DataConverter";

const content: Record<Locale, {
  locale: string;
  homeTitle: string;
  homeDescription: string;
  homeKeywords: string[];
  streamingTitle: string;
  streamingDescription: string;
  streamingKeywords: string[];
}> = {
  en: {
    locale: "en_US",
    homeTitle: "Free Online Data Converter – JSON, CSV, XML, YAML & Excel",
    homeDescription: "Convert JSON, CSV, XML, YAML, Markdown, SQL, and Excel files online. Preview data, select fields, and export results privately in your browser.",
    homeKeywords: ["online data converter", "JSON converter", "CSV converter", "XML converter", "YAML converter", "Excel converter", "JSON to CSV", "CSV to JSON", "SQL converter"],
    streamingTitle: "Streaming File Converter – Large CSV, JSON, XML & Excel Files",
    streamingDescription: "Convert large CSV, JSON, XML, and Excel files with incremental parsing and local file output. No server upload required.",
    streamingKeywords: ["streaming file converter", "large CSV converter", "large JSON converter", "CSV streaming", "local file conversion"],
  },
  "zh-cn": {
    locale: "zh_CN",
    homeTitle: "免费在线数据格式转换器 – JSON、CSV、XML、YAML、Excel",
    homeDescription: "在线转换 JSON、CSV、XML、YAML、Markdown、SQL 和 Excel 文件。支持数据预览、字段选择，所有处理均在浏览器本地完成。",
    homeKeywords: ["在线数据转换器", "JSON转换", "CSV转换", "Excel转换", "XML转换", "YAML转换", "格式转换"],
    streamingTitle: "大文件流式转换器 – CSV、JSON、XML、Excel",
    streamingDescription: "通过增量解析和本地文件输出转换大型 CSV、JSON、XML 和 Excel 文件，无需上传到服务器。",
    streamingKeywords: ["大文件转换", "流式文件转换", "CSV大文件转换", "JSON大文件转换"],
  },
  es: {
    locale: "es_ES",
    homeTitle: "Convertidor de Datos Online Gratis – JSON, CSV, XML, YAML y Excel",
    homeDescription: "Convierte archivos JSON, CSV, XML, YAML, Markdown, SQL y Excel online. Previsualiza datos y exporta resultados directamente en tu navegador.",
    homeKeywords: ["convertidor de datos online", "convertidor JSON", "convertidor CSV", "convertidor Excel", "convertir JSON a CSV"],
    streamingTitle: "Convertidor de Archivos en Flujo – CSV, JSON, XML y Excel",
    streamingDescription: "Convierte archivos CSV, JSON, XML y Excel grandes mediante análisis incremental y almacenamiento local, sin subirlos a un servidor.",
    streamingKeywords: ["convertidor de archivos grandes", "convertidor CSV", "conversión streaming"],
  },
  de: {
    locale: "de_DE",
    homeTitle: "Kostenloser Online-Datenkonverter – JSON, CSV, XML, YAML und Excel",
    homeDescription: "Konvertiere JSON-, CSV-, XML-, YAML-, Markdown-, SQL- und Excel-Dateien online. Vorschau und Export direkt im Browser.",
    homeKeywords: ["Online-Datenkonverter", "JSON-Konverter", "CSV-Konverter", "Excel-Konverter", "Dateiformat konvertieren"],
    streamingTitle: "Streaming-Dateikonverter – Große CSV-, JSON-, XML- und Excel-Dateien",
    streamingDescription: "Konvertiere große Dateien mit inkrementeller Verarbeitung und lokaler Dateiausgabe, ohne Upload auf einen Server.",
    streamingKeywords: ["Streaming-Dateikonverter", "große CSV-Dateien konvertieren", "JSON-Konverter"],
  },
  fr: {
    locale: "fr_FR",
    homeTitle: "Convertisseur de Données en Ligne Gratuit – JSON, CSV, XML, YAML et Excel",
    homeDescription: "Convertissez des fichiers JSON, CSV, XML, YAML, Markdown, SQL et Excel en ligne. Prévisualisez et exportez vos données dans votre navigateur.",
    homeKeywords: ["convertisseur de données en ligne", "convertisseur JSON", "convertisseur CSV", "convertisseur Excel"],
    streamingTitle: "Convertisseur de Fichiers en Continu – CSV, JSON, XML et Excel",
    streamingDescription: "Convertissez de gros fichiers avec une analyse incrémentielle et une sortie locale, sans téléversement sur un serveur.",
    streamingKeywords: ["convertisseur de gros fichiers", "convertisseur CSV", "conversion en continu"],
  },
  ja: {
    locale: "ja_JP",
    homeTitle: "無料オンラインデータ変換ツール – JSON、CSV、XML、YAML、Excel",
    homeDescription: "JSON、CSV、XML、YAML、Markdown、SQL、Excel ファイルをオンライン変換。データのプレビューとエクスポートをブラウザー内で安全に行えます。",
    homeKeywords: ["オンラインデータ変換", "JSON変換", "CSV変換", "Excel変換", "ファイル形式変換"],
    streamingTitle: "大容量ファイル向けストリーミング変換ツール – CSV、JSON、XML、Excel",
    streamingDescription: "増分解析とローカル出力により、大容量ファイルをサーバーにアップロードせずに変換します。",
    streamingKeywords: ["大容量ファイル変換", "ストリーミング変換", "CSV変換"],
  },
  ko: {
    locale: "ko_KR",
    homeTitle: "무료 온라인 데이터 변환기 – JSON, CSV, XML, YAML 및 Excel",
    homeDescription: "JSON, CSV, XML, YAML, Markdown, SQL 및 Excel 파일을 온라인으로 변환하세요. 브라우저에서 데이터를 미리 보고 내보낼 수 있습니다.",
    homeKeywords: ["온라인 데이터 변환기", "JSON 변환", "CSV 변환", "Excel 변환", "파일 형식 변환"],
    streamingTitle: "대용량 파일 스트리밍 변환기 – CSV, JSON, XML 및 Excel",
    streamingDescription: "증분 파싱과 로컬 파일 출력을 사용해 서버 업로드 없이 대용량 파일을 변환합니다.",
    streamingKeywords: ["대용량 파일 변환", "스트리밍 파일 변환", "CSV 변환"],
  },
  "pt-br": {
    locale: "pt_BR",
    homeTitle: "Conversor de Dados Online Grátis – JSON, CSV, XML, YAML e Excel",
    homeDescription: "Converta arquivos JSON, CSV, XML, YAML, Markdown, SQL e Excel online. Visualize dados e exporte resultados diretamente no navegador.",
    homeKeywords: ["conversor de dados online", "conversor JSON", "conversor CSV", "conversor Excel", "conversor de arquivos"],
    streamingTitle: "Conversor de Arquivos em Fluxo – CSV, JSON, XML e Excel",
    streamingDescription: "Converta arquivos grandes com análise incremental e saída local, sem enviar arquivos para um servidor.",
    streamingKeywords: ["conversor de arquivos grandes", "conversor CSV", "conversão por fluxo"],
  },
};

export function createPageMetadata(locale: Locale, page: "home" | "streaming"): Metadata {
  const entry = content[locale];
  const title = page === "home" ? entry.homeTitle : entry.streamingTitle;
  const description = page === "home" ? entry.homeDescription : entry.streamingDescription;
  const keywords = page === "home" ? entry.homeKeywords : entry.streamingKeywords;
  const path = page === "home" ? "" : "/streaming";
  const languages = Object.fromEntries(
    locales.map((item) => [
      localeHtmlTags[item],
      `${siteUrl}${localizedPath(item, path)}`,
    ]),
  );

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: localizedPath(locale, path),
      languages: {
        ...languages,
        "x-default": `${siteUrl}${path || "/"}`,
      },
    },
    openGraph: {
      type: "website",
      url: `${siteUrl}${localizedPath(locale, path)}`,
      siteName: brand,
      title,
      description,
      locale: entry.locale,
      alternateLocale: locales.filter((item) => item !== locale).map((item) => content[item].locale),
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
  };
}
