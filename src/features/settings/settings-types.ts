import type { z } from "zod";
import type { Result } from "@/lib/http/result";
import type { boards, tags } from "@/lib/db/schema";
import type { WorkspaceRole } from "../auth/actor";
import type { FeedbackActor } from "../feedback/types";
import type {
  brandingSchema,
  boardSchema,
  tagSchema,
  memberQuerySchema,
  roleSchema,
} from "./settings-schema";
export type BrandingInput = z.infer<typeof brandingSchema>;
export type BoardInput = z.infer<typeof boardSchema>;
export type TagInput = z.infer<typeof tagSchema>;
export type MemberQuery = z.infer<typeof memberQuerySchema>;
export type RoleInput = z.infer<typeof roleSchema>;
export type WorkspaceBranding = BrandingInput & {
  id: string;
  logoKey: string | null;
};
export type SettingsBoard = typeof boards.$inferSelect;
export type SettingsTag = typeof tags.$inferSelect;
export type SettingsMember = {
  id: string;
  displayName: string;
  role: WorkspaceRole;
};
export type SettingsSnapshot = {
  workspace: WorkspaceBranding;
  role: WorkspaceRole;
  isDemo: boolean;
  boards: SettingsBoard[];
  tags: SettingsTag[];
  members: { items: SettingsMember[]; nextCursor: string | null };
};
export interface SettingsRepository {
  get(
    actor: FeedbackActor,
    w: string,
    query?: MemberQuery,
  ): Promise<Result<SettingsSnapshot>>;
  branding(
    actor: FeedbackActor,
    w: string,
    input: BrandingInput,
  ): Promise<Result<WorkspaceBranding>>;
  setLogo(
    actor: FeedbackActor,
    w: string,
    key: string | null,
  ): Promise<Result<WorkspaceBranding>>;
  saveBoard(
    actor: FeedbackActor,
    w: string,
    input: BoardInput,
  ): Promise<Result<SettingsBoard>>;
  deleteBoard(
    actor: FeedbackActor,
    w: string,
    id: string,
  ): Promise<Result<{ id: string }>>;
  saveTag(
    actor: FeedbackActor,
    w: string,
    input: TagInput,
  ): Promise<Result<SettingsTag>>;
  deleteTag(
    actor: FeedbackActor,
    w: string,
    id: string,
  ): Promise<Result<{ id: string }>>;
  changeRole(
    actor: FeedbackActor,
    w: string,
    input: RoleInput,
  ): Promise<Result<SettingsMember>>;
}
