"use client";

import { usePathname } from "next/navigation";

/**
 * Área principal do projeto: scroll nativo (mais confiável no Electron
 * do que o Radix ScrollArea com wheel/trackpad).
 * Whiteboard / geração usam altura total sem scroll externo (canvas full-bleed).
 */
export function ProjectMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fillHeight = /\/(whiteboard|generation|static\/scenes)(\/|$)/.test(pathname);

  if (fillHeight) {
    return <div className="h-full min-h-0 overflow-hidden">{children}</div>;
  }

  return (
    <div className="h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain">
      {children}
    </div>
  );
}
