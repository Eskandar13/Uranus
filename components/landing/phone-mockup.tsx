"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CakeSlice, Check, Coffee, Croissant, Search, UtensilsCrossed } from "lucide-react";
import type { Messages } from "@/lib/i18n/dictionaries";

const TILES = [
  { Icon: Coffee, bg: "linear-gradient(135deg,#8a5a3c,#4b2e1e)" },
  { Icon: Croissant, bg: "linear-gradient(135deg,#f1ad2f,#d9822b)" },
  { Icon: CakeSlice, bg: "linear-gradient(135deg,#7da36a,#456b3a)" },
];

/** Fixed pseudo-QR pattern (decorative). 9x9 grid, finder squares drawn separately. */
const QR = "101101001011010100110110010110011010011010110100101101010011001";

function MiniQr() {
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < 81; i++) {
    const x = i % 9;
    const y = Math.floor(i / 9);
    const inFinder = (x < 3 && y < 3) || (x > 5 && y < 3) || (x < 3 && y > 5);
    if (!inFinder && QR[i % QR.length] === "1") {
      cells.push(<rect key={i} x={x} y={y} width="0.88" height="0.88" rx="0.2" fill="currentColor" />);
    }
  }
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="3" height="3" rx="0.6" fill="currentColor" />
      <rect x={x + 0.7} y={y + 0.7} width="1.6" height="1.6" rx="0.3" fill="var(--lp-card)" />
      <rect x={x + 1.1} y={y + 1.1} width="0.8" height="0.8" fill="currentColor" />
    </g>
  );
  return (
    <svg viewBox="0 0 9 9" width="72" height="72" aria-hidden="true">
      {cells}
      {finder(0, 0)}
      {finder(6, 0)}
      {finder(0, 6)}
    </svg>
  );
}

export function PhoneMockup({ m }: { m: Messages<"landing">["mock"] }) {
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setTick((t) => t + 1), 3200);
    return () => clearInterval(id);
  }, [reduce]);

  const updated = !reduce && tick % 2 === 1;
  const active = reduce ? 0 : Math.floor(tick / 2) % m.categories.length;
  const price = (i: number) => (updated ? m.items[i].newPrice : m.items[i].price);

  return (
    <div className="lp-phone-stage" aria-hidden="true">
      <div className="lp-phone-ring" />

      <div className="lp-float lp-float-dash">
        <strong>{m.dashboardTitle}</strong>
        <div className="lp-field">
          <span>{m.dashboardField}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{price(1)}</span>
        </div>
        <motion.span
          className="lp-save"
          animate={updated && !reduce ? { scale: [1, 0.94, 1] } : { scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          {m.dashboardSave}
        </motion.span>
      </div>

      <div className="lp-phone">
        <div className="lp-screen">
          <div className="lp-notch" />
          <div className="lp-cover">
            <div className="lp-cover-row">
              <span className="lp-cover-logo">
                <UtensilsCrossed size={16} />
              </span>
              <span className="lp-cover-name lp-display">{m.restaurant}</span>
            </div>
            <div className="lp-search">
              <Search size={12} />
              {m.search}
            </div>
          </div>

          <div className="lp-cats">
            {m.categories.map((c, i) => (
              <span key={c} className={`lp-cat${i === active ? " lp-cat-active" : ""}`}>
                {i === active && (
                  <motion.span layoutId="lp-cat-pill" className="lp-cat-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                )}
                {c}
              </span>
            ))}
          </div>

          <div className="lp-items">
            {m.items.map((it, i) => {
              const { Icon, bg } = TILES[i % TILES.length];
              return (
                <div className="lp-item" key={it.name}>
                  <span className="lp-item-photo" style={{ background: bg }}>
                    <Icon size={20} />
                  </span>
                  <div className="lp-item-body">
                    <div className="lp-item-name">{it.name}</div>
                    <div className="lp-item-desc">{it.desc}</div>
                  </div>
                  <div className="lp-item-price">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={price(i)}
                        style={{ display: "inline-block" }}
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -10, opacity: 0 }}
                        transition={{ duration: 0.28 }}
                      >
                        {price(i)} <small>{m.currency}</small>
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>

          <AnimatePresence>
            {updated && (
              <motion.div
                className="lp-toast"
                initial={{ y: 16, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 10, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
              >
                <Check size={14} />
                {m.updated}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="lp-float lp-float-qr">
        <MiniQr />
        <span>{m.qrLabel}</span>
      </div>
    </div>
  );
}
