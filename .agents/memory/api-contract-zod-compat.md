---
name: API contract Zod compatibility
description: OpenAPI-generated validators in this workspace use the installed Zod 3 API.
---

When adding OpenAPI schemas, avoid formats and integer-specific constructs that Orval turns into newer Zod helpers unavailable in the workspace's installed Zod version; prefer compatible string and number schemas unless the package is upgraded deliberately.

**Why:** The first Important Updates contract generated successfully but the chained library typecheck failed because generated validators called `zod.int()` and `zod.url()`, which are not present in the current Zod package.

**How to apply:** After every spec change, run codegen and the library typecheck before wiring new hooks or server validators.