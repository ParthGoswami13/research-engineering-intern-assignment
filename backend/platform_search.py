"""
platform_search.py - Platform adapters for unified semantic search.

Adds a simple abstraction layer so one query can return grouped
results by platform source.
"""

from dataclasses import dataclass
import os
import re

import numpy as np
import pandas as pd

from embeddings import encode_query, semantic_search


@dataclass
class PlatformMatch:
    source: str
    label: str
    row_index: int
    similarity: float


class PlatformSearchAdapter:
    source = 'unknown'
    label = 'Unknown'

    def search(self, query, frame, embeddings, top_k=10, query_embedding=None):
        raise NotImplementedError


class RedditSearchAdapter(PlatformSearchAdapter):
    source = 'reddit'
    label = 'Reddit'

    def search(self, query, frame, embeddings, top_k=10, query_embedding=None):
        if frame is None or embeddings is None or len(frame) == 0:
            return []

        k = max(1, min(int(top_k), len(frame)))
        ranked = semantic_search(query, embeddings, top_k=k, query_embedding=query_embedding)

        return [
            PlatformMatch(
                source=self.source,
                label=self.label,
                row_index=int(idx),
                similarity=float(score),
            )
            for idx, score in ranked
        ]


class ExternalWebSearchAdapter(PlatformSearchAdapter):
    source = 'external_web'
    label = 'External Web'

    def _candidate_indices(self, frame):
        if frame is None or len(frame) == 0 or 'url' not in frame.columns:
            return []

        url_text = frame['url'].fillna('').astype(str).str.strip().str.lower()
        if 'domain' in frame.columns:
            domain_text = frame['domain'].fillna('').astype(str).str.strip().str.lower()
        else:
            domain_text = pd.Series('', index=frame.index)

        has_http_url = url_text.str.startswith('http')
        not_reddit_url = ~url_text.str.contains('reddit.com', regex=False)
        not_self_domain = ~domain_text.str.startswith('self.')

        valid = has_http_url & not_reddit_url & not_self_domain

        if 'is_self' in frame.columns:
            valid = valid & (~frame['is_self'].fillna(False).astype(bool))

        return np.flatnonzero(valid.to_numpy()).tolist()

    def search(self, query, frame, embeddings, top_k=10, query_embedding=None):
        if frame is None or embeddings is None or len(frame) == 0:
            return []

        candidate_indices = self._candidate_indices(frame)
        if not candidate_indices:
            return []

        subset_embeddings = embeddings[candidate_indices]
        k = max(1, min(int(top_k), len(candidate_indices)))
        ranked_subset = semantic_search(
            query,
            subset_embeddings,
            top_k=k,
            query_embedding=query_embedding,
        )

        results = []
        for local_idx, score in ranked_subset:
            global_idx = candidate_indices[int(local_idx)]
            results.append(
                PlatformMatch(
                    source=self.source,
                    label=self.label,
                    row_index=int(global_idx),
                    similarity=float(score),
                )
            )

        return results


def _tokenize(text):
    return re.findall(r"[a-z0-9']+", str(text).lower())


def _lexical_matches_for_adapter(adapter, query, frame, top_k):
    """Lightweight lexical fallback when embedding query encoding is unavailable."""
    if frame is None or len(frame) == 0:
        return []

    query_tokens = _tokenize(query)
    if not query_tokens:
        return []

    if hasattr(adapter, '_candidate_indices'):
        candidate_indices = adapter._candidate_indices(frame)
    else:
        candidate_indices = list(range(len(frame)))

    if not candidate_indices:
        return []

    query_set = set(query_tokens)
    phrase = ' '.join(query_tokens)
    scored = []

    for idx in candidate_indices:
        row = frame.iloc[int(idx)]
        clean_text = str(row.get('clean_text', '') or '')
        title_text = str(row.get('title', '') or '')
        haystack = f"{title_text} {clean_text}".strip().lower()
        if not haystack:
            continue

        token_set = set(_tokenize(haystack))
        if not token_set:
            continue

        overlap = len(query_set & token_set) / max(1, len(query_set))
        phrase_bonus = 0.2 if phrase and phrase in haystack else 0.0
        score = overlap + phrase_bonus

        if score > 0:
            scored.append((int(idx), float(score)))

    if not scored:
        return []

    scored.sort(key=lambda item: item[1], reverse=True)
    top_scored = scored[: max(1, int(top_k))]
    max_score = max(item[1] for item in top_scored) or 1.0

    results = []
    for row_index, raw_score in top_scored:
        # Normalize into [0, 1] range used by downstream serializer.
        similarity = min(0.99, max(0.01, raw_score / max_score))
        results.append(
            PlatformMatch(
                source=adapter.source,
                label=adapter.label,
                row_index=row_index,
                similarity=similarity,
            )
        )

    return results


def run_unified_platform_search(query, frame, embeddings, top_k=10, adapters=None):
    """Run semantic search across all platform adapters."""
    active_adapters = adapters or [RedditSearchAdapter(), ExternalWebSearchAdapter()]
    per_platform_k = max(1, int(top_k))
    force_lexical = os.environ.get('SEARCH_FORCE_LEXICAL', 'false').strip().lower() == 'true'
    query_embedding = None

    if not force_lexical:
        try:
            query_embedding = encode_query(query)
        except Exception as exc:
            print(f"Query encoder unavailable; using lexical fallback: {exc}")
            force_lexical = True

    grouped = {}
    combined = []
    platforms = []

    for adapter in active_adapters:
        if force_lexical:
            matches = _lexical_matches_for_adapter(adapter, query, frame, per_platform_k)
        else:
            matches = adapter.search(
                query,
                frame,
                embeddings,
                top_k=per_platform_k,
                query_embedding=query_embedding,
            )
        grouped[adapter.source] = matches
        combined.extend(matches)
        platforms.append({
            'source': adapter.source,
            'label': adapter.label,
            'count': len(matches),
        })

    combined.sort(key=lambda item: item.similarity, reverse=True)

    return {
        'grouped': grouped,
        'combined': combined,
        'platforms': platforms,
    }
