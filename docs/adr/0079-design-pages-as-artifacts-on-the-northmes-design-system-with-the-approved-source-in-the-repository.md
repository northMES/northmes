---
status: "proposed"
date: 2026-10-14
decision-makers: proposed by the design migration session, to be confirmed by Krister Johansson
consulted: Krister Johansson (keeping the design project in the repository and a NorthMES design system, 2026-10-14)
informed: contributors and coding agents
release: "1"
needs-confirmation: "maintainer (the artifact version as the approval record; the approved page source in docs/design/project; no etag checks for pages approved in standalone Claude Design)"
---

# Design pages as artifacts on the NorthMES design system, with the approved source in the repository

## Context and problem statement

[ADR 0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md) makes every UI task start from a page approved in the NorthMES project in Claude Design. A design session builds the page through the claude-design MCP, Krister reviews it with pin comments in the Claude Design app, and the approval is recorded by the page's etag, which the operating session compares with the project's current etag before a run and at the plan gate.

Claude Design moved into Claude Artifacts on 2026-09-16, and standalone Claude Design closes on 2026-12-14. Design systems move to Artifacts as Design System artifacts; projects, their chats and their comments do not. The NorthMES design system was created as a Design System artifact on 2026-10-14 from the D1 Graphite tokens, and the NorthMES project was exported on the same day and copied into `docs/design/project/`, so the approved pages and their etags are in the repository. After 2026-12-14 there is no project to build a page in and no etag to compare.

This ADR decides where new design pages are made, how their approval is recorded and checked, and how the design system follows token changes. It covers design sessions, the operating session's drift check, `docs/design/` and the plan documents [06 web and UX](../plan/06-web-and-ux.md#claude-design-per-task) and [13 delivery and GitHub](../plan/13-delivery-and-github.md#claude-design-per-task).

## Decision drivers

* Run agents read only tracked files and fetch no URLs, so the approved page must be in the repository ([ADR 0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md)).
* An approved page is frozen, and the approval must name exactly what Krister approved.
* The design workflow should keep working after standalone Claude Design closes, with no step that depends on it.
* Every value in a design comes from the tokens in `apps/web/src/styles/tokens.css`.

## Considered options

* Design artifacts built on the NorthMES design system, with the approved version's source exported to `docs/design/project/`
* Design artifacts with only the artifact URL and version recorded, and PNGs as the repository copy
* Pages hand written as HTML in the repository, with no artifacts

## Decision outcome

Chosen option: "Design artifacts built on the NorthMES design system, with the approved version's source exported to `docs/design/project/`", because it keeps the review loop in Artifacts, where Claude Design now lives, and gives run agents and later readers the exact approved page in their worktree.

### Changes to ADR 0049

In "Claude Design per task", the first and fourth points stand. The second point stands, with the build notes naming the tokens of the NorthMES design system. The third point, "Approval is recorded by the page's etag", is replaced by these rules:

* A design page is a Design artifact built on the NorthMES design system artifact, made in a design session outside handoff runs. The session needs the Artifact tool, not the claude-design MCP. Krister reviews it with artifact comments.
* Approval is recorded by the artifact's URL and the version id of the approved publish. The design session publishes the approved state with the label "approved #<issue>", exports that version's page source to `docs/design/project/<area>/` with the page name `<area>-<issue>-<slug>.html`, and adds the page's row to `docs/design/project/README.md` with the URL and the version id. The PNGs and the record `docs/design/<area>/<page-slug>.md` are committed as before, in the same design pull request, and the issue's Design section names the URL, the version id, the frames and the paths.
* The repository copy is the approved page. A run never reads the artifact, and a later publish to the artifact does not change what the task builds. Before a UI task moves to Ready, before its run starts and at its plan gate, the operating session reads the artifact and compares its current version with the approved version id; on a mismatch Krister decides whether the new version is approved, and an approved change is a new page under a new issue number.
* Pages approved in standalone Claude Design before 2026-10-14 keep their etags in `docs/design/project/README.md` as the record of their approval. Their repository copies are final: no new work goes into the standalone project, and the operating session no longer compares their etags.
* `apps/web/src/styles/tokens.css` is the source of every token. A pull request that changes tokens is not done until a design session republishes the NorthMES design system's tokens and component styles with a change note that names the source commit. The approved D1 `docs/design/project/ui/tokens.css` stays as it was approved, so the pages that link it keep the tokens they were approved with.

The rest of ADR 0049 stands.

### Consequences

* Good, because the design workflow no longer depends on a product that closes on 2026-12-14.
* Good, because run agents and reviewers open the exact approved page source from the repository, not only its PNGs.
* Good, because new pages start from the design system's components and tokens instead of a copied `tokens.css`.
* Bad, because each approval adds the page source to the repository next to its PNGs.
* Bad, because the design system is a second copy of the tokens that a design session has to republish after every token change.
* Neutral, because pages approved before 2026-10-14 stay in the `.dc.html` format and need a local web server to render, while new pages are `.html` exports.

### Confirmation

* `test/meta/design-index.test.ts`, added by the first design task that approves an artifact page: every row of `docs/design/project/README.md` with an artifact URL has a version id and a page file that exists in its folder, and the record in `docs/design/<area>/` for that page names the same URL and version id.
* `test/meta/agent-files.test.ts` gains an assertion in the same task: step 7 of the operating session's run checklist in [docs/agents/handoff/README.md](../agents/handoff/README.md) names the artifact version comparison.
* The design system republish after a token pull request stays a review item on that pull request, because the design system artifact is private and CI cannot read it: the description links the publish whose change note names the commit.

## Pros and cons of the options

### Design artifacts with the approved source exported to the repository

* Good, because the approval names one version, and the repository holds the same bytes.
* Good, because a design can be rendered and compared again after the artifact has moved on.
* Bad, because the export and the README row are a manual step in each approval.

### Design artifacts with only the URL and version recorded

* Good, because the repository holds only PNGs and build notes, as for the etag workflow.
* Bad, because run agents cannot open the page, and the record depends on the artifact staying readable.

### Pages hand written as HTML in the repository

* Good, because nothing lives outside the repository.
* Bad, because Krister loses the rendered review with comments, and pages do not start from the design system.

## More information

The NorthMES design system artifact: https://claude.ai/artifact/65vYss7WbTHUytBjyWEJHy. The page contents and the order of design work are in [06 web and UX](../plan/06-web-and-ux.md#claude-design-per-task), and the delivery steps in [13 delivery and GitHub](../plan/13-delivery-and-github.md#claude-design-per-task). Revisit when Artifacts can mark a version as approved, or when a run agent can read an artifact.
