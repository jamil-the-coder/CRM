import { LocalStorageProvider } from "./local-provider";
import type { StorageProvider } from "./types";

export type { StorageProvider } from "./types";

const localProvider = new LocalStorageProvider();

/**
 * Swaps in a real provider by changing STORAGE_PROVIDER — same factory
 * pattern as getCalendarProvider(). Only "local" exists today; a real Azure
 * Blob provider is additive whenever it's needed.
 */
export function getStorageProvider(): StorageProvider {
  const providerName = process.env.STORAGE_PROVIDER ?? "local";
  if (providerName === "local") return localProvider;
  throw new Error(
    `Unknown STORAGE_PROVIDER "${providerName}" — only "local" is implemented so far.`,
  );
}
