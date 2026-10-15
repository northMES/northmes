# NorthMES Corporate Contributor License Agreement

Version 0.1, 2026-10-15

> **Draft pending legal review.** A lawyer has not reviewed this text yet ([ADR 0039](docs/adr/0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md)). NorthMES merges no outside pull request until the reviewed version is published, and the reviewed text may differ from this draft. Questions go to legal@northmes.dev.

This agreement is for a company or other legal entity whose employees contribute work that the entity owns. It is modeled on the Apache Software Foundation's Corporate Contributor License Agreement and grants the same licenses as the [Individual Contributor License Agreement](CLA.md). A person who owns the work they contribute signs the individual agreement instead.

## How to sign

A person with authority to bind the Corporation reads this agreement, then posts this sentence as a comment on a pull request by one of the Designated Employees, with the Corporation's legal name filled in and the Designated Employees' GitHub accounts listed below it:

```text
I am authorized to sign for [legal name of the Corporation], and on its behalf I agree to the NorthMES Corporate Contributor License Agreement, version 0.1, for the contributions of the Designated Employees listed below, which form its Schedule A.
```

The maintainer may ask, through legal@northmes.dev, for proof of the signer's authority and for the Corporation's address. The maintainer records the GitHub user id of each Designated Employee, the version and the date in `.github/cla/signed.json`, with `"agreement": "corporate"`, and keeps the Corporation's name, the signer and the link to the comment in a private record outside the repository. The `CI / cla` check then passes for the Designated Employees' pull requests.

## The agreement

The Corporation accepts the following terms for the past, present and future Contributions that its Designated Employees submit to the Project Owner. Except for the licenses granted here, the Corporation keeps all right, title and interest in those Contributions.

### 1. Definitions

"Corporation" means the legal entity named in the signing comment, together with every entity that controls it, is controlled by it or is under common control with it. "Control" means direct or indirect ownership of more than fifty percent of the voting securities of an entity, or the power to direct its management, by contract or otherwise.

"Project Owner" means Krister Johansson trading as Flexmatic, and their successors and assigns.

"Designated Employee" means a person listed in Schedule A who is employed by, or works on behalf of, the Corporation.

"Work" means NorthMES and any other software the Project Owner owns or manages.

"Contribution" means any original work of authorship, including a change or an addition to an existing work, that a Designated Employee intentionally Submits to the Project Owner for inclusion in the Work, and that the Corporation owns or has the right to license.

"Submit" means to send something in electronic, spoken or written form to the Project Owner or its representatives to discuss or improve the Work, including through pull requests, issues, comments and messages on the systems the Project Owner uses for NorthMES. Something clearly marked in writing as "Not a Contribution" is not submitted.

### 2. Grant of copyright license

The Corporation grants the Project Owner, and recipients of software the Project Owner distributes, a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable copyright license to reproduce, prepare derivative works of, publicly display, publicly perform, sublicense and distribute its Contributions and such derivative works.

### 3. Grant of patent license

The Corporation grants the Project Owner, and recipients of software the Project Owner distributes, a perpetual, worldwide, non-exclusive, no-charge, royalty-free patent license to make, have made, use, offer to sell, sell, import and otherwise transfer the Work. The license is irrevocable except as this section states. It covers only the patent claims the Corporation can license that a Contribution infringes on its own, or that the combination of a Contribution with the Work it was submitted to infringes.

If an entity starts patent litigation, including a cross-claim or counterclaim, against the Corporation or anyone else, claiming that a Contribution or the Work directly or contributorily infringes a patent, the patent licenses this agreement grants to that entity for that Contribution or Work end on the date the litigation is filed.

### 4. A license grant, not an assignment

This agreement grants licenses. It does not transfer ownership of any Contribution to the Project Owner. The Corporation may use its Contributions for any other purpose.

### 5. Outbound license

The Project Owner keeps each Contribution, as part of the Work, available to the public under the GNU Affero General Public License, version 3 or any later version (AGPL-3.0-or-later). A Contribution to a package that the Project Owner licenses under the MIT License stays available under the MIT License. The Project Owner may also license the Contribution under other terms, as section 6 allows.

### 6. Sublicensing and transfer

The Project Owner may sublicense the rights granted in sections 2 and 3, including under license terms other than those of section 5. The Project Owner may transfer this agreement and the rights granted under it, in whole or in part, to a successor of the NorthMES business. This agreement binds and benefits the Project Owner's successors and assigns.

### 7. The Corporation's representations

The Corporation represents that it has the legal right to grant the licenses in this agreement, and that each Designated Employee is authorized to submit Contributions on its behalf.

The Corporation represents that each of its Contributions is its own original creation, except work submitted under section 8. When a Designated Employee submits a Contribution, it states every third-party license or other restriction the Corporation knows of that applies to any part of it, including related patents and trademarks.

### 8. Work that is not the Corporation's original creation

Work that is not the Corporation's original creation goes in a separate submission, never inside a Contribution. That submission names the work's source in full, states every license or other restriction the Corporation knows of that applies to it (including related patents, trademarks and license agreements), and is clearly marked "Submitted on behalf of a third party: [name of the third party]".

### 9. No warranty and no obligation to support

The Corporation does not have to support its Contributions. It may support them for free, for a fee or not at all. Unless applicable law requires otherwise or the Corporation agrees otherwise in writing, the Corporation provides its Contributions "AS IS", without warranties or conditions of any kind, express or implied, including warranties or conditions of title, non-infringement, merchantability or fitness for a particular purpose.

### 10. Schedule A and changes in circumstances

Schedule A is the list of Designated Employees in the signing comment. A person with authority to bind the Corporation adds or removes a Designated Employee with a new comment on a NorthMES pull request or issue, or by email to legal@northmes.dev. A removal does not withdraw the licenses for Contributions submitted before it.

The Corporation agrees to tell the Project Owner at legal@northmes.dev when it learns of any fact or circumstance that makes a representation in this agreement inaccurate.

## Open points for the legal review

- The governing law and the venue for disputes.
- Whether a pull request comment by an authorized person is a valid signature for a company, and what proof of authority the maintainer should ask for.
- Whether a Designated Employee also signs the individual agreement, as the Apache Software Foundation asks.
