"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { ImagePlus, Loader2, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { discardUploadAction, uploadImageAction } from "@/lib/dashboard/actions";
import { prepareImage, type ImageKind } from "@/lib/images/compress";
import { IMAGE_ACCEPT_ATTR } from "@/lib/images/validate";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { callAction, useFeedback, useT } from "./hooks";

export interface ImageValue {
  url: string | null;
  blur: string | null;
}

type Phase = "idle" | "processing" | "uploading";

/**
 * Photo picker: tap or drag & drop, compresses in the browser (WebP), uploads through
 * uploadImageAction and reports { url, blur }. The parent saves them with its entity; the server
 * deletes the replaced image after a successful save. Uploads replaced before saving are discarded.
 */
export function ImageUploader({
  restaurantId,
  kind,
  value,
  onChange,
  label,
  aspect = "photo",
  className,
  hint,
  onBusyChange,
}: {
  restaurantId: string;
  kind: ImageKind;
  value: ImageValue;
  onChange: (next: ImageValue) => void;
  label: string;
  aspect?: "photo" | "wide" | "square";
  className?: string;
  hint?: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const t = useT();
  const { lang } = useI18n();
  const feedback = useFeedback();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  /** The uploaded URL the local preview stands for (hidden when the parent resets the value). */
  const [previewFor, setPreviewFor] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  /** URLs uploaded by this picker that are not saved yet (safe to discard when replaced). */
  const sessionUploads = useRef(new Set<string>());

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    onBusyChange?.(phase !== "idle");
  }, [phase, onBusyChange]);

  const discardIfUnsaved = (url: string | null) => {
    if (url && sessionUploads.current.has(url)) {
      sessionUploads.current.delete(url);
      void discardUploadAction(lang, restaurantId, url).catch(() => {});
    }
  };

  // Orphan cleanup: a session upload that is no longer the form's value (Discard, removal,
  // replacement) is deleted; on unmount every remaining one is offered for deletion. The server
  // never deletes a file that the restaurant, a category or an item still uses, so saved
  // images are safe.
  const latest = useRef({ lang, restaurantId });
  useEffect(() => {
    latest.current = { lang, restaurantId };
  });
  useEffect(() => {
    for (const url of [...sessionUploads.current]) {
      if (url !== value.url) discardIfUnsaved(url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.url]);
  useEffect(() => {
    const uploads = sessionUploads.current;
    return () => {
      const { lang: l, restaurantId: rid } = latest.current;
      for (const url of uploads) void discardUploadAction(l, rid, url).catch(() => {});
      uploads.clear();
    };
  }, []);

  const handleFile = async (file: File | undefined | null) => {
    if (!file || phase !== "idle") return;
    setPhase("processing");
    const prepared = await prepareImage(file, kind);
    if (!prepared.ok) {
      setPhase("idle");
      feedback({ ok: false, error: prepared.error });
      return;
    }
    setPreview(prepared.previewUrl);
    setPhase("uploading");
    const fd = new FormData();
    fd.set("lang", lang);
    fd.set("restaurantId", restaurantId);
    fd.set("folder", kind);
    fd.set("file", prepared.file);
    const res = await callAction(() => uploadImageAction(fd));
    setPhase("idle");
    if (!feedback(res)) {
      setPreview(null);
      return;
    }
    if (res.ok) {
      discardIfUnsaved(value.url);
      sessionUploads.current.add(res.data.url);
      setPreviewFor(res.data.url);
      onChange({ url: res.data.url, blur: prepared.blur });
    }
  };

  const remove = () => {
    discardIfUnsaved(value.url);
    setPreview(null);
    onChange({ url: null, blur: null });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void handleFile(e.dataTransfer.files?.[0]);
  };

  const busy = phase !== "idle";
  const localPreview = preview && (busy || (previewFor !== null && previewFor === value.url)) ? preview : null;
  const shown = localPreview ?? value.url;
  const compact = aspect === "square";
  const ratio = aspect === "wide" ? "aspect-[16/7]" : aspect === "square" ? "aspect-square" : "aspect-[4/3]";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={kind === "logo" ? IMAGE_ACCEPT_ATTR : IMAGE_ACCEPT_ATTR.replace(",image/svg+xml", "")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "group relative w-full overflow-hidden rounded-2xl border-2 border-dashed bg-muted/40 transition-colors",
          ratio,
          dragging ? "border-primary bg-primary/5" : "border-border",
          shown && "border-solid",
        )}
      >
        {shown ? (
          <>
            {localPreview ? (
              // Local object URL preview while uploading (not optimizable by next/image).
              // eslint-disable-next-line @next/next/no-img-element
              <img src={localPreview} alt={t.image.alt} className={cn("absolute inset-0 size-full", kind === "logo" ? "object-contain p-4" : "object-cover")} />
            ) : (
              <Image
                src={shown}
                alt={t.image.alt}
                fill
                sizes={aspect === "wide" ? "(min-width:1024px) 560px, 100vw" : "(min-width:1024px) 320px, 100vw"}
                placeholder={value.blur ? "blur" : "empty"}
                blurDataURL={value.blur ?? undefined}
                className={kind === "logo" ? "object-contain p-4" : "object-cover"}
              />
            )}
            <div className={cn("absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/55 to-transparent p-2.5 pt-8", compact ? "justify-center" : "justify-end")}>
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-xl px-3 shadow-sm"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
              >
                <RefreshCw aria-hidden />
                <span className={compact ? "sr-only" : undefined}>{t.image.replace}</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-xl px-3 text-destructive shadow-sm"
                onClick={remove}
                disabled={busy}
                aria-label={`${t.image.remove} — ${label}`}
              >
                <Trash2 aria-hidden />
                <span className={compact ? "sr-only" : "max-sm:sr-only"}>{t.image.remove}</span>
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label={`${t.image.upload} — ${label}`}
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-background text-muted-foreground shadow-sm transition-transform group-hover:scale-105">
              {dragging ? <UploadCloud className="size-6" aria-hidden /> : <ImagePlus className="size-6" aria-hidden />}
            </span>
            <span className="text-sm font-semibold">{t.image.upload}</span>
            <span className="max-w-60 text-xs text-muted-foreground">{t.image.tapOrDrop}</span>
          </button>
        )}

        <AnimatePresence>
          {busy && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-[2px]"
              role="status"
              aria-live="polite"
            >
              <span className="flex flex-col items-center gap-2 text-sm font-medium">
                <Loader2 className="size-6 animate-spin" aria-hidden />
                {phase === "processing" ? t.image.processing : t.image.uploading}
              </span>
              <span className="dash-progress absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-primary/10" aria-hidden>
                <span className="block h-full w-1/3 rounded-full bg-primary" />
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="text-xs text-muted-foreground">{hint ?? (kind === "logo" ? t.image.hintLogo : t.image.hint)}</p>
    </div>
  );
}
