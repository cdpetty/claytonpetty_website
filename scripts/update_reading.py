"""Collect public feeds and monitor feedless blogs. Python standard library only."""
import concurrent.futures
import hashlib
import gzip
import json
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit, parse_qsl, urlencode
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NOW = datetime.now(timezone.utc)
STAMP = NOW.isoformat()


def clean(text):
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", text or ""))).strip()


def canonical(url):
    p = urlsplit(url)
    if p.scheme not in ("http", "https") or not p.netloc:
        return None
    query = [(k, v) for k, v in parse_qsl(p.query) if not k.startswith("utm_") and k not in ("fbclid", "gclid")]
    return urlunsplit((p.scheme, p.netloc.lower(), p.path or "/", urlencode(query), ""))


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "ClaytonReading/1.0 (+https://claytonpetty.com/)", "Accept": "application/atom+xml, application/rss+xml, text/html, */*"})
    with urllib.request.urlopen(req, timeout=12) as response:
        body = response.read(3_000_001)
        if len(body) > 3_000_000:
            raise ValueError("Response too large")
        if body.startswith(b"\x1f\x8b"):
            import io
            with gzip.GzipFile(fileobj=io.BytesIO(body)) as archive:
                body = archive.read(3_000_001)
            if len(body) > 3_000_000: raise ValueError("Response too large")
        return body, response.geturl()


class Page(HTMLParser):
    def __init__(self, base):
        super().__init__(); self.base = base; self.feeds = []; self.text = []; self.links = {}; self.skip = 0; self.anchor = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("script", "style", "noscript"):
            self.skip += 1
        if tag == "link" and a.get("type", "").split(";")[0] in ("application/rss+xml", "application/atom+xml"):
            url = canonical(urljoin(self.base, a.get("href", "")))
            if url: self.feeds.append(url)
        if tag == "a": self.anchor = [urljoin(self.base, a.get("href", "")), []]

    def handle_data(self, data):
        if not self.skip:
            self.text.append(data)
            if self.anchor: self.anchor[1].append(data)

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript"):
            self.skip = max(0, self.skip - 1)
        if tag == "a" and self.anchor:
            url, chunks = self.anchor; self.anchor = None
            url = canonical(url); title = clean(" ".join(chunks))
            if url and title and urlsplit(url).netloc == urlsplit(self.base).netloc:
                self.links[url] = title


def date(text):
    try:
        value = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        try: value = parsedate_to_datetime(text)
        except (ValueError, TypeError, AttributeError): return None
    if value.tzinfo is None: value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def parse_feed(body, base):
    # Do not process external entities or DTDs in third-party feeds.
    if b"<!DOCTYPE" in body.upper() or b"<!ENTITY" in body.upper(): raise ValueError("Unsafe XML")
    root = ET.fromstring(body)
    local = lambda tag: tag.split("}")[-1]
    if local(root.tag) not in ("rss", "feed", "RDF"): raise ValueError("Not an RSS/Atom feed")
    items = []
    def authors(parent):
        names = []
        for child in parent:
            if local(child.tag) not in ("author", "creator"): continue
            nested = [clean(n.text) for n in child if local(n.tag) == "name"]
            raw = ", ".join(nested) if nested else clean(child.text)
            # RSS author fields sometimes contain an email address; publish names only.
            name = re.sub(r"[^\s<>()]+@[^\s<>()]+", "", raw).strip(" <>()")
            if name and name not in names: names.append(name)
        return ", ".join(names) or None
    feed_author = authors(root) if local(root.tag) == "feed" else None
    for node in root.iter():
        if local(node.tag) not in ("item", "entry"): continue
        fields = {}; link = None
        for child in node:
            key = local(child.tag)
            fields[key] = "".join(child.itertext())
            if key == "link":
                if child.get("href") and child.get("rel", "alternate") == "alternate": link = child.get("href")
                elif child.text and child.text.strip(): link = child.text.strip()
        url = canonical(urljoin(base, link or fields.get("guid", "")))
        title = clean(fields.get("title", ""))
        if not url or not title or not (link or fields.get("guid")): continue
        items.append({"url": url, "title": title, "author": authors(node) or feed_author, "published_at": date(fields.get("pubDate") or fields.get("published") or fields.get("updated") or fields.get("date")), "kind": "article"})
    return items


def rank(item, topics):
    matched = [name for name, terms in topics.items() if any(re.search(r"(?<!\w)" + re.escape(t) + r"(?!\w)", item["title"], re.I) for t in terms)]
    when = date(item.get("published_at") or item.get("first_seen_at"))
    age = max(0, (NOW - datetime.fromisoformat(when)).total_seconds() / 86400) if when else 60
    freshness = max(0, 20 - age) if item.get("published_at") else 0
    item["score"] = round(min(100, 25 * len(matched) + freshness), 1)
    item["why"] = "; ".join(matched) if matched else "From a followed source"
    if not item.get("published_at"): item["why"] += "; publication date unknown"
    if item["kind"] == "page_change": item["why"] = "Page content changed; may not be a new article"
    return item


class ApolloArticles(HTMLParser):
    """Read public article metadata from Apollo's Daily Spark listing."""
    def __init__(self, base):
        super().__init__(); self.base = base; self.items = {}

    def handle_starttag(self, tag, attrs):
        raw = dict(attrs).get("data-itemdetails")
        if not raw: return
        try:
            data = json.loads(raw)
            url = canonical(urljoin(self.base, data.get("detailLink", "")))
            title = clean(data.get("title"))
            # The publisher supplies a date only. Noon Pacific preserves that day
            # in the site's Pacific calendar without claiming an exact publish time.
            day = datetime.strptime(data.get("blogDate", ""), "%Y-%m-%d")
            from zoneinfo import ZoneInfo
            published = day.replace(hour=12, tzinfo=ZoneInfo("America/Los_Angeles")).astimezone(timezone.utc).isoformat()
            if url and title and urlsplit(url).netloc == urlsplit(self.base).netloc and "/daily-spark/" in url:
                author = data.get("aboutTheAuthor") or {}
                name = clean(" ".join(filter(None, [author.get("firstName"), author.get("lastName")])))
                self.items[url] = {"url": url, "title": title, "author": name or None, "published_at": published, "kind": "article"}
        except (ValueError, TypeError): pass


