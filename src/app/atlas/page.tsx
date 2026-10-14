import type { Metadata } from "next";
import { AtlasClient } from "@/components/atlas/AtlasClient";

export const metadata: Metadata = { title: "Atlas · StoryForge" };

export default function AtlasPage() {
  return <AtlasClient />;
}
