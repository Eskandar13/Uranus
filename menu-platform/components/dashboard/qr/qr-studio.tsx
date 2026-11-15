"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Copy, Download, ExternalLink, FileImage, FileCode2, Printer } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmt, pick } from "@/lib/i18n/config";
import type { LocalizedText } from "@/lib/data/types";
import { ensureContrast } from "@/lib/menu/color";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { copyText, useT } from "../hooks";
import { PageHeader, SectionCard } from "../ui";

type ColorChoice = "brand" | "black";
type Paper = "A6" | "A5";
const SIZES = [512, 1024, 2048] as const;
const MARGIN = 4; // quiet zone in modules

interface QrModel {
  /** Modules per side, including the quiet zone. */
  n: number;
  path: string;
  logo: { x: number; y: number; size: number; pad: number } | null;
}

/** Builds the module path (one rect per dark module), leaving a hole for the logo. */
function buildModel(text: string, withLogo: boolean): QrModel {
  const qr = QRCode.create(text, { errorCorrectionLevel: withLogo ? "H" : "M" });
  const size = qr.modules.size;
  const n = size + MARGIN * 2;
  let logo: QrModel["logo"] = null;
  let hole: { from: number; to: number } | null = null;
  if (withLogo) {
    // About 22% of the width (H level restores up to 30% damage).
    let s = Math.round(size * 0.22);
    if ((size - s) % 2 !== 0) s += 1;
    const from = (size - s) / 2;
    hole = { from, to: from + s };
    logo = { x: from + MARGIN, y: from + MARGIN, size: s, pad: 0.6 };
  }
  let path = "";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!qr.modules.get(r, c)) continue;
      if (hole && r >= hole.from && r < hole.to && c >= hole.from && c < hole.to) continue;
      path += `M${c + MARGIN} ${r + MARGIN}h1v1h-1z`;
    }
  }
  return { n, path, logo };
}

function svgString(model: QrModel, fg: string, logoData: string | null): string {
  const { n, path, logo } = model;
  const logoPart =
    logo && logoData
      ? `<rect x="${logo.x - logo.pad}" y="${logo.y - logo.pad}" width="${logo.size + logo.pad * 2}" height="${logo.size + logo.pad * 2}" rx="${(logo.size + logo.pad * 2) * 0.22}" fill="#ffffff"/>` +
        `<image href="${logoData}" x="${logo.x + 0.4}" y="${logo.y + 0.4}" width="${logo.size - 0.8}" height="${logo.size - 0.8}" preserveAspectRatio="xMidYMid meet"/>`
      : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges">` +
    `<rect width="${n}" height="${n}" fill="#ffffff"/>` +
    `<path d="${path}" fill="${fg}"/>` +
    logoPart +
    `</svg>`
  );
}

