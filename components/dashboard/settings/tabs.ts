/** Settings sections (plain module so Server Components can read it). */
export const SETTINGS_TABS = ["branding", "info", "contact", "hours", "currency"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];
