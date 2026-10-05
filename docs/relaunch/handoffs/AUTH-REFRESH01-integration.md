# AUTH-REFRESH01 integration — 2026-10-05

Claude delivery c1e9473237a17bba4f5be8a0b37ec4666b9fb734 on published base
02459dd3f0f26fe9bd25a5c54fa58d8af55cdf3a. Retrieved through personal Chrome.
Original diff: 21484 bytes; SHA256
7e43a72fdc3dc70af9779cebed06a7c5338e6847217b952ac9b8f007175c9677.
Report archived in ../claude/AUTH-REFRESH01-result.md without rewriting it.

Codex reproduced 8 failing / 9 passing new regression tests before applying the
provider change. Same tests pass afterwards. Full suite: 420 tests /18 suites
PASS; typecheck PASS; targeted ESLint 0 errors/warnings; diff whitespace PASS.
Android JS/Hermes export PASS (not an APK).
Same-identity resolved-profile refresh no longer raises loading. Transient
refresh errors retain the current profile; identity transitions still clear it.
The existing unique-id single-row profile lookup and missing-profile semantics
remain unchanged. Profile caching is not server authorization.

The tests use the real provider with a navigation-gate consumer, not the real
native navigator. Phone behavior, token timing, Health Connect delivery and live
RLS remain unverified. No new APK, deployment or store upload is implied.
