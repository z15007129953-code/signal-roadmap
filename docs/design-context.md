# Signal Roadmap Design Context

This document is the human-readable source of truth for product and interface
decisions. It applies to both the public feedback portal and the internal
moderation experience.

## Audience and core jobs

Signal Roadmap is used by product managers, founders, product operations teams,
moderators, and customers participating in a public feedback portal.

Community members need to:

- submit feedback with enough context to be useful;
- discover related requests and existing decisions;
- vote on priorities without losing the nuance of the discussion; and
- discuss feedback and understand what happens next.

Product teams and moderators need to:

- triage incoming feedback quickly and consistently;
- find and merge duplicates without obscuring community support;
- move feedback through visible roadmap states; and
- communicate product decisions candidly to the people who contributed.

## Voice and emotional outcome

The defining personality is **civic, buoyant, and candid**. The experience
should carry the openness of a public forum, the optimism of collective
progress, and the clarity of an accountable decision record.

Community users should feel heard and oriented, even when a request is not
planned. Moderators should feel precise, fast, and in control, especially when
working through a dense queue.

## Visual direction

The primary experience is light and editorial: a well-maintained community
noticeboard rather than a generic SaaS dashboard. Paper-tinted canvases and
surfaces provide the ground, ink-like text provides contrast, and a rare
persimmon/coral accent marks the most important actions and moments.

Dark mode follows the operating system preference. It should remain a
paper-and-ink interpretation with warm, quiet surfaces—not a neon interface or
a field of glowing panels.

Status colors are semantic. Every status must also be identified with readable
text, shape, iconography, or another durable cue so color is never the only way
to understand state.

## Distinctive product character

Signal Roadmap should feel like a well-run public town hall. Strong typographic
feedback titles and plainly visible states make the public decision process
legible. Moderation views share that civic character but become tighter, more
operational, and more information-dense where speed demands it.

## Anti-references

Avoid the patterns that make community products feel interchangeable:

- generic grids of identical cards;
- cyan/purple gradients or gradient text;
- glassmorphism, glow-on-dark decoration, and neon accents;
- thick left or right accent stripes;
- excessive pill-shaped controls and labels;
- dashboard metric-hero templates; and
- critical actions that appear only on hover.

## Accessibility standard

Target WCAG 2.2 AA. The product must remain understandable and operable at 200%
zoom, with a keyboard, and with a screen reader. Respect reduced-motion
preferences, communicate statuses safely for common color-vision differences,
and provide 44px touch targets where practical.

## Six fixed principles

1. **Titles and status lead.** Feedback titles and status are the primary
   information hierarchy.
2. **Match the work mode.** Community surfaces are welcoming; moderation
   surfaces are precise.
3. **Meaning survives without color.** Color is never the sole carrier of
   status or meaning.
4. **Mobile keeps the job intact.** Phone layouts preserve submit, vote, filter,
   and moderation actions without depending on hover.
5. **Empty states teach.** Every empty state explains the next useful action.
6. **Empty states stay truthful.** Never invent activity, momentum, or social
   proof when no activity exists.
