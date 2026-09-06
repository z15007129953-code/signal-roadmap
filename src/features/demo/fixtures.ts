import { randomUUID } from "node:crypto";
import type * as schema from "../../lib/db/schema.ts";

export const CANONICAL_SHOWCASE = {
  id: "51000000-0000-4000-8000-000000000001",
  slug: "signal-roadmap",
  name: "Signal Roadmap",
  description:
    "A fictional product community exploring calmer ways to collect feedback, share priorities, and close the loop. All names and content are samples.",
} as const;

export type FixtureInput = {
  workspaceId: string;
  memberId: string;
  moderatorId: string;
  canonical?: boolean;
};

type Idea = {
  slug: string;
  title: string;
  body: string;
  board: number;
  tag: number;
  status: typeof schema.feedback.$inferInsert.status;
};

const ideas: Idea[] = [
  {
    slug: "weekly-progress-digest",
    title: "A weekly digest of the ideas I follow",
    body: "I follow several ideas but rarely remember to check each one. Could I receive one Friday email with status changes and a short summary of new discussion? A quiet week should mean no email.",
    board: 0,
    tag: 0,
    status: "under_review",
  },
  {
    slug: "weekly-email-recap",
    title: "Send a weekly email recap for followed suggestions",
    body: "Instead of an email for every comment, I would love a single weekly recap of followed suggestions. Please include the current status and a link back to the conversation.",
    board: 0,
    tag: 0,
    status: "under_review",
  },
  {
    slug: "saved-feedback-views",
    title: "Save a filtered feedback view",
    body: "Our support team starts each morning with the same board and tag filters. Naming and saving that view would make it easier to share the triage routine with a new teammate.",
    board: 1,
    tag: 1,
    status: "planned",
  },
  {
    slug: "keyboard-navigation",
    title: "Move through feedback with the keyboard",
    body: "When reviewing a long list, I want to move between suggestions and open the selected item without reaching for the mouse. Visible focus and a short help menu would make this discoverable.",
    board: 1,
    tag: 2,
    status: "in_progress",
  },
  {
    slug: "follow-an-idea",
    title: "Follow an idea without adding a vote",
    body: "Sometimes I need to track a request on behalf of a customer without signalling that it is my own priority. A separate follow action would keep votes meaningful.",
    board: 0,
    tag: 0,
    status: "completed",
  },
  {
    slug: "automatic-priority-score",
    title: "Automatically rank every request by a priority score",
    body: "Could votes, recency, and effort be combined into one automatic priority number? We hoped this might make planning faster, although we would still need room for team judgment.",
    board: 1,
    tag: 3,
    status: "closed",
  },
  {
    slug: "release-feedback-links",
    title: "Connect release notes to the requests they deliver",
    body: "A release note should lead back to the original discussion. That would let us thank contributors and help readers understand the problem behind each change.",
    board: 0,
    tag: 4,
    status: "completed",
  },
  {
    slug: "slack-triage-summary",
    title: "Post a small triage summary to Slack",
    body: "Our product channel needs a daily count of new requests and links to the ones needing a decision. An optional summary would be more useful than a message for every event.",
    board: 2,
    tag: 5,
    status: "planned",
  },
  {
    slug: "csv-feedback-export",
    title: "Export the current feedback view as CSV",
    body: "Before a planning workshop we group requests in a spreadsheet. Please export the active filters, including status and tags, so the export matches what we were reviewing.",
    board: 2,
    tag: 3,
    status: "in_progress",
  },
  {
    slug: "clearer-mobile-filters",
    title: "Make active filters easier to spot on a phone",
    body: "On a narrow screen I sometimes forget that a tag filter is active and assume suggestions are missing. A compact summary above the results would help me reset the view.",
    board: 0,
    tag: 2,
    status: "under_review",
  },
  {
    slug: "moderation-reasons",
    title: "Explain why a suggestion is still in review",
    body: "After submitting an idea, I would like to know whether it needs more detail or is simply waiting for the team. A friendly review message could set expectations without promising a deadline.",
    board: 1,
    tag: 1,
    status: "planned",
  },
  {
    slug: "readable-release-summaries",
    title: "Give each release a short plain-language summary",
    body: "The full release notes are useful, but I want to scan what changed before opening them. A one-sentence summary would help me decide which updates matter to my team.",
    board: 0,
    tag: 4,
    status: "completed",
  },
  {
    slug: "github-issue-reference",
    title: "Attach a GitHub issue reference to a suggestion",
    body: "When engineering starts work, moderators could attach an issue link to the feedback. Keep the customer conversation here while giving the team a route to implementation details.",
    board: 2,
    tag: 5,
    status: "under_review",
  },
  {
    slug: "bulk-tagging",
    title: "Tag related feedback together during triage",
    body: "We often identify a group of requests about the same workflow. Selecting a few items and applying a tag once would save repeated edits while leaving each discussion separate.",
    board: 1,
    tag: 1,
    status: "in_progress",
  },
  {
    slug: "public-roadmap-context",
    title: "Add context to roadmap decisions",
    body: "A status alone does not explain why a request is planned. A short note about the customer need and what we are exploring would make the public roadmap easier to understand.",
    board: 0,
    tag: 3,
    status: "planned",
  },
  {
    slug: "webhook-status-events",
    title: "Send a webhook when a request changes status",
    body: "We keep an internal customer tracker and want to update it when a followed request ships. A signed webhook with a stable event identifier would let us connect the two tools reliably.",
    board: 2,
    tag: 5,
    status: "under_review",
  },
  {
    slug: "anonymous-voting",
    title: "Allow votes without joining the community",
    body: "A one-click anonymous vote might lower the barrier for occasional visitors. We would need a clear way to avoid repeated votes and explain how those votes compare with member feedback.",
    board: 0,
    tag: 1,
    status: "closed",
  },
  {
    slug: "reply-context",
    title: "Keep a reply beside the comment it answers",
    body: "In longer conversations it is hard to tell which question a response addresses. A single level of replies would preserve context without making the discussion difficult to scan.",
    board: 1,
    tag: 2,
    status: "completed",
  },
  {
    slug: "board-notification-preferences",
    title: "Choose notification preferences for each board",
    body: "I help with integrations but only occasionally read product ideas. Separate board preferences would let me stay involved without receiving updates from every conversation.",
    board: 0,
    tag: 0,
    status: "under_review",
  },
  {
    slug: "linear-triage-link",
    title: "Link an approved request to Linear",
    body: "After triage, our team moves implementation work into Linear. Could moderators record that issue link here so that we can get back to the source discussion later?",
    board: 2,
    tag: 5,
    status: "under_review",
  },
  {
    slug: "clear-filter-shortcut",
    title: "Clear all active filters in one action",
    body: "After exploring several tags and statuses I want an obvious way to return to the full feedback list. This would be particularly helpful when sharing my screen during planning.",
    board: 1,
    tag: 2,
    status: "under_review",
  },
];

