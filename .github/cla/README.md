# Contributor license agreement signatures

`signed.json` is the public record of who signed the contributor license agreement ([ADR 0039](../../docs/adr/0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md)). `CI / cla` reads it from the default branch and passes a pull request when its author and every commit author are listed.

Each entry holds a GitHub numeric user id, which stays the same when the account is renamed, the agreement (`individual` for [CLA.md](../../CLA.md), `corporate` for a Designated Employee under [CLA-corporate.md](../../CLA-corporate.md)), the version signed and the date in `YYYY-MM-DD`:

```json
{
  "signatures": [{ "id": 1000001, "agreement": "individual", "version": "0.1", "date": "2026-10-15" }]
}
```

The file holds no names, logins or email addresses. Names, the link to each signing comment and corporate agreements stay in the maintainer's private record outside the repository.

To record a signature, the maintainer finds the signer's id with `gh api users/<login> --jq .id`, adds the entry in a pull request, merges it and re-runs `CI / cla` on the contributor's pull request. The maintainer, `renovate[bot]` and release-please's release pull requests pass without an entry.
