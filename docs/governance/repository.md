# Repository Governance Supplement

This supplement contains only rules specific to StuTrade Web. The shared
baseline owns general authorization, engineering, verification, Git, and
delivery behavior.

## Repository Actions

- **R-A003** In a fresh checkout, run `bun install --frozen-lockfile` before
  treating missing project tools as code failures. Run `bun run check` as the
  complete repository check.
- **R-A004** After intentionally changing `openapi/stu-trade.yaml`, regenerate
  `src/api/generated/schema.ts` with `bun run api:generate`; do not edit the
  generated file by hand.

## Authority and Boundaries

- **R-G001** The parent repository's `docs/project-description.md` owns current
  product scope, user-visible transaction semantics, deployment topology, and
  cross-component boundaries. Each repository's `docs/implementation_plan.md`
  owns unfinished targets and stages without proving current behavior.
- **R-G002** The engine repository's exported Go code and behavioral tests own
  generic matching models, protocols, errors, restoration rules, and
  state-machine behavior.
- **R-G003** This repository's `openapi/stu-trade.yaml` owns `/api/v1` paths,
  transport DTOs, statuses, and error structures. Web maintainers propose
  caller-facing HTTP structures; host maintainers review product semantics,
  security, idempotence, and feasibility before implementation.
- **R-G006** This repository's implementation and behavioral tests own pages,
  interaction, browser routing, accessibility, client request state, and the
  static frontend build. Frontend code displays host results instead of
  reimplementing matching, transaction, or persistence rules.
- **R-G007** The host owns business behavior, persistence, `/health`, `/ready`,
  process configuration, dependency assembly, and deployment lifecycle; these
  are not web application responsibilities.

## Toolchain, Generation, and Delivery

- **R-G008** The parent repository records the exact web commit and owns its
  integrated packaging and deployment. A child merge is not integrated until
  the parent gitlink is updated and verified.
- **R-G009** `package.json` selects Bun and `bun.lock` records dependencies.
  Repository commands and dependency metadata do not introduce a second
  package manager or lockfile.
- **R-G010** `src/api/generated/schema.ts` is derived only from
  `openapi/stu-trade.yaml`; `bun run api:check` detects drift, and
  `bun run build` produces the static `dist/` artifact.
