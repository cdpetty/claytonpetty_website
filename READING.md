# Daily reading page

The directory follows 183 sources discovered from Reading v2 bookmarks and newsletter inventories. The September 2026 expansion added 100 sources and removed 12 overview/event feeds. Historical delivery demonstrates a subscription or past interest, not necessarily a currently paid subscription.

## Discovery and editorial policy

Discovery covered two years of personal newsletter mail, targeted newsletter labels, and additional older Substack/Beehiiv/Ghost senders. It is a broad inventory, not a guarantee that every subscription was found. New subscriptions are not automatically discovered by the daily job.

Keep original analysis and author-led reporting, including Matt Levine's Money Stuff, Torsten Slok's Daily Spark, Stratechery, The Diff, Platformer, Net Interest, and OnlyCFO. Exclude general headline digests such as Morning Brew, Finimize Daily, The Neuron, Forward Future, Crunchbase Daily, CyberWire Daily, StrictlyVC, and Substack platform recommendations. Event calendars, job lists, product promotions, and account messages are not reading sources. Authentication codes or invitations to write are not evidence of a subscription.

Removed from the earlier inventory: Bay Area Founders Club, JJLake, AI+ Community, Ben's Bites, AMP/The AI Exchange, TechWalk, Stealth Startup Spy, gm NYC, Cryptonite Weekly Rap, FounderCoHo, Early Stage Founders/poach.vc, and NYC B2B. Specialist publications with substantial original commentary remain even if they occasionally publish link collections. Latent.Space's AINews section and explicitly titled market/dividend roundups in My Weekly Stock and MaxDividends are filtered out.

Read Max now points to Patreon; its obsolete Substack feed is not presented as current. Some publications, including Garbage Day and Pari Passu, currently have no verified working article feed here. They remain in Following with their actual page-watch or failed-check status. A page watch does not supply dated daily articles. Inaccessible sources are retried, and their older collected articles are retained.

## Collection and storage

`reading/sources.json` contains public source URLs, categories, optional feed URLs and title exclusions. Run `python3 scripts/update_reading.py` to refresh `reading/data.json`. The collector uses public RSS/Atom feeds and a public listing adapter for Apollo's Daily Spark. Apollo supplies calendar dates only, represented at noon Pacific to preserve the publisher's date in the daily view.

Feedless sites are checked for visible page changes. An initial check establishes a baseline; later changes are page updates, not confirmed articles. Blocked and JavaScript-only pages may fail. The daily view excludes undated items and page updates.

The collector retains article links for 60 days, deduplicates URLs, and ranks using title keywords and recency. There is no global article-count cutoff, so expanding sources cannot silently drop a day's lower-ranked articles. Rankings are heuristics, not full-text AI analysis.

Only public titles, links, publication dates and source metadata are published. Email bodies, inbox addresses, message IDs, personalized email links, access tokens, and paid article text are not included. Gmail access through the assistant does not give GitHub Actions email credentials.

## Daily publishing

GitHub Pages uses the Actions workflow in `.github/workflows/reading.yml`. It refreshes at 14:23 UTC daily (7:23 a.m. Pacific daylight / 6:23 a.m. standard time), on pushes to main, and on manual runs. Schedules can be delayed or disabled by GitHub after repository inactivity. The workflow commits collection state and deploys only homepage assets and reading HTML/JS/data, preserving CNAME.

Run `python3 -m unittest discover -s tests` before publishing. Preview with `python3 -m http.server 8000` and visit `/reading/`.

## Interface

The daily view uses America/Los_Angeles dates, a date picker, search, and compact topic cards in up to four desktop columns and one phone column. All collected articles for the selected day are displayed. Following opens a searchable, alphabetical source directory grouped by topic and shows article-feed, page-watch or failed-check status.

Stars save article snapshots in this browser's localStorage, including articles that later age out of the feed. They do not sync across devices and are lost if site data is cleared. Storage failures show a warning.


## Substack profile reconciliation

Reviewed all 92 publications displayed on https://substack.com/@cdpetty/reads on September 23, 2026. After matching custom domains, renamed publications and platform migrations, 86 are represented by tracked sources and six are intentionally excluded: Agentic AI Weekly, Company Launch Tracker, Golden Gate Recruits, next play, The Substack Post, and Rachel Woods’s Newsletter. This is a dated snapshot, not automatic synchronization with the profile.

Added Latent Garage. Its feed currently contains older posts; daily checks will pick up new posts if publishing resumes. Rachel Woods’s Newsletter was subsequently removed at user request. Gwern's Substack feed stops in 2021, so retain the current Gwern.net source instead. Platformer, Garbage Day and Read Max retain their newer destinations. Removed Geeks of the Valley's dealflow newsletter and the PulseMCP directory, and replaced Qasar Younis's external Links page with his Writings page. The directory now contains 183 sources. Stealth Startup Spy remains excluded. Original author analysis, research, interviews and essays are retained, even where an author also links to outside reporting. These website changes do not unsubscribe the email or Substack accounts.

Explicit exclusions are recorded in `editorial_exclusions` in sources.json as guidance for future discovery. Only `sources` entries are collected.
