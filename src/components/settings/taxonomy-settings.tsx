"use client";
import type { SettingsSnapshot } from "@/features/settings/settings-types";
import {
  settingsButton,
  settingsControl,
  type SettingsMutation,
} from "./controls";
export function TaxonomySettings({
  initial,
  busy,
  mutate,
}: {
  initial: SettingsSnapshot;
  busy: boolean;
  mutate: SettingsMutation;
}) {
  return (
    <>
      {(["board", "tag"] as const).map((kind) => {
        const items = kind === "board" ? initial.boards : initial.tags;
        return (
          <section
            key={kind}
            aria-labelledby={`${kind}-title`}
            className="grid gap-5 border-t border-rule pt-6"
          >
            <h2 id={`${kind}-title`} className="font-serif text-2xl">
              {kind === "board" ? "Boards" : "Tags"}
            </h2>
            <p className="max-w-prose text-muted">
              {kind === "board"
                ? "Boards organize incoming feedback. A board with feedback cannot be deleted."
                : "Tags add context across boards. Removing a tag also removes it from tagged ideas."}
            </p>
            {items.map((item) => (
              <details key={item.id} className="border-b border-rule pb-4">
                <summary className="min-h-11 cursor-pointer py-2 font-semibold [overflow-wrap:anywhere]">
                  {item.name}
                </summary>
                <TaxonomyForm
                  kind={kind}
                  initial={item}
                  busy={busy}
                  mutate={mutate}
                />
                <button
                  className="mt-4 min-h-11 py-2 text-critical underline disabled:opacity-60"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete ${kind} “${item.name}”?${kind === "tag" ? " It will be removed from all tagged ideas." : " Only an empty board can be deleted."}`,
                      )
                    )
                      void mutate(`${kind}/${item.id}`, undefined, "DELETE");
                  }}
                >
                  Delete {kind}
                </button>
              </details>
            ))}
            {!items.length && (
              <p className="text-muted">
                No {kind}s yet. Add one below to organize your feedback.
              </p>
            )}
            <details>
              <summary className="min-h-11 cursor-pointer py-2 font-semibold">
                Add {kind}
              </summary>
              <TaxonomyForm kind={kind} busy={busy} mutate={mutate} />
            </details>
          </section>
        );
      })}
    </>
  );
}
type TaxonomyItem = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  position?: number;
  color?: string;
};
function TaxonomyForm({
  kind,
  initial,
  busy,
  mutate,
}: {
  kind: "board" | "tag";
  initial?: TaxonomyItem;
  busy: boolean;
  mutate: SettingsMutation;
}) {
  return (
    <form
      className="max-w-2xl"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        const common = {
          ...(initial ? { id: initial.id } : {}),
          name: data.get("name"),
          slug: data.get("slug"),
        };
        const payload =
          kind === "board"
            ? {
                ...common,
                description: data.get("description") || null,
                position: Number(data.get("position")),
              }
            : { ...common, color: data.get("color") };
        if ((await mutate(kind, payload)) && !initial) form.reset();
      }}
    >
      <fieldset disabled={busy} className="grid gap-4 pt-4">
        <label className="grid gap-2">
          {kind === "board" ? "Board name" : "Tag name"}
          <input
            name="name"
            defaultValue={initial?.name}
            required
            maxLength={kind === "board" ? 80 : 40}
            className={settingsControl}
          />
        </label>
        <label className="grid gap-2">
          Address
          <input
            name="slug"
            defaultValue={initial?.slug}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={80}
            className={settingsControl}
          />
          <span className="text-sm text-muted">
            Lowercase letters, numbers and hyphens, such as product-ideas.
          </span>
        </label>
        {kind === "board" ? (
          <>
            <label className="grid gap-2">
              Board description
              <textarea
                name="description"
                defaultValue={initial?.description ?? ""}
                maxLength={500}
                className={settingsControl}
              />
            </label>
            <label className="grid gap-2">
              Display order
              <input
                type="number"
                min={0}
                max={9999}
                name="position"
                defaultValue={initial?.position ?? 0}
                required
                className={settingsControl}
              />
            </label>
          </>
        ) : (
          <label className="grid gap-2">
            Tag color
            <input
              type="color"
              name="color"
              defaultValue={initial?.color ?? "#6E7568"}
              className="h-11 w-20"
            />
          </label>
        )}
        <button className={settingsButton}>
          {initial ? "Save" : "Add"} {kind}
        </button>
      </fieldset>
    </form>
  );
}
