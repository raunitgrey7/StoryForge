import type { Metadata } from "next";
import { StudioClient } from "@/components/studio/StudioClient";

export const metadata: Metadata = { title: "Studio · StoryForge" };

export default function StudioPage() {
  return <StudioClient />;
}
