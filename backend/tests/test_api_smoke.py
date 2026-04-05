import os
import sys
import types
import unittest
from unittest.mock import patch

import numpy as np
import pandas as pd

# Avoid heavy startup preload during test import
os.environ['FLASK_SKIP_INIT'] = 'true'

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import app as backend_app
import platform_search
from network import get_network_data


def _build_sample_df(num_rows=15):
    authors = ['alice', 'bob', 'charlie', 'dana', 'erin', 'frank']
    subreddits = ['politics', 'Conservative', 'Liberal']
    domains = ['example.com', 'news.com', 'policy.org']

    rows = []
    for i in range(num_rows):
        author = authors[i % len(authors)]
        source_author = authors[(i + 1) % len(authors)] if i % 4 == 0 else None
        subreddit = subreddits[i % len(subreddits)]
        domain = domains[i % len(domains)]

        rows.append({
            'id': f'id_{i}',
            'name': f't3_id_{i}',
            'title': f'Post {i} about policy and public narratives',
            'selftext': f'This is sample content {i} about debate and social issues.',
            'full_text': f'Post {i} about policy and public narratives. This is sample content {i} about debate and social issues.',
            'clean_text': f'policy debate social issue narrative sample {i}',
            'author': author,
            'subreddit': subreddit,
            'score': 10 + i,
            'upvote_ratio': 0.8,
            'num_comments': 2 + (i % 5),
            'created_utc': 1735689600 + (i * 86400),
            'created_date': f'2025-01-{(i % 10) + 1:02d}',
            'created_datetime': f'2025-01-{(i % 10) + 1:02d} 12:00:00',
            'domain': domain,
            'url': f'https://{domain}/story/{i}',
            'permalink': f'/r/{subreddit}/comments/{i}',
            'is_self': False,
            'over_18': False,
            'crosspost_parent': None,
            'crosspost_from_sub': subreddit if source_author else None,
            'crosspost_from_author': source_author,
            'num_crossposts': 0,
        })

    return pd.DataFrame(rows)


class ApiSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._orig_df = backend_app.df
        cls._orig_embeddings = backend_app.embeddings_cache
        cls._orig_embeddings_2d = backend_app.embeddings_2d_cache
        cls._orig_network_cache = backend_app.network_cache
        cls._orig_init_error = backend_app.initialization_error
        cls._orig_ensure_initialized = backend_app.ensure_initialized
        cls._orig_semantic_search = backend_app.semantic_search
        cls._orig_platform_semantic_search = platform_search.semantic_search
        cls._orig_platform_encode_query = platform_search.encode_query

        sample_df = _build_sample_df()
        rng = np.random.RandomState(42)

        embeddings = rng.rand(len(sample_df), 384).astype(np.float32)
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        embeddings = embeddings / np.clip(norms, 1e-9, None)

        embeddings_2d = rng.rand(len(sample_df), 2).astype(np.float32)

        backend_app.df = sample_df
        backend_app.embeddings_cache = embeddings
        backend_app.embeddings_2d_cache = embeddings_2d
        backend_app.network_cache = get_network_data(sample_df, max_nodes=200)
        backend_app.initialization_error = None
        backend_app.ensure_initialized = lambda: True

        def fake_semantic_search(query, corpus_embeddings, top_k=10, **_kwargs):
            ranked = [(0, 0.91), (1, 0.84), (2, 0.77), (3, 0.65)]
            return ranked[:max(1, min(top_k, len(ranked)))]

        backend_app.semantic_search = fake_semantic_search
        platform_search.semantic_search = fake_semantic_search
        platform_search.encode_query = lambda _query: embeddings[0]

        cls.client = backend_app.app.test_client()
        cls.sample_df = sample_df

    @classmethod
    def tearDownClass(cls):
        backend_app.df = cls._orig_df
        backend_app.embeddings_cache = cls._orig_embeddings
        backend_app.embeddings_2d_cache = cls._orig_embeddings_2d
        backend_app.network_cache = cls._orig_network_cache
        backend_app.initialization_error = cls._orig_init_error
        backend_app.ensure_initialized = cls._orig_ensure_initialized
        backend_app.semantic_search = cls._orig_semantic_search
        platform_search.semantic_search = cls._orig_platform_semantic_search
        platform_search.encode_query = cls._orig_platform_encode_query

    def test_health_endpoint(self):
        response = self.client.get('/api/health')
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body['status'], 'ok')
        self.assertEqual(body['posts_loaded'], len(self.sample_df))

    def test_timeseries_no_match_filter(self):
        response = self.client.get('/api/timeseries', query_string={'q': 'zzzzzz-unmatched-term'})
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body['total_posts'], 0)
        self.assertEqual(body['timeseries'], [])

    def test_search_empty_query(self):
        response = self.client.get('/api/search', query_string={'q': ''})
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body['results'], [])
        self.assertIn('Type something to search', body['message'])

    def test_search_short_query_warning(self):
        response = self.client.get('/api/search', query_string={'q': 'budget waste'})
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(any('Short queries may have lower accuracy' in warning for warning in body['warnings']))

    def test_search_grouped_by_platform_source(self):
        response = self.client.get('/api/search', query_string={'q': 'policy debate', 'k': 3})
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertIn('grouped_results', body)
        self.assertIn('platforms', body)
        self.assertIn('reddit', body['grouped_results'])
        self.assertIn('external_web', body['grouped_results'])

        # All returned results should be tagged with a platform source.
        self.assertTrue(all('platform_source' in item for item in body['results']))

        for source, items in body['grouped_results'].items():
            self.assertTrue(all(item.get('platform_source') == source for item in items))

    def test_search_non_english_detection(self):
        fake_langdetect = types.SimpleNamespace(detect=lambda _query: 'es')

        with patch.dict(sys.modules, {'langdetect': fake_langdetect}):
            response = self.client.get('/api/search', query_string={'q': 'hola como estas'})
            body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body['language'], 'es')
        self.assertTrue(any('Query detected as es' in warning for warning in body['warnings']))

    def test_cluster_bounds_and_valid_case(self):
        too_small = self.client.get('/api/clusters', query_string={'k': 1})
        too_large = self.client.get('/api/clusters', query_string={'k': 50})
        valid = self.client.get('/api/clusters', query_string={'k': 2})

        self.assertEqual(too_small.status_code, 400)
        self.assertEqual(too_large.status_code, 400)
        self.assertEqual(valid.status_code, 200)
        self.assertEqual(valid.get_json()['k'], 2)

    def test_embeddings_include_row_index(self):
        response = self.client.get('/api/embeddings', query_string={'max': 5})
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(body['points']), 5)
        self.assertTrue(all('row_index' in point for point in body['points']))

    def test_network_stress_test_removes_nodes(self):
        response = self.client.get('/api/network', query_string={'remove_top_n': 1})
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(body['stats']['removed_nodes']), 1)
        self.assertGreaterEqual(body['stats']['num_components'], 1)

    def test_dashboard_payload_contains_evidence_sections(self):
        response = self.client.get('/api/dashboard')
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertIn('summary', body)
        self.assertIn('community_spread', body)
        self.assertIn('weekly_activity', body)
        self.assertIn('weekly_activity_summary', body)
        self.assertIn('platform_momentum', body)
        self.assertIn('dataset_rhythm', body)
        self.assertIn('turn_signals', body)
        self.assertIn('topics', body)
        self.assertIn('network_health', body)
        self.assertIn('evidence', body)
        self.assertIn('platform_momentum', body['evidence'])
        self.assertIn('dataset_rhythm', body['evidence'])
        self.assertIn('turn_signals', body['evidence'])

    def test_summary_endpoint(self):
        response = self.client.post('/api/summary', json={
            'chart_type': 'time_series',
            'chart_data': {
                'total_posts': 15,
                'peak_date': '2025-01-05',
                'peak_count': 4,
                'num_spikes': 1,
            },
        })
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(isinstance(body['summary'], str) and len(body['summary']) > 0)


if __name__ == '__main__':
    unittest.main()
