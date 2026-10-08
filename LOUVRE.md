# Louvre maintenance handoff

Live gallery: https://claytonpetty.com/louvre/
Account: @Cdpetty. Approved design: burgundy Salon with gold frames.

## Current state

- `louvre/index.html`: current static gallery with two verified examples.
- `louvre/collection.json`: seed collection and search checkpoint. Null `last_checked_at` means the historical search has NOT run.
- `louvre/template.html`: Salon template; `<!-- EXHIBITS -->` is the insertion point.
- `scripts/update_louvre.py`: direct X API scaffold, not Grok integration. Searches April 7, 2026 onward on first run, then overlaps one day from the last successful check. Deduplicates by Clayton's post ID and handles pagination. Requires `X_BEARER_TOKEN`; skips without it. API integration has not been exercised with a live credential.
- `.github/workflows/reading.yml`: existing daily 14:23 UTC workflow invokes the Louvre collector, commits collection/page changes, and deploys GitHub Pages. Louvre failures do not block reading updates. Inspect the Louvre step for failures even if the overall deployment succeeds.
- `louvre/previews/index.html`: design comparison, local/reference only, excluded from deployment.
- `tests/test_louvre.py`: offline tests for quote targeting, exact notes, pagination, deduplication, failed responses, escaping, and Pacific dates.

## Requested Grokbot work

Implement reliable automated discovery and publishing using the access available to Grokbot. Choose and document the actual supported authentication and scheduling mechanism; do not assume Grok chat access includes API access. Replace/adapt the direct X collector if using Grok X Search. Keep credentials in GitHub Actions secrets, never browser JavaScript or public files. Do not purchase access without the owner's approval.

Backfill @Cdpetty nominations from April 7, 2026 through October 7, 2026 (Pacific dates), then catch up to the current date and run daily. Search Louvre and @MuseeLouvre mentions, including quote posts and replies that clearly nominate another post. Do not import unrelated Louvre discussion, likes, or every repost. Verify exact text, authorship, timestamps, and source IDs against actual posts. Never invent a post or infer that an LLM search is exhaustive. Report coverage limitations and ambiguous candidates rather than auto-publishing them.

Use Clayton's exact authored text as the curator note, omitting only the quote attachment URL. Embed the immediately quoted post, or the relevant replied-to post, so X can display that post's own quoted content. Preserve the two examples and their targets:

- Clayton 2107687246040379478 -> SleeperHQ 2099223648343085487
- Clayton 2106057832529535358 -> AB84 2105831116464886238

Keep older exhibits permanently, deduplicate by Clayton's post ID, and show newest first. Preserve existing entries and the checkpoint on failed/incomplete searches. Validate and escape external text. If updating state and HTML, stage both writes safely before publishing. Keep the reading collector, homepage, and static GitHub Pages deployment working. Do not change the approved Salon design. Avoid em dashes in new copy.

Run `python3 -m unittest discover -s tests`. Verify desktop/mobile embeds and curator notes, perform one real backfill and one incremental run, then confirm the daily deployment works. Report required setup and any incomplete backfill honestly.
