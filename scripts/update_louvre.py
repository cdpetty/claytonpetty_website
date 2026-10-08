"""Collect public Louvre nominations from X and render the static Salon."""
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
START = '2026-04-07T07:00:00Z'  # April 7 midnight in Pacific time
QUERY = 'from:Cdpetty (louvre OR @MuseeLouvre) -is:retweet'


def get_json(url, token):
    request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token})
    with urllib.request.urlopen(request, timeout=40) as response:
        return json.load(response)


def nomination(post):
    text = post.get('note_tweet', {}).get('text') or post['text']
    if not re.search(r'louvre', text, re.I):
        return None
    refs = post.get('referenced_tweets', [])
    target = next((r['id'] for r in refs if r['type'] == 'quoted'), None)
    if not target:
        target = next((r['id'] for r in refs if r['type'] == 'replied_to'), post['id'])
    entities = post.get('note_tweet', {}).get('entities') or post.get('entities', {})
    for link in entities.get('urls', []):
        expanded = link.get('expanded_url', link['url'])
        # The quoted-post URL belongs to the exhibit, not the curator's words.
        if re.search(r'/status/' + re.escape(target) + r'(?:[/?#]|$)', expanded):
            text = text.replace(link['url'], '')
        else:
            text = text.replace(link['url'], expanded)
    return {'id': post['id'], 'target_id': target,
            'note': html.unescape(text.strip()), 'created_at': post['created_at']}


def collect(state, token, now):
    # Overlap one day to tolerate indexing delays; IDs deduplicate the results.
    start = START
    if state.get('last_checked_at'):
        start = max(START, (datetime.fromisoformat(state['last_checked_at'].replace('Z', '+00:00'))
                           - timedelta(days=1)).isoformat().replace('+00:00', 'Z'))
    end = (now - timedelta(seconds=30)).isoformat().replace('+00:00', 'Z')
    params = {'query': QUERY, 'start_time': start, 'end_time': end,
              'max_results': '100', 'tweet.fields': 'created_at,referenced_tweets,entities,note_tweet'}
    entries = {p['id']: p for p in state['entries']}
    seen_tokens = set()
    for _ in range(10):
        result = get_json('https://api.x.com/2/tweets/search/all?' + urllib.parse.urlencode(params), token)
        if result.get('errors'):
            raise RuntimeError('X returned an incomplete search response; collection preserved.')
        for post in result.get('data', []):
            entry = nomination(post)
            if entry:
                entries[entry['id']] = entry
        next_token = result.get('meta', {}).get('next_token')
        if not next_token:
            return {**state, 'last_checked_at': end,
                    'entries': sorted(entries.values(), key=lambda p: int(p['id']))}
        if next_token in seen_tokens:
            raise RuntimeError('Repeated X pagination token; collection preserved.')
        seen_tokens.add(next_token)
        params['next_token'] = next_token
    raise RuntimeError('Search exceeded ten pages; collection preserved. Narrow the time range before retrying.')


def render(state):
    cards = []
    entries = sorted(state['entries'], key=lambda p: int(p['id']))
    for number, post in reversed(list(enumerate(entries, 1))):
        if not post['id'].isdigit() or not post['target_id'].isdigit():
            raise ValueError('Invalid post ID')
        date = datetime.fromisoformat(post['created_at'].replace('Z', '+00:00')).astimezone(ZoneInfo('America/Los_Angeles'))
        display_date = date.strftime('%B ') + str(date.day) + date.strftime(', %Y')
        target = 'https://x.com/i/status/' + post['target_id']
        own = 'https://x.com/Cdpetty/status/' + post['id']
        cards.append(f'''<article><div class="frame"><blockquote class="twitter-tweet" data-dnt="true" data-conversation="none"><a href="{target}">View exhibited post on X</a></blockquote></div>
<div class="plaque"><div class="meta">CP.{date.year}.{number:03d}</div><h2>Curator’s note</h2><div class="meta">Acquired · {display_date}</div><p class="note">{html.escape(post['note'])}</p><a target="_blank" rel="noopener noreferrer" href="{own}">View my post ↗</a></div></article>''')
    template = (ROOT / 'louvre/template.html').read_text()
    return template.replace('<!-- EXHIBITS -->', '\n'.join(cards))


def main():
    token = os.environ.get('X_BEARER_TOKEN')
    if not token:
        print('Louvre collection skipped: X_BEARER_TOKEN is not configured. Existing gallery preserved.')
        return
    path = ROOT / 'louvre/collection.json'
    state = collect(json.loads(path.read_text()), token, datetime.now(timezone.utc))
    page = render(state)  # Validate/render before writing either output.
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n')
    (ROOT / 'louvre/index.html').write_text(page)
    print(f"Louvre collection: {len(state['entries'])} exhibits; search completed.")


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Do not log request headers, tokens, or response payloads.
        print(f'Louvre refresh failed ({type(error).__name__}); existing collection preserved.', file=sys.stderr)
        sys.exit(1)
