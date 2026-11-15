"use client";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { ItemOption, MenuItem } from "@/lib/data/types";
import { convertPrice, formatPrice } from "@/lib/format/price";
import { basePrice, isOnOffer } from "@/lib/menu/filters";
import { useI18n, useMessages } from "@/components/providers/i18n-provider";
import { useMenu } from "./menu-context";

/** Text that rolls vertically to its new value (transform + opacity only). */
export function RollingText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("relative inline-grid overflow-hidden align-bottom leading-[inherit]", className)}>
      <AnimatePresence initial={false}>
        <motion.span
          key={text}
          className="col-start-1 row-start-1 whitespace-nowrap"
          initial={{ y: "90%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-90%", opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Formats an amount stored in the restaurant currency into the currently displayed currency. */
export function useMoney() {
  const { restaurant, currency } = useMenu();
  const { lang } = useI18n();
  return (amount: number) => formatPrice(convertPrice(amount, restaurant, currency), currency, lang);
}

export function ItemPrice({
  item,
  option,
  className,
  showFrom = true,
  oldClassName,
}: {
  item: MenuItem;
  option?: ItemOption | null;
  className?: string;
  showFrom?: boolean;
  oldClassName?: string;
}) {
  const money = useMoney();
  const t = useMessages("menu").item;
  const amount = option ? option.price : basePrice(item);
  const showOld = !option && item.options.length === 0 && isOnOffer(item);
  const from = showFrom && !option && item.options.length > 1;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5 tabular-nums", className)}>
      {from && <span className="text-[0.72em] font-medium opacity-70">{t.from}</span>}
      <RollingText text={money(amount)} className="font-bold" />
      {showOld && item.oldPrice != null && (
        <s className={cn("text-[0.78em] font-medium opacity-55 decoration-[1.5px]", oldClassName)}>
          <RollingText text={money(item.oldPrice)} />
        </s>
      )}
    </span>
  );
}
