"use client";

import { usePathname } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Área principal do projeto: ScrollArea estilizado na maioria das rotas.
 * Whiteboard / geração usam altura total sem scroll externo (canvas full-bleed).
 */
export function ProjectMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fillHeight = /\/(whiteboard|generation|static\/scenes)(\/|$)/.test(pathname);

  if (fillHeight) {
    return <div className="h-full min-h-0 overflow-hidden">{children}</div>;
  }

  return <ScrollArea className="h-full">{children}</ScrollArea>;
}
