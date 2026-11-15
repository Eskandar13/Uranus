"use client";

import { createContext, useContext, useState, type CSSProperties, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import type { ColorMode, RadiusId, TemplateId } from "@/lib/data/types";

export interface MenuShellProps {
  template: TemplateId;
  radius: RadiusId;
  mode: ColorMode;
  /** CSS custom properties (brand colors, font) computed on the server. */
  style: CSSProperties;
  children: ReactNode;
}

interface ShellValue {
  template: TemplateId;
  /** Element inside .menu-root that dialogs/drawers portal into (keeps CSS variables + dir). */
  portal: HTMLElement | null;
}

const ShellContext = createContext<ShellValue>({ template: "aurora", portal: null });

export function useMenuShell() {
  return useContext(ShellContext);
}

/**
 * Root of every public-menu page: one next-themes provider (storageKey "menu-theme",
 * default = restaurant mode), Motion config that honours reduced motion, and the themed root.
 */
export function MenuShell({ template, radius, mode, style, children }: MenuShellProps) {
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  return (
    <ThemeProvider
      attribute="class"
      storageKey="menu-theme"
      defaultTheme={mode}
      enableSystem
      disableTransitionOnChange
    >
      <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 420, damping: 36 }}>
        <ShellContext.Provider value={{ template, portal }}>
          <div className="menu-root" data-template={template} data-radius={radius} style={style}>
            {children}
            <div ref={setPortal} data-menu-portal="" />
          </div>
        </ShellContext.Provider>
      </MotionConfig>
    </ThemeProvider>
  );
}
