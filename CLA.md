# NorthMES individual contributor license agreement

Version 0.1, 2026-10-15

> **Draft pending legal review.** A lawyer has not reviewed this text yet ([ADR 0039](docs/adr/0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md)). NorthMES merges no outside pull request until the reviewed version is published, and the reviewed text may differ from this draft. Questions go to legal@northmes.dev.

This agreement is modeled on the Apache Software Foundation's Individual Contributor License Agreement, with a promise about outbound licensing modeled on the Harmony agreements' "Option Five". If your employer owns the work you contribute, your employer signs the [Corporate Contributor License Agreement](CLA-corporate.md) instead.

## How to sign

Read this agreement, then post this sentence, unchanged, as a comment on your pull request:

```text
I have read the NorthMES Individual Contributor License Agreement, version 0.1, and I agree to its terms for all my past and future contributions to NorthMES.
```

The maintainer records your GitHub user id, the version you signed and the date in `.github/cla/signed.json`, and keeps your name and the link to your comment in a private record outside the repository. The `CI / cla` check then passes for your pull requests.

## The agreement

You accept the following terms for Your past, present and future Contributions submitted to the Project Owner. Except for the licenses granted here, You keep all right, title and interest in Your Contributions.

### 1. Definitions

"You" (or "Your") means the copyright owner, or the legal entity authorized by the copyright owner, that makes this agreement with the Project Owner.

"Project Owner" means Krister Johansson trading as Flexmatic, and their successors and assigns.

"Work" means NorthMES and any other software the Project Owner owns or manages.

"Contribution" means any original work of authorship, including a change or an addition to an existing work, that You intentionally Submit to the Project Owner for inclusion in the Work.

"Submit" means to send something in electronic, spoken or written form to the Project Owner or its representatives to discuss or improve the Work, including through pull requests, issues, comments and messages on the systems the Project Owner uses for NorthMES. Something You clearly mark in writing as "Not a Contribution" is not submitted.

### 2. Grant of copyright license

You grant the Project Owner, and recipients of software the Project Owner distributes, a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable copyright license to reproduce, prepare derivative works of, publicly display, publicly perform, sublicense and distribute Your Contributions and such derivative works.

### 3. Grant of patent license

You grant the Project Owner, and recipients of software the Project Owner distributes, a perpetual, worldwide, non-exclusive, no-charge, royalty-free patent license to make, have made, use, offer to sell, sell, import and otherwise transfer the Work. The license is irrevocable except as this section states. It covers only the patent claims You can license that Your Contribution infringes on its own, or that the combination of Your Contribution with the Work it was submitted to infringes.

If an entity starts patent litigation, including a cross-claim or counterclaim, against You or anyone else, claiming that Your Contribution or the Work directly or contributorily infringes a patent, the patent licenses this agreement grants to that entity for that Contribution or Work end on the date the litigation is filed.

### 4. A license grant, not an assignment

This agreement grants licenses. It does not transfer ownership of Your Contributions to the Project Owner. You may use Your Contributions for any other purpose.

### 5. Outbound license

The Project Owner keeps each Contribution, as part of the Work, available to the public under the GNU Affero General Public License, version 3 or any later version (AGPL-3.0-or-later). A Contribution to a package that the Project Owner licenses under the MIT License stays available under the MIT License. The Project Owner may also license the Contribution under other terms, as section 6 allows.

### 6. Sublicensing and transfer

The Project Owner may sublicense the rights granted in sections 2 and 3, including under license terms other than those of section 5. The Project Owner may transfer this agreement and the rights granted under it, in whole or in part, to a successor of the NorthMES business. This agreement binds and benefits the Project Owner's successors and assigns.

### 7. Your representations

You represent that You have the legal right to grant the licenses in this agreement.

If Your employer holds rights in what You create, Your Contributions included, You represent one of the following: Your employer has allowed You to make Contributions on its behalf; Your employer has waived those rights for Your Contributions to the Project Owner; or Your employer has signed the Corporate Contributor License Agreement and lists You in its Schedule A.

You represent that each of Your Contributions is Your own original creation, except work You submit under section 8. When You submit a Contribution, You state every third-party license or other restriction You personally know of that applies to any part of it, including related patents and trademarks.

### 8. Work that is not Your original creation

Work that is not Your own original creation goes in a separate submission, never inside a Contribution. That submission names the work's source in full, states every license or other restriction You personally know of that applies to it (including related patents, trademarks and license agreements), and is clearly marked "Submitted on behalf of a third party: [name of the third party]".

### 9. No warranty and no obligation to support

You do not have to support Your Contributions. You may support them for free, for a fee or not at all. Unless applicable law requires otherwise or You agree otherwise in writing, You provide Your Contributions "AS IS", without warranties or conditions of any kind, express or implied, including warranties or conditions of title, non-infringement, merchantability or fitness for a particular purpose.

### 10. Changes in Your circumstances

You agree to tell the Project Owner at legal@northmes.dev when You learn of any fact or circumstance that makes a representation in this agreement inaccurate.

## Open points for the legal review

- The governing law and the venue for disputes.
- Whether a pull request comment with the sentence above is a valid signature where the Project Owner and contributors are.
- Whether section 5 lets the Project Owner move a helper from an AGPL-3.0-or-later package to an MIT package and change the extension exception that [ADR 0056](docs/adr/0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md) proposes.
