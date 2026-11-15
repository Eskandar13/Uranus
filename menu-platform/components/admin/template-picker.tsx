"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import { useMessages } from "@/components/providers/i18n-provider";
import type { TemplateId } from "@/lib/data/types";
import { readableOn } from "@/lib/menu/color";
import { cn } from "@/lib/utils";
import { TEMPLATE_ORDER } from "./types";

/** Radio cards with a tiny live preview of each menu template in the chosen brand color. */
export function TemplatePicker({
  name,
  value,
  onChange,
  color,
  labelledBy,
}: {
  name: string;
  value: TemplateId;
  onChange: (t: TemplateId) => void;
  color: string;
  labelledBy: string;
}) {
  const t = useMessages("admin");
  const reduce = useReducedMotion();
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid gap-3 sm:grid-cols-3">
      {TEMPLATE_ORDER.map((id) => {
        const selected = value === id;
        return (
          <label
            key={id}
            className={cn(
              "group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-background text-start transition-all has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
              selected ? "border-foreground shadow-md" : "hover:border-foreground/30 hover:shadow-sm",
            )}
          >
            <input
              type="radio"
              name={name}
              value={id}
              checked={selected}
              onChange={() => onChange(id)}
              className="sr-only"
            />
            <div className="relative bg-muted/50 p-3">
              <motion.div
                animate={reduce ? undefined : { scale: selected ? 1 : 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <MiniPreview template={id} color={color} />
              </motion.div>
              {selected ? (
                <span className="absolute end-2 top-2 inline-flex size-6 items-center justify-center rounded-full bg-foreground text-background shadow">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
              ) : null}
            </div>
            <span className="space-y-0.5 p-3">
              <span className="block text-sm font-semibold">{t.new.templates[id].name}</span>
              <span className="block text-xs leading-relaxed text-muted-foreground">{t.new.templates[id].description}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

function MiniPreview({ template, color }: { template: TemplateId; color: string }) {
  const on = readableOn(color);
  if (template === "noir") {
    return (
      <div className="mx-auto h-36 w-24 overflow-hidden rounded-xl bg-neutral-950 p-2 shadow-lg ring-1 ring-black/40" aria-hidden="true">
        <div className="mx-auto mt-1 h-1.5 w-10 rounded-full" style={{ backgroundColor: "#D4A373" }} />
        <div className="mx-auto mt-1.5 h-1 w-6 rounded-full bg-white/30" />
        <div className="mt-3 flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2 w-5 rounded-sm border" style={{ borderColor: i === 0 ? color : "rgb(255 255 255 / 0.2)" }} />
          ))}
        </div>
        <div className="mt-2.5 space-y-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between border-b border-white/10 pb-1">
              <span className="h-1 w-9 rounded-full bg-white/60" />
              <span className="h-1 w-3 rounded-full" style={{ backgroundColor: "#D4A373" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (template === "pop") {
    return (
      <div className="mx-auto h-36 w-24 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/10" aria-hidden="true">
        <div className="h-10 rounded-b-2xl p-2" style={{ backgroundColor: color }}>
          <div className="h-1.5 w-10 rounded-full" style={{ backgroundColor: on, opacity: 0.9 }} />
          <div className="mt-1 h-1 w-6 rounded-full" style={{ backgroundColor: on, opacity: 0.5 }} />
        </div>
        <div className="flex gap-1 px-2 pt-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-3 flex-1 rounded-full" style={{ backgroundColor: i === 0 ? "#F59E0B" : "#f1f1f1" }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5 p-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg bg-neutral-100 p-1" style={{ boxShadow: `0 2px 0 ${color}` }}>
              <div className="h-5 rounded-md bg-neutral-300" />
              <div className="mt-1 h-1 w-8 rounded-full bg-neutral-800/70" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto h-36 w-24 overflow-hidden rounded-xl bg-[#fffaf3] shadow-lg ring-1 ring-black/10" aria-hidden="true">
      <div
        className="h-9"
        style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${color} 55%, white), color-mix(in oklab, #0F766E 30%, white))` }}
      />
      <div className="-mt-3 ms-2 size-6 rounded-full bg-white shadow ring-2 ring-white" style={{ backgroundColor: color }} />
      <div className="px-2 pt-1.5">
        <div className="h-1.5 w-12 rounded-full bg-neutral-800/80" />
        <div className="mt-2 flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2.5 w-5 rounded-full" style={{ backgroundColor: i === 0 ? color : "rgb(0 0 0 / 0.07)" }} />
          ))}
        </div>
        <div className="mt-2 space-y-1.5">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-lg bg-white p-1 shadow-sm">
              <span className="size-5 rounded-md bg-neutral-200" />
              <span className="flex-1 space-y-1">
                <span className="block h-1 w-8 rounded-full bg-neutral-700/70" />
                <span className="block h-1 w-5 rounded-full" style={{ backgroundColor: color }} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
