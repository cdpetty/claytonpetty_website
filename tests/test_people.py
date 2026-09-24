import json
from pathlib import Path
import unittest
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]

class PeopleTests(unittest.TestCase):
    def test_profile_evidence_and_unambiguous_source_matching(self):
        directory = json.loads((ROOT / 'reading/people.json').read_text())
        sources = {s['url'] for s in json.loads((ROOT / 'reading/sources.json').read_text())['sources']}
        matches = set()
        for person in directory['profiles']:
            self.assertTrue(person['name'])
            self.assertTrue(person['evidence_urls'])
            self.assertTrue(person['source_urls'])
            self.assertTrue(any(person.get(k) for k in ('website', 'linkedin', 'profile')))
            for key in ('website', 'linkedin', 'profile'):
                if person.get(key):
                    parsed = urlsplit(person[key])
                    self.assertIn(parsed.scheme, ('http', 'https'))
                    self.assertTrue(parsed.netloc)
                    self.assertIsNone(parsed.username)
            for source in person['source_urls']:
                self.assertIn(source, sources)
                for name in [person['name']] + person.get('aliases', []):
                    key = (source, name.lower().replace('’', "'").replace('‘', "'").strip())
                    self.assertNotIn(key, matches, 'Ambiguous author match')
                    matches.add(key)
        self.assertEqual({s['url'] for s in directory['reviewed_sources']}, sources)
