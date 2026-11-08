import { createPageMetadata } from "@/i18n/metadata";
import HomePage from '@/components/pages/HomePage';

export const metadata = createPageMetadata("en", "home");

export default function Page() {
  return <HomePage locale="en" />;
}
