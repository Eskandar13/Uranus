"use client";

import Link from "next/link";
import { Store } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { useT } from "./hooks";
import { EmptyState } from "./ui";

/** Shown when the signed-in user has no restaurant to manage. */
export function NoRestaurant({ isAdmin }: { isAdmin: boolean }) {
  const t = useT();
  const { lang } = useI18n();
  return (
    <div className="mx-auto max-w-lg py-10">
      <EmptyState
        icon={Store}
        title={t.empty.noRestaurantTitle}
        body={isAdmin ? t.empty.adminNoRestaurantBody : t.empty.noRestaurantBody}
        action={
          isAdmin ? (
            <Button asChild className="h-11 rounded-xl px-5">
              <Link href={`/${lang}/admin`}>{t.empty.goAdmin}</Link>
            </Button>
          ) : null
        }
        className="bg-card"
      />
    </div>
  );
}
