---
status: "{proposed | accepted | rejected | deprecated | superseded by ADR-NNNN}"
date: {YYYY-MM-DD when the decision was last updated}
decision-makers: {names}
consulted: {names or research notes}
informed: {names}
release: "{1 | later | vision}"
needs-confirmation: "{empty, or who must confirm which part: maintainer, product owner, pilot IT, lawyer}"
---

# {Short title that names the problem and the chosen solution}

## Context and problem statement

{Two or three sentences, or a short story. Name the scope: which modules, surfaces or packages the decision covers.}

## Decision drivers

* {driver, for example a quality, constraint or force}

## Considered options

* {option 1}
* {option 2}

## Decision outcome

Chosen option: "{option 1}", because {justification}.

### Consequences

* Good, because {positive consequence}
* Bad, because {negative consequence}

### Confirmation

{How we check that the code follows the decision: a test, a lint rule, a CI gate, a review checklist item.}

## Pros and cons of the options

### {option 1}

* Good, because {argument}
* Neutral, because {argument}
* Bad, because {argument}

### {option 2}

* Good, because {argument}
* Bad, because {argument}

## More information

{Internal research notes cited as "internal research note NN" without a path, related ADRs, the plan in docs/plan, and when to revisit the decision.}
