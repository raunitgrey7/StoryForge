import type { Metadata } from "next";
import { CommissionClient } from "@/components/commission/CommissionClient";

export const metadata: Metadata = { title: "Commission · StoryForge" };

export default function CommissionPage() {
  return <CommissionClient />;
}
