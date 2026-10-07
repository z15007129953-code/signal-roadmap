import { cookies } from "next/headers";
import { LOCALE_COOKIE, parseLocale, type Locale } from "./i18n";

/** Read the first-party locale preference for the current server render. */
export async function getLocale(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    return parseLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  } catch {
    return "en";
  }
}