def allowed(item, source):
    pattern = source.get("exclude_title_pattern")
    return not pattern or not re.search(pattern, item["title"], re.I)


def check(source, previous):
    old = previous or {}; state = dict(old)
    state.update(name=source["name"], url=source["url"], categories=source["categories"], checked_at=STAMP)
    if source.get("adapter") == "apollo":
        try:
            body, final = fetch(source["url"])
            parser = ApolloArticles(final); parser.feed(body.decode("utf-8"))
            if not parser.items: raise ValueError("No dated articles found")
            state.update(status="feed", last_success_at=STAMP, error=None)
            return state, list(parser.items.values())
        except Exception as exc:
            state.update(status="error", error=type(exc).__name__)
            return state, []
    candidates = [source.get("feed_url"), old.get("feed_url")]
    page = None; error = None
    for feed in dict.fromkeys(filter(None, candidates)):
        try:
            body, final = fetch(feed); items = parse_feed(body, final)
            state.update(status="feed", feed_url=final, last_success_at=STAMP, error=None)
            return state, items
        except Exception as exc: error = type(exc).__name__
    try:
        body, final = fetch(source["url"])
        page = Page(final); page.feed(body.decode("utf-8", errors="replace"))
    except Exception as exc: error = type(exc).__name__
    # Probe once; repeat discovery weekly for feedless/failed sites.
    discovered = date(old.get("discovered_at"))
    if not discovered or NOW - datetime.fromisoformat(discovered) > timedelta(days=7):
        base = source["url"].rstrip("/") + "/"
        candidates = (page.feeds if page else []) + [urljoin(base, path) for path in ("feed", "index.xml", "feed.xml", "rss.xml", "atom.xml", "rss")]
        for feed in dict.fromkeys(candidates):
            try:
                body, final = fetch(feed); items = parse_feed(body, final)
                state.update(status="feed", feed_url=final, last_success_at=STAMP, discovered_at=STAMP, error=None)
                return state, items
            except Exception: pass
        state["discovered_at"] = STAMP
    if page:
        visible = clean(" ".join(page.text))
        if len(visible) < 80 or any(marker in visible.lower() for marker in ("verify you are human", "enable javascript and cookies to continue", "checking your browser")):
            state.update(status="error", error="Page inaccessible or requires JavaScript")
            return state, []
        fingerprint = hashlib.sha256(visible.encode()).hexdigest()
        changed = old.get("fingerprint") and old["fingerprint"] != fingerprint
        state.update(status="page_watch", fingerprint=fingerprint, last_success_at=STAMP, error=None)
        items = [{"title": source["name"] + " — page updated", "url": source["url"], "published_at": None, "kind": "page_change"}] if changed else []
        return state, items
    state.update(status="error", error=error or "Fetch failed")
    return state, []


def main():
    config = json.loads((ROOT / "reading/sources.json").read_text())
    target = ROOT / "reading/data.json"
    previous = json.loads(target.read_text()) if target.exists() else {}
    prior_sources = {s["url"]: s for s in previous.get("sources", [])}
    prior_items = {i["url"]: i for i in previous.get("items", [])}
    seen = previous.get("first_seen", {url: i["first_seen_at"] for url, i in prior_items.items()})
    active = {s["url"] for s in config["sources"]}
    by_source = {s["url"]: s for s in config["sources"]}
    items = {url: i for url, i in prior_items.items() if i.get("source_url") in active and allowed(i, by_source[i["source_url"]])}
    states = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        futures = [pool.submit(check, source, prior_sources.get(source["url"])) for source in config["sources"]]
        for future in concurrent.futures.as_completed(futures):
            state, entries = future.result(); states.append(state)
            for entry in entries:
                if not allowed(entry, by_source[state["url"]]): continue
                prior = prior_items.get(entry["url"], {})
                entry["author"] = entry.get("author") or prior.get("author")
                first_seen = seen.get(entry["url"], STAMP) if entry["kind"] == "article" else STAMP
                seen[entry["url"]] = first_seen
                entry.update(source=state["name"], source_url=state["url"], categories=state["categories"], first_seen_at=first_seen)
                items[entry["url"]] = entry
    cutoff = (NOW - timedelta(days=config.get("lookback_days", 60))).isoformat()
    fresh = [rank(i, config["ranking_topics"]) for i in items.values() if (i.get("published_at") or i["first_seen_at"]) >= cutoff and (i.get("published_at") or i["first_seen_at"]) <= STAMP]
    fresh.sort(key=lambda i: (-i["score"], i["url"]))
    output = {"updated_at": STAMP, "ranking": "Title topic matches and recency; no AI analysis or full article content.", "first_seen": seen, "sources": sorted(states, key=lambda s: s["name"].lower()), "items": fresh}
    temp = target.with_suffix(".tmp"); temp.write_text(json.dumps(output, indent=2) + "\n"); temp.replace(target)
    counts = {s: sum(x["status"] == s for x in states) for s in ("feed", "page_watch", "error")}
    print(json.dumps({"sources": len(states), "items": len(fresh), **counts}))
    if states and counts["error"] == len(states): raise SystemExit("All sources failed; check network access.")


if __name__ == "__main__": main()
