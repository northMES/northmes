# Domain docs

Read before exploring: `GLOSSARY.md` at the repository root for the project's terms, and the ADRs in `docs/adr/` that touch the area you work in. Use glossary terms in code names, test names, issue titles and ADRs. When your output contradicts an ADR, say so and leave the ADR as it is.

## ADRs

This section replaces the ADR format in the domain-modeling skill.

- Start from `docs/adr/template.md` (MADR) and fill its front matter: status, date, decision-makers, consulted, informed, release and needs-confirmation.
- A new ADR has status `proposed`. Only Krister sets `accepted`.
- Take the number from the ADR numbering script rather than from a scan of `docs/adr/`. Until that script exists, the planning session numbers ADRs by hand from the index in `docs/adr/README.md`.
- Offer an ADR when a decision is hard to reverse, surprising without context and a real trade-off. A decision the plan in `docs/plan` lists gets an ADR either way.
- Each Confirmation item names a test, lint rule or CI check that a task can carry.

## Glossary

One `GLOSSARY.md` at the root. Terms only: one or two sentences per term and the words to avoid. When Pyramid or another ERP uses another word, name it in the definition. Implementation details belong in the code and decisions in ADRs.