const discussion = [
  "Friday would work well for our support handoff. Please include only ideas with an actual update.",
  "I would use this too. An empty recap would be noise, so skipping quiet weeks matters.",
  "A shared link to a saved view would help the next person covering our queue.",
  "Please keep the current selection visible when the list scrolls. That makes keyboard review much easier.",
  "This separates keeping informed from setting priorities in exactly the way our team needed.",
  "We explored this and decided not to reduce different customer needs to one score. Votes remain one input to a human decision.",
  "We can now show a customer the path from their original request to the shipped change.",
  "A summary at the start of our workday would be enough. A timezone preference could come later.",
  "Keeping the active filters is essential; our workshop only covers the integrations board.",
  "I ran into this after opening a shared link. Showing the active tag beside the result count would help.",
  "Knowing that a person will review my suggestion is more reassuring than a generic pending badge.",
  "The short summary helped me find the relevant update without reading every release in full.",
  "Some of our repositories are private. The label should still make sense to readers who cannot open the link.",
  "Please show the selection count before applying a tag so I can check the scope.",
  "A sentence about the problem would be more useful than an estimated date that might change.",
  "A stable event identifier would help us safely retry delivery without creating duplicate updates.",
  "We are keeping votes tied to community membership for now so that one person has one vote per idea.",
  "A single reply level feels right. I can follow the conversation without opening a separate thread.",
  "Thanks, that is the scope we are exploring: meaningful changes in one quiet weekly email.",
  "This sounds closely related to the weekly digest suggestion. We can merge the discussions after reviewing both requests.",
  "We have included visible focus in the current work and are checking the list and detail views together.",
  "The first export will include the selected board, status, and tags alongside the request title.",
  "Good point. The integration will treat external links as optional context for community readers.",
  "Agreed. The delivered version keeps replies attached to their original comment.",
];

