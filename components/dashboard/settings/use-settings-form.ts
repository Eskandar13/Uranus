"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { z } from "zod";
import type { ActionResult } from "@/lib/dashboard/result";
import { issuesByPath } from "@/lib/dashboard/schemas";
import { callAction, useFeedback } from "../hooks";

/**
 * State for one settings section: form + saved baseline (dirty check), client-side zod
 * validation with inline errors, and a save that reports success / errors with toasts.
 */
export function useSettingsForm<F, S extends z.ZodType>({
  initial,
  schema,
  toInput,
  action,
  successMessage,
  onDirtyChange,
}: {
  initial: F;
  schema: S;
  toInput: (form: F) => unknown;
  action: (input: z.input<S>) => Promise<ActionResult>;
  successMessage: string;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const feedback = useFeedback();
  const [baseline, setBaseline] = useState(initial);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, startSaving] = useTransition();
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const save = () => {
    const input = toInput(form);
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      setErrors(issuesByPath(parsed.error));
      feedback({ ok: false, error: "invalid" });
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-state='active'] [aria-invalid='true']")?.focus());
      return;
    }
    setErrors({});
    const snapshot = form;
    startSaving(async () => {
      const res = await callAction(() => action(input as z.input<S>));
      if (feedback(res, successMessage)) setBaseline(snapshot);
    });
  };

  const discard = () => {
    setForm(baseline);
    setErrors({});
  };

  return { form, setForm, errors, dirty, saving, save, discard };
}
