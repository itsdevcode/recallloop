# RecallLoop — submission draft outline

Draft only. Not published. Confirm the event's current eligibility, submission
format, and required tags before publishing. This document does not assert that
RecallLoop has been deployed or that live inference succeeded in this release.

## What I built

RecallLoop turns public articles into a small, personal learning practice. Save a
link, let hosted open-weight Gemma identify concepts and generate recall cards,
then work through questions one at a time. Reveal an answer only after trying to
remember it. Rate that attempt Forgot, Hard, or Easy to schedule the next review.

## The problem

Bookmarks preserve a URL, but they do not create a habit of returning to its ideas.
RecallLoop connects reading to practice: a source-grounded question, a moment to
recall it, and a scheduled return. There are no invented learning-outcome claims,
adoption numbers, or testimonials in this submission.

## How Gemma is used

The worker sends selected extracted article text to `gemma-4-26b-a4b-it` through
the Google Gen AI SDK. It requests concepts and question–answer cards, then checks
the JSON with Pydantic and verifies quoted evidence against the source. Long
articles are bounded and coverage limits are disclosed. Evidence matching does
not prove every generated claim is correct; readers should check the source.

Gemma generates content. A pure Python function calculates review intervals; the
LLM does not decide when a card returns. The scheduler is a documented MVP policy,
not a claim to implement FSRS or SM-2.

**Release verification:** the local smoke command returned `skipped` because no
`GEMINI_API_KEY` was configured. Live API connectivity, provider parameters, and
real generated content are **NOT VERIFIED for PR #6**. The regression suite uses
mocked external inference. Add actual live results only after running the smoke
with a valid key; do not convert mocked results into an inference claim.

## Architecture

- Next.js handles the UI and allowlisted same-origin API proxies.
- FastAPI handles cookie authentication, CSRF, user ownership, articles, and reviews.
- PostgreSQL stores users, extracted articles, cards, processing leases/budgets,
  schedules, and review logs. Alembic owns schema changes.
- Celery consumes an independent Redis-compatible broker; production configuration
  targets Render Key Value / Valkey, with PostgreSQL-based recovery after lost jobs.
- Hosted Gemma runs outside the request and database transaction paths.
- Render configuration describes web, API, worker, PostgreSQL, and broker resources;
  this release does not provision or deploy them.

## Biggest technical challenges

Expand these into the author's own account of the implementation before publishing:

1. Fetching public HTML while defending against SSRF, DNS/redirect surprises, large
   responses, slow servers, and parser resource exhaustion.
2. Recovering interrupted jobs without duplicate cards or resetting reviewed cards.
3. Keeping a review update and its history entry atomic, while handling concurrent
   submissions and a lost HTTP acknowledgment through stable idempotency keys.
4. Keeping answers out of the initial question payload, preserving focus and mobile
   readability, and displaying honest progress and upcoming review dates.
5. Keeping cookie/CSRF semantics consistent across a same-origin frontend proxy and
   separate backend, without exposing private connection URLs to browser code.

## Working demo

**Not deployed. No public demo URL yet.**

For now, use the README's local setup. The browser suite exercises actual local
PostgreSQL, Redis, Celery, API, and web processes with deterministic extraction and
AI fixtures. That verifies integration behavior, not live provider output or
Render production health. Replace this section only after the deployed HTTPS
release flow passes.

## GitHub repository

[itsdevcode/recallloop](https://github.com/itsdevcode/recallloop)

MIT-licensed application code. Gemma is the AI component; review its model terms
and the hosted provider's terms separately from this repository's MIT license.

## Screenshots

See the README screenshot section for actual local browser captures. These show
the product UI, not a hosted production deployment. Do not use a mockup as proof
that a deployed system or live inference worked.

## Lessons learned

Suggested points to personalize with the author's experience:

- Retrieval and evidence checks matter as much as generating fluent questions.
- Durable job state belongs in the database when queue delivery can fail.
- Idempotency is a user-experience feature: retries should not become extra reviews.
- Timezone boundaries and zero states are product decisions that need explicit tests.
- A credible launch report separates local tests, live inference, and deployment.

Before publishing: add the verified demo URL, live inference result, operator
privacy details, personal lessons, and any event-required disclosures. Do not
publish this outline automatically.
