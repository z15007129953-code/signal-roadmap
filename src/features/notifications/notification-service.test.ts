import { describe, expect, it, vi } from "vitest";
import { createNotificationService } from "./notification-service";
import type { NotificationRepository } from "./notification-types";
const workspaceId = "10000000-0000-4000-8000-000000000001";
const id = "10000000-0000-4000-8000-000000000002";
const actor = {
  kind: "account" as const,
  workspaceId,
  memberId: id,
  userId: "user",
  role: "member" as const,
};
describe("notification service boundary", () => {
  it("never allows anonymous, cross workspace, malformed or unbounded requests to persistence", async () => {
    const repository: NotificationRepository = {
      list: vi.fn(),
      markRead: vi.fn(),
    };
    const service = createNotificationService(repository);
    expect(await service.list(null, workspaceId)).toMatchObject({
      error: { code: "UNAUTHENTICATED" },
    });
    expect(
      await service.list({ ...actor, workspaceId: id }, workspaceId),
    ).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(
      await service.list(actor, workspaceId, { limit: 101 }),
    ).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
    expect(
      await service.list(actor, workspaceId, { cursor: "bad" }),
    ).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
    expect(await service.markRead(actor, workspaceId, "bad")).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
    });
    expect(repository.list).not.toHaveBeenCalled();
    expect(repository.markRead).not.toHaveBeenCalled();
  });
  it("passes normalized bounded requests and owner-scoped reads", async () => {
    const repository: NotificationRepository = {
      list: vi.fn(),
      markRead: vi.fn(),
    };
    const service = createNotificationService(repository);
    await service.list(actor, workspaceId, {});
    expect(repository.list).toHaveBeenCalledWith(actor, workspaceId, {
      limit: 50,
    });
    await service.markRead(actor, workspaceId, id);
    expect(repository.markRead).toHaveBeenCalledWith(actor, workspaceId, id);
  });
});
