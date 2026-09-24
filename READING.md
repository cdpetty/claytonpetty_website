# Daily reading page

The reading page follows 63 publishing sources extracted from the **Reading v2** bookmark folder, plus 33 additional verified public newsletter feeds identified from the work-inbox inventory. Import AI appears in both inventories and is tracked once. Personal documents, CRM links, search results, tools, dashboards, social profiles, and event pages are excluded. Duplicate sites are consolidated, retaining their categories. The original bookmark export is not included in this repository.

## Collection

`reading/sources.json` contains the source list and ranking topics. Run `python3 scripts/update_reading.py` to refresh `reading/data.json`. No packages, API keys, or paid services are required.

The collector uses advertised RSS/Atom feeds or probes common feed paths. It checks sites without feeds for visible page changes. The first successful check establishes a baseline; subsequent changes appear as **page updates**, not confirmed new articles. JavaScript-only sites, blocked sites, and inaccessible pages may fail; the page shows their status and retains older collected items. Page watches can flag navigation changes and other noise.

Rankings use title keyword matches plus recency. They are transparent heuristics, not full-text AI judgments. Feed items retain publisher dates where available. Undated items are marked first seen. Items age out after 60 days. Titles are rendered as text, not HTML. The interface shows article links and publication names without read/save controls.

## Publishing and daily schedule

The workflow in `.github/workflows/reading.yml` refreshes at approximately **14:23 UTC daily** (7:23 a.m. Pacific daylight time / 6:23 a.m. Pacific standard time), on pushes to `main`, and on manual runs. GitHub scheduled runs can be delayed; public repository schedules may be disabled after inactivity.

Before activation, set repository **Settings → Pages → Build and deployment → Source → GitHub Actions**. The current site uses legacy publishing from `main`; this setting must change when activating the workflow. Preserve the existing `CNAME`. The workflow commits collection state, then publishes only the homepage, headshot, CNAME, and reading page assets. It needs permission to push collection updates to `main`; branch protection may require a separate state-storage design.

Run `python3 -m unittest discover -s tests` before publishing. Preview with `python3 -m http.server 8000` and visit `/reading/`.

## Inbox integration is pending

This collector handles public blog and newsletter feeds. The work-inbox inventory was used only to discover public publication feeds; email data is not published. Newly subscribed newsletters are not automatically discovered. Personal-inbox discovery remains pending. Gmail access through the assistant does not provide credentials to GitHub Actions. Daily email ingestion needs separate authorization and a chosen private/public publishing design. No email messages, inbox addresses, message IDs, access tokens, or paid newsletter text are included in this site.

## Topic organization

Articles are grouped into AI & infrastructure, Startups & venture, Security, Finance & markets, China & geopolitics, Building & engineering, Science & progress, and Essays & ideas. Title-based rules choose one topic, falling back to the source category; page changes appear under Site updates. Topics appear in a responsive card grid: three columns on wide screens, two on medium screens, and one on phones. Each card retains priority order and shows three articles, with Previous/Next controls to browse without expanding the page. Search applies across sections. Source diagnostics are tucked into a collapsed footer. Topic rules live in `reading/reading.js`.

## Compact daily view

The grid defaults to today in America/Los_Angeles and shows every collected, dated article for the selected day, ordered by priority inside topics. A date picker, day arrows, and Today button navigate the archive. No article pagination, ranks, explanations, or read/save controls are shown. Undated items and page changes are excluded rather than represented as newly published. Desktop uses up to four compact columns; phones use readable 13px links in a single column and larger date/search controls. Source failures remain available in the collapsed Sources footer.

## Stars

A small star on each article saves a snapshot of its title, link, publication, and date in browser localStorage. The Starred toggle shows saved articles across all dates, including ones that age out of the 60-day feed. Stars are private to this browser, do not sync across devices, and are lost if site storage is cleared. Storage failures show a visible warning. No read-status controls or ranking explanations are displayed.
