# Local patches to installed skills

Changes made to skills that live in the Claude Code **plugin cache**. That cache is
version-scoped (`.../superpowers/6.1.1/`) and pinned to an upstream git SHA, so a plugin
update installs into a new directory and **silently discards these edits**. The patches
here exist so they can be re-applied deliberately.

## `superpowers-writing-plans.patch`

**Applies to:** `superpowers` plugin, `skills/writing-plans/SKILL.md`
**Written against:** version 6.1.1 (`d884ae04edebef577e82ff7c4e143debd0bbec99`)
**Date:** 2026-09-04
**Tested:** no — see "Status" below.

### What it changes

The skill previously required the plan to contain **complete implementation code for
every step** ("Complete code in every step — if a step changes code, show the code"). It
now asks each step for a specific set of parts instead:

| Step kind | Contains |
| --- | --- |
| Test step | Complete test code, verbatim — unchanged |
| Implementation step | File and exact signature, one line of responsibility, and the non-obvious constraints |
| Command step | Exact command and expected output — unchanged |
| Interfaces block | Exact cross-task names and types — unchanged |

Two carve-outs keep literal content where it is the specification: **config/schema**
(a theme block, a CI matrix, a migration — nothing tests these) and **snippets whose
precise form is the point** (a regex, a security header, a transition table).

The anti-vagueness rules are all retained under "Still plan failures". "Add appropriate
error handling" is still a plan failure; it now says to name the actual error cases.

### Why

Evidence from building this project's frontend, lead-operations API and admin panel:

- **Full implementation code in the plan caught zero bugs.** Every defect surfaced at
  execution time by running tests and curl — a required `Viewing.property` field, a
  `Property` needing `slug`/`reference`/`state` on direct create, a test regex matching
  two elements, an article-agreement bug in a user-facing string. The plan contained
  confident-looking code for all of them. Writing it twice produced false confidence,
  not verification.
- **What did catch real problems was reasoning about structure** — that
  `enquiryEmails.js` already held viewing templates, and that moving `not-found.js` into
  a route group would strip navigation off the 404 page. Both came from the spec/plan
  self-review, and both are cheap to express.
- **The plans went stale immediately.** A dropped component, a changed fetch call and an
  edited error message all left the plan describing code that does not exist.
- Plan sizes were 4,343 and ~2,900 lines for slices that took a few hours.

The literal-code rule still earns its cost when a **different context** executes the plan
— a fresh subagent, another session, a human reviewer. It is waste when the same context
writes and immediately executes it.

### Form of the change

`superpowers:writing-skills` has a "Match the Form to the Failure" table: when the
baseline failure is *wrong-shaped output* (bloat, restating the spec), a **prohibition
list measurably backfires** — it tested worse than no guidance at all. The right form is
a positive recipe stating what the output IS.

So this patch does **not** say "don't write full implementations." It states what a step
contains. There are no nuance clauses, for the same reason.

### Status: untested

`superpowers:writing-skills` sets an Iron Law — *no skill edit without a failing test
first*, verified by dispatching subagents against a no-guidance control. **That was
deliberately skipped here.** The change is therefore unverified: the new wording may not
actually shift behaviour, which is exactly the failure mode the skill warns about.

Judge it on the next real plan. If plans stay bloated, the wording is not binding and
needs tightening rather than lengthening.

### Re-applying after a plugin update

```bash
cd "$HOME/.claude/plugins/cache/superpowers-dev/superpowers/<new-version>/skills/writing-plans"
patch -p0 --dry-run < /path/to/docs/patches/superpowers-writing-plans.patch   # check first
patch -p0 < /path/to/docs/patches/superpowers-writing-plans.patch
```

If upstream has rewritten the same sections the patch will conflict. Re-read the section
above and re-apply the intent by hand rather than forcing it.