export function buildWorkspaceFixtures(input: FixtureInput) {
  if (input.canonical && input.workspaceId !== CANONICAL_SHOWCASE.id)
    throw new Error(
      "Fixed fixture IDs are reserved for the canonical showcase",
    );
  const { workspaceId, memberId, moderatorId } = input;
  const id = (number: number) =>
    input.canonical
      ? `51000000-0000-4000-8000-${number.toString().padStart(12, "0")}`
      : randomUUID();
  const date = (day: number) => new Date(Date.UTC(2026, 7, day, 9));
  const members = [
    "Maya Chen",
    "Elliot Brooks",
    "Nora Silva",
    "Samir Patel",
    "June Park",
    "Alex Rivera",
  ].map((displayName, index) => ({
    id: id(10 + index),
    workspaceId,
    displayName,
    role: "member" as const,
    userId: null,
    demoSessionId: null,
    createdAt: date(1),
    updatedAt: date(1),
  }));
  const boards = [
    {
      slug: "ideas",
      name: "Product ideas",
      description:
        "Make collecting feedback and sharing progress feel simpler.",
    },
    {
      slug: "workflow",
      name: "Team workflow",
      description: "Improve everyday triage, collaboration, and planning.",
    },
    {
      slug: "integrations",
      name: "Integrations",
      description: "Connect community insights with the tools your team uses.",
    },
  ].map((board, index) => ({
    ...board,
    id: id(100 + index),
    workspaceId,
    position: index,
    createdAt: date(1),
  }));
  const tags = [
    { name: "Notifications", slug: "notifications", color: "#B57A43" },
    { name: "Triage", slug: "triage", color: "#6E7568" },
    { name: "Accessibility", slug: "accessibility", color: "#567A8C" },
    { name: "Planning", slug: "planning", color: "#8A7090" },
    { name: "Release notes", slug: "release-notes", color: "#617C58" },
    { name: "Connected tools", slug: "connected-tools", color: "#A36C64" },
  ].map((tag, index) => ({
    ...tag,
    id: id(200 + index),
    workspaceId,
    createdAt: date(1),
  }));
  const feedback = ideas.map((idea, index) => ({
    id: id(300 + index),
    workspaceId,
    boardId: boards[idea.board].id,
    authorId: index >= 18 ? memberId : members[index % members.length].id,
    slug: idea.slug,
    title: idea.title,
    body: idea.body,
    status: idea.status!,
    visibility: index < 18 ? ("published" as const) : ("pending" as const),
    pinned: index === 0,
    manualRank: index,
    createdAt: date(index + 2),
    updatedAt: date(index + 3),
  }));
  const feedbackTags = feedback.map((item, index) => ({
    workspaceId,
    feedbackId: item.id,
    tagId: tags[ideas[index].tag].id,
    createdAt: date(index + 2),
  }));
  const replyTargets = [0, 1, 3, 8, 12, 17];
  const commentIds = discussion.map((_, index) => id(400 + index));
  const comments = discussion.map((body, index) => {
    const target = index < 18 ? index : replyTargets[index - 18];
    return {
      id: commentIds[index],
      workspaceId,
      feedbackId: feedback[target].id,
      authorId:
        index >= 18 || target === 5 || target === 16
          ? moderatorId
          : members[(index + 1) % members.length].id,
      body,
      isInternal: false,
      parentId: index < 18 ? null : commentIds[target],
      createdAt: date(24 + Math.floor(index / 8)),
      updatedAt: date(24 + Math.floor(index / 8)),
    };
  });
  const votes = feedback.slice(0, 18).flatMap((item, index) =>
    members.slice(0, 2 + (index % 5)).map((member) => ({
      workspaceId,
      feedbackId: item.id,
      memberId: member.id,
      createdAt: date(23),
    })),
  );
  const follows = [0, 3, 8].map((index) => ({
    workspaceId,
    feedbackId: feedback[index].id,
    memberId,
    createdAt: date(23),
  }));
  const changelogEntries = [
    {
      slug: "follow-the-progress",
      title: "Follow the progress that matters to you",
      summary:
        "Follow an idea independently of your vote and keep track of its journey.",
      body: "## Stay close to an idea\n\nYou can now follow a suggestion without voting for it. Use Follow on the feedback detail page to keep track of an idea you care about.\n\nVotes continue to express support, while following lets you stay involved on behalf of your team or a customer. Thanks to everyone who explained why those are different needs.",
    },
    {
      slug: "releases-with-context",
      title: "Release notes with the full story",
      summary:
        "Scan concise summaries and follow a shipped change back to its original request.",
      body: "## See what changed, and why\n\nRelease notes now include a short summary and links to the completed feedback they address. Open a linked suggestion to revisit the discussion and the customer need behind the release.\n\nThis closes the loop for contributors and makes the changelog easier to scan.",
    },
    {
      slug: "conversations-in-context",
      title: "Keep conversations in context",
      summary:
        "Reply directly to a comment while keeping the discussion easy to scan.",
      body: "## A little more structure\n\nComments now support one level of replies. A response stays beside the comment it answers, so a longer discussion remains understandable.\n\nWe kept the structure intentionally shallow: the whole conversation still belongs to the original suggestion.",
    },
  ].map((entry, index) => ({
    ...entry,
    id: id(500 + index),
    workspaceId,
    authorId: moderatorId,
    publishedAt: date(27 + index),
    createdAt: date(27 + index),
    updatedAt: date(27 + index),
  }));
  const changelogFeedback = [
    [0, 4],
    [1, 6],
    [1, 11],
    [2, 17],
  ].map(([entry, idea]) => ({
    workspaceId,
    changelogEntryId: changelogEntries[entry].id,
    feedbackId: feedback[idea].id,
    createdAt: date(27 + entry),
  }));
  return {
    members,
    boards,
    tags,
    feedback,
    feedbackTags,
    comments,
    votes,
    follows,
    changelogEntries,
    changelogFeedback,
  };
}
