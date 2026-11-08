import { createPageMetadata } from "@/i18n/metadata";
import StreamingWorkspace from '@/components/streaming/StreamingWorkspace';

export const metadata = createPageMetadata("en", "streaming");

export default function StreamingPage() {
  return <StreamingWorkspace locale="en" />;
}