async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error(String(res.status));
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function svgToPng(svg: string, size: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** QR code designer: color, logo, size, PNG/SVG download and a printable table card. */
export function QrStudio({
  menuUrl,
  viewHref,
  slug,
  restaurant,
}: {
  menuUrl: string;
  viewHref: string;
  slug: string;
  restaurant: { name: LocalizedText; logoUrl: string | null; primary: string; accent: string };
}) {
  const t = useT();
  const { lang } = useI18n();
  const [color, setColor] = useState<ColorChoice>("brand");
  const [withLogo, setWithLogo] = useState(Boolean(restaurant.logoUrl));
  const [size, setSize] = useState<(typeof SIZES)[number]>(1024);
  const [paper, setPaper] = useState<Paper>("A6");
  // The fetched logo is stored with its source URL, so a logo changed in Settings is never stale.
  const [logoState, setLogoState] = useState<{ url: string; data: string | null; failed: boolean } | null>(null);
  const logoUrl = restaurant.logoUrl;
  const current = logoState && logoState.url === logoUrl ? logoState : null;
  const logoData = current?.data ?? null;
  const logoFailed = current?.failed ?? false;
  const logoSettled = current !== null;

  useEffect(() => {
    if (!logoUrl || !withLogo || logoSettled) return;
    let cancelled = false;
    toDataUrl(logoUrl)
      .then((d) => !cancelled && setLogoState({ url: logoUrl, data: d, failed: false }))
      .catch(() => {
        if (cancelled) return;
        setLogoState({ url: logoUrl, data: null, failed: true });
        toast.message(t.qr.logoFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [logoUrl, withLogo, logoSettled, t.qr.logoFailed]);

  const useLogo = withLogo && Boolean(restaurant.logoUrl) && !logoFailed;
  const model = useMemo(() => buildModel(menuUrl, useLogo), [menuUrl, useLogo]);
  const fg = color === "brand" ? ensureContrast(restaurant.primary, "#ffffff", 4.5) : "#000000";
  const svg = useMemo(() => svgString(model, fg, useLogo ? logoData : null), [model, fg, useLogo, logoData]);
  const svgUrl = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, [svg]);
  const name = pick(restaurant.name, lang);
  const fileBase = `qr-${slug}`;

  const downloadSvg = () => {
    download(new Blob([svg], { type: "image/svg+xml" }), `${fileBase}.svg`);
    toast.success(t.qr.downloaded);
  };
  const downloadPng = async () => {
    try {
      download(await svgToPng(svg, size), `${fileBase}-${size}.png`);
      toast.success(t.qr.downloaded);
    } catch {
      toast.error(t.errors.unknown);
    }
  };

  const cardSize = paper === "A6" ? { w: "105mm", h: "148mm" } : { w: "148mm", h: "210mm" };
  const pageCss = `@media print { @page { size: ${paper} portrait; margin: 0; } .dash-print-area .dash-card { width: ${cardSize.w} !important; height: ${cardSize.h} !important; max-width: none !important; } }`;

  return (
    <div>
      <PageHeader
        title={t.qr.title}
        subtitle={t.qr.subtitle}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl lg:h-10"
              onClick={async () => {
                if (await copyText(menuUrl)) toast.success(t.common.linkCopied);
              }}
            >
              <Copy aria-hidden />
              {t.common.copyLink}
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-xl lg:h-10">
              <a href={viewHref} target="_blank" rel="noopener">
                <ExternalLink className="rtl:-scale-x-100" aria-hidden />
                {t.nav.viewMenu}
              </a>
            </Button>
          </>
        }
      />
      <style>{pageCss}</style>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
        {/* QR + options */}
        <SectionCard bodyClassName="flex flex-col gap-5">
          <motion.div
            key={`${color}-${useLogo}`}
            initial={{ opacity: 0.4, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            className="mx-auto w-full max-w-72 rounded-3xl border bg-white p-3 shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={svgUrl} alt={fmt(t.qr.qrAlt, { url: menuUrl })} className="aspect-square w-full" />
          </motion.div>
          <p dir="ltr" className="truncate text-center text-xs text-muted-foreground">
            {menuUrl}
          </p>

          <div className="flex flex-col gap-4">
            <OptionRow label={t.qr.color}>
              <Choice<ColorChoice>
                value={color}
                onChange={setColor}
                options={[
                  { value: "brand", label: t.qr.brand, swatch: fg },
                  { value: "black", label: t.qr.black, swatch: "#000000" },
                ]}
              />
            </OptionRow>
            <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2">
              <span>
                <span className="block text-sm font-medium">{t.qr.logo}</span>
                {!restaurant.logoUrl && <span className="block text-xs text-muted-foreground">{t.qr.logoUnavailable}</span>}
              </span>
              <Switch checked={useLogo} onCheckedChange={setWithLogo} disabled={!restaurant.logoUrl || logoFailed} />
            </label>
            <OptionRow label={t.qr.size}>
              <Choice<string>
                value={String(size)}
                onChange={(v) => setSize(Number(v) as (typeof SIZES)[number])}
                options={SIZES.map((s) => ({ value: String(s), label: `${s}px` }))}
              />
            </OptionRow>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" className="h-12 rounded-xl" onClick={() => void downloadPng()}>
              <FileImage aria-hidden />
              {t.qr.downloadPng}
            </Button>
            <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={downloadSvg}>
              <FileCode2 aria-hidden />
              {t.qr.downloadSvg}
            </Button>
          </div>
        </SectionCard>

        {/* Table card */}
        <SectionCard
          title={t.qr.tableCard}
          description={t.qr.tableCardHint}
          bodyClassName="flex flex-col gap-4"
          action={
            <Button type="button" className="h-11 rounded-xl lg:h-10" onClick={() => window.print()}>
              <Printer aria-hidden />
              {t.qr.print}
            </Button>
          }
        >
          <OptionRow label={t.qr.paper}>
            <Choice<Paper>
              value={paper}
              onChange={setPaper}
              options={[
                { value: "A6", label: "A6" },
                { value: "A5", label: "A5" },
              ]}
            />
          </OptionRow>
          <div className="dash-print-area overflow-hidden rounded-2xl bg-muted/50 p-3 sm:p-5">
            <div
              className="dash-card mx-auto flex flex-col items-center justify-between gap-[4mm] overflow-hidden bg-white p-[8mm] text-center text-neutral-900 shadow-lg ring-1 ring-black/5"
              style={{
                width: cardSize.w,
                maxWidth: "100%",
                aspectRatio: paper === "A6" ? "105 / 148" : "148 / 210",
                borderTop: `3mm solid ${restaurant.primary}`,
                fontSize: paper === "A6" ? "10pt" : "13pt",
              }}
            >
              <div className="flex flex-col items-center gap-[2mm]">
                {restaurant.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={restaurant.logoUrl} alt="" className="h-[16mm] w-auto max-w-[40mm] object-contain" />
                ) : (
                  <span className="grid size-[14mm] place-items-center rounded-full text-[1.6em] font-bold text-white" style={{ background: restaurant.primary }}>
                    {Array.from(name)[0] ?? "؟"}
                  </span>
                )}
                <p className="text-[1.5em] leading-tight font-extrabold" dir="rtl" lang="ar">
                  {restaurant.name.ar || restaurant.name.en}
                </p>
                {restaurant.name.en && restaurant.name.en !== restaurant.name.ar && (
                  <p className="text-[1em] font-semibold tracking-wide text-neutral-500 uppercase" dir="ltr" lang="en">
                    {restaurant.name.en}
                  </p>
                )}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={svgUrl} alt="" className="aspect-square w-[62%] max-w-[90mm]" />
              <div className="flex flex-col items-center gap-[1mm]">
                <p className="text-[1.35em] font-bold" dir="rtl" lang="ar" style={{ color: ensureContrast(restaurant.primary, "#ffffff", 4.5) }}>
                  {t.qr.scanAr}
                </p>
                <p className="text-[1em] font-medium text-neutral-600" dir="ltr" lang="en">
                  {t.qr.scanEn}
                </p>
                <p className="mt-[1mm] max-w-full truncate text-[0.7em] text-neutral-400" dir="ltr">
                  {menuUrl.replace(/^https?:\/\//, "")}
                </p>
              </div>
            </div>
          </div>
          <Button type="button" variant="outline" className="h-11 rounded-xl lg:hidden" onClick={() => window.print()}>
            <Download aria-hidden />
            {t.qr.print}
          </Button>
        </SectionCard>
      </div>
    </div>
  );
}

function OptionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.82rem] font-medium">{label}</span>
      {children}
    </div>
  );
}

function Choice<V extends string>({
  value,
  onChange,
  options,
}: {
  value: V;
  onChange: (v: V) => void;
  options: Array<{ value: V; label: string; swatch?: string }>;
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium outline-none transition-all focus-visible:ring-3 focus-visible:ring-ring/50",
              selected ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-foreground/30",
            )}
          >
            {o.swatch && <span className="size-4 rounded-full ring-2 ring-white/70" style={{ background: o.swatch }} aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
