import type { ReactNode } from "react";
import { CommerceProvider } from "@/components/VaultExperience";

export default function ConceptLayout({ children }: { children: ReactNode }) {
  return <CommerceProvider>{children}</CommerceProvider>;
}
