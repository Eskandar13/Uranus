import { createElement } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { isOptimizableImage } from "@/lib/menu/image-url";
import { categoryIcon } from "./icons";

/**
 * next/image with blur-up (placeholder="blur" when a blur data URL exists) and a branded
 * fallback when there is no photo. The parent must be `relative` with a size/aspect ratio.
 */
export function MenuImage({
  src,
  blur,
  alt,
  sizes,
  icon,
  className,
  imgClassName,
  priority = false,
  zoom = true,
}: {
  src: string | null;
  blur?: string | null;
  alt: string;
  sizes: string;
  icon?: string | null;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  zoom?: boolean;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          "absolute inset-0 grid place-items-center overflow-hidden",
          "bg-[radial-gradient(120%_90%_at_20%_10%,color-mix(in_oklab,var(--brand)_32%,transparent),transparent_60%),radial-gradient(90%_80%_at_90%_100%,color-mix(in_oklab,var(--brand-accent)_28%,transparent),transparent_60%)]",
          "bg-(--m-surface-2)",
          className,
        )}
        role="img"
        aria-label={alt}
      >
        {createElement(categoryIcon(icon), {
          className: cn("size-1/3 max-h-16 max-w-16 opacity-35", zoom && "m-zoom"),
          strokeWidth: 1.4,
          "aria-hidden": true,
        })}
      </div>
    );
  }
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized={!isOptimizableImage(src)}
        sizes={sizes}
        placeholder={blur ? "blur" : "empty"}
        blurDataURL={blur ?? undefined}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        className={cn("object-cover", zoom && "m-zoom", imgClassName)}
      />
    </div>
  );
}
