"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SettingsSnapshot } from "@/features/settings/settings-types";
import { TaxonomySettings } from "./taxonomy-settings";
import {
  settingsControl,
  settingsButton,
  type SettingsMutation,
} from "./controls";
export function SettingsPanel({
  workspace,
  initial,
  storageAvailable,
  memberSearch = "",
}: {
  workspace: string;
  initial: SettingsSnapshot;
  storageAvailable: boolean;
  memberSearch?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.workspace.name);
  const [description, setDescription] = useState(
    initial.workspace.description ?? "",
  );
  const [accent, setAccent] = useState(
    initial.workspace.accentColor ?? "#BD3C16",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const base = `/api/workspaces/${encodeURIComponent(workspace)}/settings`;
  const owner = initial.role === "owner" && !initial.isDemo;
  const mutate: SettingsMutation = async (action, body, method = "POST") => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${base}/${action}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        const code = result.error?.code;
        setError(
          code === "CONFLICT"
            ? "This change conflicts with existing data. Names and addresses must be unique, a board with feedback cannot be deleted, and the last owner must stay an owner."
            : code === "DEMO_QUOTA_EXCEEDED"
              ? "This demo has reached its settings limit. Remove an unused item before adding another."
              : code === "DEMO_EXPIRED"
                ? "This demo has expired. Keep a copy of your changes and start a new demo."
                : "The change could not be saved. Check the fields and your permissions; your text is still here.",
        );
        return false;
      }
      setNotice("Changes saved.");
      router.refresh();
      return true;
    } catch {
      setError(
        "Check your connection and try again. Your changes have been kept.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  async function upload(file: File) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/uploads/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace, type: file.type, size: file.size }),
      });
      const signed = await response.json();
      if (!response.ok || !signed.ok) throw Error("upload");
      const put = await fetch(signed.value.url, {
        method: "PUT",
        headers: signed.value.headers,
        body: file,
      });
      if (!put.ok) throw Error("upload");
      const linked = await fetch("/api/uploads/logo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace, key: signed.value.key }),
      });
      if (!linked.ok) throw Error("upload");
      setNotice("Logo updated.");
      router.refresh();
    } catch {
      setError(
        "We could not confirm the logo update. Refresh to check before retrying. Choose a PNG, JPEG, WebP or SVG up to 2 MB.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-12">
      <div className="grid gap-2">
        {error && (
          <p
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="text-critical"
          >
            {error}
          </p>
        )}
        <p role="status" className="text-sm text-muted">
          {busy ? "Saving changes…" : notice}
        </p>
      </div>
      {owner ? (
        <section
          aria-labelledby="brand-title"
          className="grid gap-6 border-t border-rule pt-6"
        >
          <h2 id="brand-title" className="font-serif text-2xl">
            Workspace identity
          </h2>
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(14rem,1fr)]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void mutate("branding", {
                  name,
                  description: description || null,
                  accentColor: accent,
                });
              }}
            >
              <fieldset disabled={busy} className="grid gap-5">
                <label className="grid gap-2 font-medium">
                  Workspace name
                  <input
                    className={settingsControl}
                    required
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="grid gap-2 font-medium">
                  Public description
                  <textarea
                    className={settingsControl}
                    rows={4}
                    maxLength={500}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
                <label className="grid gap-2 font-medium">
                  Accent color
                  <input
                    type="color"
                    className="h-11 w-20 border border-control"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                  />
                </label>
                <p className="text-sm text-muted">
                  Your accent is used as a small identity marker. Text and
                  controls keep accessible contrast.
                </p>
                <button className={settingsButton}>Save branding</button>
              </fieldset>
            </form>
            <aside
              aria-label="Branding preview"
              className="grid gap-4 border-y border-rule py-5 [overflow-wrap:anywhere]"
            >
              <p className="text-sm text-muted">Identity preview</p>
              <span
                aria-hidden="true"
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: accent }}
              />
              <h3 className="font-serif text-2xl">
                {name || "Workspace name"}
              </h3>
              <p className="text-muted">
                {description || "Your public description will appear here."}
              </p>
            </aside>
          </div>
          {storageAvailable ? (
            <label className="grid max-w-xl gap-2 font-medium">
              Workspace logo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                disabled={busy}
                className={settingsControl}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                  e.target.value = "";
                }}
              />
              <span className="text-sm font-normal text-muted">
                PNG, JPEG, WebP or SVG. Maximum 2 MB.
              </span>
            </label>
          ) : (
            <p className="text-sm text-muted">
              Logo uploads are not configured. Connect object storage before
              uploading an image.
            </p>
          )}
        </section>
      ) : (
        <p className="max-w-prose text-muted">
          Only a workspace owner can change branding and member roles. Demo
          moderator access is limited to boards and tags.
        </p>
      )}
      <TaxonomySettings initial={initial} busy={busy} mutate={mutate} />
      {owner && (
        <section
          aria-labelledby="members-title"
          className="grid gap-5 border-t border-rule pt-6"
        >
          <h2 id="members-title" className="font-serif text-2xl">
            Members
          </h2>
          <p className="text-muted">
            Manage existing workspace members. The last owner cannot be demoted.
            Invitations are not included in this version.
          </p>
          <form className="flex flex-wrap items-end gap-3">
            <label className="grid flex-1 gap-2">
              Find a member
              <input
                className={settingsControl}
                name="search"
                defaultValue={memberSearch}
                maxLength={100}
              />
            </label>
            <button className={settingsButton}>Search members</button>
          </form>
          <ul className="divide-y divide-rule">
            {initial.members.items.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-4 py-4"
              >
                <p className="min-w-0 font-medium [overflow-wrap:anywhere]">
                  {member.displayName}
                </p>
                <form
                  className="flex flex-wrap gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const role = new FormData(e.currentTarget).get("role");
                    if (
                      window.confirm(
                        `Change ${member.displayName}'s role to ${role}?`,
                      )
                    )
                      void mutate("role", { memberId: member.id, role });
                  }}
                >
                  <label className="sr-only" htmlFor={`role-${member.id}`}>
                    Role for {member.displayName}
                  </label>
                  <select
                    id={`role-${member.id}`}
                    name="role"
                    defaultValue={member.role}
                    disabled={busy}
                    className={settingsControl + " w-auto"}
                  >
                    <option value="member">Member</option>
                    <option value="moderator">Moderator</option>
                    <option value="owner">Owner</option>
                  </select>
                  <button className={settingsButton} disabled={busy}>
                    Save role
                  </button>
                </form>
              </li>
            ))}
          </ul>
          {initial.members.nextCursor && (
            <a
              href={`?search=${encodeURIComponent(memberSearch)}&cursor=${encodeURIComponent(initial.members.nextCursor)}`}
              className="w-fit py-2 underline"
            >
              More members
            </a>
          )}
        </section>
      )}
    </div>
  );
}
