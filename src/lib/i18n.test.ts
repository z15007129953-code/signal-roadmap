// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const mockCookies = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({ cookies: mockCookies }));

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  getMessages,
  messages,
  parseLocale,
} from "./i18n";
import { getLocale } from "./i18n-server";

describe("locale primitives", () => {
  it("uses English as the default and rejects unsupported values", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(parseLocale(undefined)).toBe("en");
    expect(parseLocale(null)).toBe("en");
    expect(parseLocale("fr")).toBe("en");
    expect(parseLocale("zh")).toBe("zh");
  });

  it("reads the locale from the first-party cookie", async () => {
    mockCookies.mockResolvedValue({
      get: (name: string) =>
        name === LOCALE_COOKIE ? { value: "zh" } : undefined,
    });
    await expect(getLocale()).resolves.toBe("zh");
  });

  it("keeps a complete message dictionary for both supported locales", () => {
    expect(getMessages("en")).toBe(messages.en);
    expect(getMessages("zh")).toBe(messages.zh);
    expect(messages.en.shell.feedback).toBe("Feedback");
    expect(messages.zh.shell.feedback).toBe("反馈");
    expect(messages.en.shell.demoWorkspaceName).toBe("Feedback workspace");
    expect(messages.zh.shell.demoWorkspaceName).toBe("反馈工作区");
    expect(messages.en.home.title).toBe("Product feedback, in one place.");
    expect(messages.zh.home.title).toBe("产品反馈，一处查看。");
    expect(messages.en.demo.requestLimitWait(3)).toContain("3 seconds");
    expect(messages.zh.demo.requestLimitWait(3)).toContain("3 秒");
  });
});
