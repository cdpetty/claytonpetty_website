import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('reading', Path(__file__).resolve().parents[1] / 'scripts/update_reading.py')
reading = importlib.util.module_from_spec(spec); spec.loader.exec_module(reading)


class ReadingTests(unittest.TestCase):
    def test_rss_and_tracking_deduplication(self):
        result = reading.parse_feed(b'<rss><channel><item><title>AI &amp; startups</title><link>https://example.com/post?utm_source=email&amp;id=2#top</link><pubDate>Wed, 23 Sep 2026 08:00:00 GMT</pubDate></item></channel></rss>', 'https://example.com/feed')
        self.assertEqual(result[0]['url'], 'https://example.com/post?id=2')
        self.assertEqual(result[0]['published_at'], '2026-09-23T08:00:00+00:00')

    def test_atom_relative_links_and_missing_dates(self):
        result = reading.parse_feed(b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Writing</title><link rel="self" href="/api/post"/><link href="/post"/></entry></feed>', 'https://example.com/feed')
        self.assertEqual(result[0]['url'], 'https://example.com/post')
        self.assertIsNone(result[0]['published_at'])

    def test_untrusted_feed(self):
        with self.assertRaises(ValueError): reading.parse_feed(b'<!DOCTYPE rss><rss/>','https://example.com')
        self.assertIsNone(reading.canonical('javascript:alert(1)'))

    def test_initial_page_is_baseline_then_change_detected(self):
        source={'name':'Test blog','url':'https://example.com/','categories':['AI']}
        page=b'<html><body><p>' + b'An essay about artificial intelligence and building software. ' * 4 + b'</p></body></html>'
        def fake(url):
            if url == source['url']: return page, url
            raise ValueError('No feed')
        with patch.object(reading, 'fetch', side_effect=fake):
            state, items = reading.check(source, {})
            self.assertEqual(state['status'], 'page_watch'); self.assertEqual(items, [])
            _, items = reading.check(source, state); self.assertEqual(items, [])
            page = page.replace(b'An essay', b'A different essay')
            _, items = reading.check(source, state)
            self.assertEqual(items[0]['kind'], 'page_change'); self.assertIsNone(items[0]['published_at'])

    def test_failed_source_retains_last_success(self):
        source={'name':'Test','url':'https://example.com/','categories':[]}
        with patch.object(reading,'fetch',side_effect=OSError()):
            state, items=reading.check(source,{'last_success_at':'2026-01-01T00:00:00+00:00','discovered_at':reading.STAMP})
        self.assertEqual(state['status'],'error'); self.assertEqual(state['last_success_at'],'2026-01-01T00:00:00+00:00'); self.assertEqual(items,[])

    def test_keyword_boundaries(self):
        item={'title':'Paid software','kind':'article','first_seen_at':reading.STAMP}
        self.assertNotIn('AI',reading.rank(item,{'AI':['AI']})['why'])


if __name__ == '__main__': unittest.main()
