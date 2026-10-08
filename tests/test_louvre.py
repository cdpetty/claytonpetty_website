import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('louvre', Path(__file__).resolve().parents[1] / 'scripts/update_louvre.py')
louvre = importlib.util.module_from_spec(spec)
spec.loader.exec_module(louvre)

class LouvreTests(unittest.TestCase):
    def test_quote_target_and_exact_note(self):
        post = {'id': '123', 'text': '@MuseeLouvre Louvre. https://t.co/a',
                'created_at': '2026-10-07T04:00:00Z',
                'referenced_tweets': [{'type': 'quoted', 'id': '456'}],
                'entities': {'urls': [{'url': 'https://t.co/a', 'expanded_url': 'https://x.com/person/status/456'}]}}
        entry = louvre.nomination(post)
        self.assertEqual(entry['target_id'], '456')
        self.assertEqual(entry['note'], '@MuseeLouvre Louvre.')
        page = louvre.render({'entries': [entry]})
        self.assertIn('https://x.com/i/status/456', page)
        self.assertIn('October 6, 2026', page)
        self.assertNotIn('<!-- EXHIBITS -->', page)

    def test_pagination_dedup_and_checkpoint(self):
        post = {'id': '123', 'text': 'Louvre.', 'created_at': '2026-10-07T04:00:00Z'}
        state = {'entries': [louvre.nomination(post)], 'last_checked_at': None}
        with patch.object(louvre, 'get_json', side_effect=[{'data': [post], 'meta': {'next_token': 'next'}}, {'meta': {}}]) as fetch:
            result = louvre.collect(state, 'test', datetime(2026, 10, 7, 12, tzinfo=timezone.utc))
        self.assertEqual(len(result['entries']), 1)
        self.assertIsNone(state['last_checked_at'])
        self.assertEqual(result['last_checked_at'], '2026-10-07T11:59:30Z')
        self.assertIn('next_token=next', fetch.call_args_list[1].args[0])

    def test_partial_failure_and_html_escape(self):
        state = {'entries': [], 'last_checked_at': None}
        with patch.object(louvre, 'get_json', return_value={'errors': [{'message': 'partial'}]}):
            with self.assertRaises(RuntimeError):
                louvre.collect(state, 'test', datetime(2026, 10, 7, 12, tzinfo=timezone.utc))
        self.assertEqual(state, {'entries': [], 'last_checked_at': None})
        page = louvre.render({'entries': [{'id': '123', 'target_id': '456', 'created_at': '2026-10-07T04:00:00Z', 'note': '<script>bad</script>'}]})
        self.assertIn('&lt;script&gt;bad&lt;/script&gt;', page)
