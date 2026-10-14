import type { Metadata } from "next";
import { ReaderClient } from "@/components/reader/ReaderClient";

export const metadata: Metadata = { title: "Read · StoryForge" };

export default async function ReadPage({ params }: { params: Promise<{ workId: string }> }) {
  const { workId } = await params;
  return <ReaderClient workId={workId} />;
}
