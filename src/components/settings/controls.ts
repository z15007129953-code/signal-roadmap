export const settingsControl =
  "min-h-11 w-full rounded-sm border border-control bg-panel px-3 py-2";
export const settingsButton =
  "min-h-11 w-fit rounded-sm border border-control px-4 py-2 font-semibold disabled:opacity-60";
export type SettingsMutation = (
  action: string,
  body?: unknown,
  method?: string,
) => Promise<boolean>;
