"""
dashboard_insights.py - Build fast, cached dashboard evidence payloads.

This module consolidates multiple dataset analyses into one response so the
frontend can render rich dashboard insights with a single backend call.
"""

import numpy as np
import pandas as pd

from clustering import get_cluster_data
from data_loader import get_dataset_summary
from summarizer import get_genai_summary


def _weekly_frame(df):
    """Return weekly aggregated post activity with stable ordering."""
    frame = df.copy()
    frame['date'] = pd.to_datetime(frame['created_date'], errors='coerce')
    frame = frame.dropna(subset=['date'])
    if frame.empty:
        return frame, pd.DataFrame()

    frame['week'] = frame['date'].dt.to_period('W').dt.start_time

    weekly = (
        frame.groupby('week')
        .agg(
            posts=('id', 'count'),
            active_authors=('author', 'nunique'),
            avg_score=('score', 'mean'),
        )
        .reset_index()
        .sort_values('week')
    )

    return frame, weekly


def _build_community_spread(df):
    """Build community spread metrics for top subreddits."""
    if df.empty:
        return []

    grouped = (
        df.groupby('subreddit')
        .agg(
            posts=('id', 'count'),
            avg_score=('score', 'mean'),
            avg_comments=('num_comments', 'mean'),
        )
        .reset_index()
        .sort_values('posts', ascending=False)
    )

    total_posts = max(len(df), 1)
    spread = []
    for _, row in grouped.head(12).iterrows():
        spread.append({
            'subreddit': str(row['subreddit']),
            'posts': int(row['posts']),
            'share_pct': round(float(row['posts']) / total_posts * 100, 2),
            'avg_score': round(float(row['avg_score']), 2),
            'avg_comments': round(float(row['avg_comments']), 2),
        })

    return spread


def _build_weekly_activity(weekly):
    """Serialize weekly trend data for charting."""
    activity = []
    for _, row in weekly.tail(24).iterrows():
        activity.append({
            'week': row['week'].strftime('%Y-%m-%d'),
            'posts': int(row['posts']),
            'active_authors': int(row['active_authors']),
            'avg_score': round(float(row['avg_score']), 2),
        })
    return activity


def _build_weekly_activity_summary(weekly_activity):
    """Generate a plain-language summary for the weekly activity time-series."""
    if not weekly_activity:
        return 'No weekly activity data available yet.'

    peak = max(weekly_activity, key=lambda item: item['posts'])
    chart_data = {
        'total_posts': int(sum(item['posts'] for item in weekly_activity)),
        'peak_date': peak['week'],
        'peak_count': int(peak['posts']),
        'num_spikes': 0,
        'granularity': 'weekly',
        'timeseries': weekly_activity[-12:],
    }

    try:
        return get_genai_summary('time_series', chart_data)
    except Exception:
        return (
            f"Weekly volume peaks at {peak['posts']} posts on {peak['week']}, "
            'with activity varying across recent weeks.'
        )


def _build_platform_momentum(frame):
    """Compute recent vs previous window momentum by community."""
    if frame.empty:
        return []

    latest_week = frame['week'].max()
    recent_start = latest_week - pd.Timedelta(weeks=3)
    previous_start = latest_week - pd.Timedelta(weeks=7)

    community_week = (
        frame.groupby(['subreddit', 'week'])
        .size()
        .reset_index(name='posts')
    )

    recent = (
        community_week[community_week['week'] >= recent_start]
        .groupby('subreddit')['posts']
        .sum()
    )

    previous = (
        community_week[
            (community_week['week'] >= previous_start)
            & (community_week['week'] < recent_start)
        ]
        .groupby('subreddit')['posts']
        .sum()
    )

    communities = sorted(set(recent.index).union(set(previous.index)))
    total_recent = max(int(recent.sum()), 1)

    momentum = []
    for subreddit in communities:
        recent_posts = int(recent.get(subreddit, 0))
        previous_posts = int(previous.get(subreddit, 0))
        delta_posts = recent_posts - previous_posts
        delta_pct = ((delta_posts / previous_posts) * 100) if previous_posts > 0 else (100.0 if recent_posts > 0 else 0.0)

        if delta_posts > 0:
            trend = 'up'
        elif delta_posts < 0:
            trend = 'down'
        else:
            trend = 'flat'

        momentum.append({
            'subreddit': str(subreddit),
            'recent_posts': recent_posts,
            'previous_posts': previous_posts,
            'delta_posts': int(delta_posts),
            'delta_pct': round(float(delta_pct), 1),
            'trend': trend,
            'recent_share_pct': round(recent_posts / total_recent * 100, 2),
        })

    momentum.sort(key=lambda item: (abs(item['delta_posts']), item['recent_posts']), reverse=True)
    return momentum[:10]


def _build_dataset_rhythm(weekly):
    """Build cadence metrics that describe posting rhythm over time."""
    if weekly.empty:
        return {
            'avg_posts_per_week': 0,
            'median_posts_per_week': 0,
            'volatility_pct': 0,
            'recent_2w_change_pct': 0,
            'cadence': 'stable',
            'last_week_posts': 0,
            'previous_week_posts': 0,
        }

    counts = weekly['posts'].astype(float)
    avg_posts = float(counts.mean())
    median_posts = float(counts.median())
    volatility_pct = (float(counts.std(ddof=0)) / avg_posts * 100) if avg_posts > 0 else 0.0

    last_week_posts = int(counts.iloc[-1])
    previous_week_posts = int(counts.iloc[-2]) if len(counts) > 1 else int(counts.iloc[-1])

    if len(counts) >= 4:
        recent_2w = float(counts.iloc[-2:].sum())
        previous_2w = float(counts.iloc[-4:-2].sum())
    elif len(counts) >= 2:
        recent_2w = float(counts.iloc[-2:].sum())
        previous_2w = float(counts.iloc[:-2].sum())
    else:
        recent_2w = float(counts.iloc[-1])
        previous_2w = float(counts.iloc[-1])

    if previous_2w > 0:
        recent_2w_change_pct = (recent_2w - previous_2w) / previous_2w * 100
    else:
        recent_2w_change_pct = 0.0

    if volatility_pct >= 55:
        cadence = 'bursty'
    elif volatility_pct >= 30:
        cadence = 'variable'
    else:
        cadence = 'steady'

    return {
        'avg_posts_per_week': round(avg_posts, 1),
        'median_posts_per_week': round(median_posts, 1),
        'volatility_pct': round(volatility_pct, 1),
        'recent_2w_change_pct': round(recent_2w_change_pct, 1),
        'cadence': cadence,
        'last_week_posts': last_week_posts,
        'previous_week_posts': previous_week_posts,
    }


def _build_turn_signals(weekly):
    """Detect weeks where momentum significantly changed direction."""
    if weekly.empty or len(weekly) < 2:
        return []

    signals = []
    for i in range(1, len(weekly)):
        previous_posts = int(weekly.iloc[i - 1]['posts'])
        current_posts = int(weekly.iloc[i]['posts'])

        if previous_posts <= 0:
            continue

        delta_posts = current_posts - previous_posts
        change_pct = (delta_posts / previous_posts) * 100

        if abs(change_pct) >= 35 and abs(delta_posts) >= 10:
            signal = 'surge' if delta_posts > 0 else 'drop'
            signals.append({
                'week': weekly.iloc[i]['week'].strftime('%Y-%m-%d'),
                'signal': signal,
                'delta_posts': int(delta_posts),
                'change_pct': round(change_pct, 1),
                'posts': int(current_posts),
            })

    if not signals:
        # Keep one best-effort turn signal so the panel always has evidence.
        deltas = []
        for i in range(1, len(weekly)):
            previous_posts = int(weekly.iloc[i - 1]['posts'])
            current_posts = int(weekly.iloc[i]['posts'])
            delta_posts = current_posts - previous_posts
            change_pct = (delta_posts / previous_posts * 100) if previous_posts > 0 else 0.0
            deltas.append((abs(change_pct), i, delta_posts, change_pct, current_posts))

        if deltas:
            _, idx, delta_posts, change_pct, current_posts = max(deltas, key=lambda item: item[0])
            signals.append({
                'week': weekly.iloc[idx]['week'].strftime('%Y-%m-%d'),
                'signal': 'surge' if delta_posts >= 0 else 'drop',
                'delta_posts': int(delta_posts),
                'change_pct': round(float(change_pct), 1),
                'posts': int(current_posts),
            })

    return signals[-6:]


def _build_topics(df, embeddings, default_k=6):
    """Build topic-cluster evidence with representative narrative signals."""
    if df.empty:
        return {'k': 0, 'distribution': [], 'warnings': []}

    max_k = max(2, min(10, len(df) // 5))
    k = min(max(2, int(default_k)), max_k)

    texts = df['clean_text'].fillna('').astype(str).tolist()
    result = get_cluster_data(embeddings, texts, k=k)

    labels = np.array(result['labels'], dtype=int)
    distribution = []

    for cluster_id, info in result['cluster_info'].items():
        cid = int(cluster_id)
        count = int(info.get('count', int((labels == cid).sum())))
        indices = np.flatnonzero(labels == cid)[:2]

        representative_signals = [
            str(df.iloc[idx].get('title', ''))[:120]
            for idx in indices
        ]

        distribution.append({
            'cluster_id': cid,
            'label': str(info.get('label', f'Cluster {cid}')),
            'keywords': [str(kword) for kword in info.get('keywords', [])[:4]],
            'count': count,
            'share_pct': round((count / len(df)) * 100, 2),
            'representative_signals': representative_signals,
        })

    distribution.sort(key=lambda item: item['count'], reverse=True)

    return {
        'k': int(result.get('k', k)),
        'distribution': distribution,
        'warnings': result.get('warnings', []),
    }


def _build_network_health(network_cache):
    """Build structural network insights for dashboard consumption."""
    stats = network_cache.get('stats', {}) if isinstance(network_cache, dict) else {}
    pagerank = network_cache.get('pagerank', {}) if isinstance(network_cache, dict) else {}
    top_nodes = network_cache.get('top_influencers', []) if isinstance(network_cache, dict) else []

    num_nodes = int(stats.get('num_nodes', 0))
    num_edges = int(stats.get('num_edges', 0))
    num_components = int(stats.get('num_components', 0))
    num_communities = int(stats.get('num_communities', 0))
    components = stats.get('components', [])

    density = (num_edges / (num_nodes * (num_nodes - 1))) if num_nodes > 1 else 0.0

    largest_component_size = int(components[0]['size']) if components else 0
    largest_component_share = (largest_component_size / num_nodes * 100) if num_nodes > 0 else 0.0

    top_ids = [item.get('id') for item in top_nodes[:5]]
    top5_pagerank_share = 0.0
    if pagerank:
        top5_pagerank_share = sum(float(pagerank.get(node_id, 0.0)) for node_id in top_ids) * 100

    if num_components > 6 and largest_component_share < 55:
        structure = 'fragmented'
    elif density < 0.02:
        structure = 'sparse'
    else:
        structure = 'connected'

    top_influencers = [
        {
            'id': str(node.get('id', '')),
            'pagerank': round(float(node.get('pagerank', 0.0)), 6),
            'community': int(node.get('community', 0)),
        }
        for node in top_nodes[:5]
    ]

    return {
        'num_nodes': num_nodes,
        'num_edges': num_edges,
        'num_components': num_components,
        'num_communities': num_communities,
        'density': round(float(density), 4),
        'largest_component_share_pct': round(float(largest_component_share), 2),
        'top5_pagerank_share_pct': round(float(top5_pagerank_share), 2),
        'structure': structure,
        'components': components[:5],
        'top_influencers': top_influencers,
    }


def _build_evidence(momentum, rhythm, turn_signals):
    """Build concise evidence cards expected by the dashboard."""
    if momentum:
        lead = momentum[0]
        direction_word = 'accelerated' if lead['delta_posts'] >= 0 else 'cooled'
        platform_summary = (
            f"r/{lead['subreddit']} {direction_word} by {abs(lead['delta_posts'])} posts "
            f"vs prior window ({lead['delta_pct']}%)."
        )
    else:
        platform_summary = 'No momentum signal available yet.'

    rhythm_summary = (
        f"Cadence is {rhythm['cadence']} with {rhythm['avg_posts_per_week']} posts/week on average "
        f"and {rhythm['volatility_pct']}% volatility."
    )

    if turn_signals:
        latest_signal = turn_signals[-1]
        turn_summary = (
            f"{len(turn_signals)} turn signal(s) detected. Latest week {latest_signal['week']} "
            f"showed a {latest_signal['signal']} of {latest_signal['change_pct']}%."
        )
    else:
        turn_summary = 'No major directional turns detected in the current window.'

    return {
        'platform_momentum': {
            'title': 'Platform Momentum',
            'summary': platform_summary,
        },
        'dataset_rhythm': {
            'title': 'Dataset Rhythm',
            'summary': rhythm_summary,
        },
        'turn_signals': {
            'title': 'Turn Signals',
            'summary': turn_summary,
        },
    }


def build_dashboard_payload(df, embeddings, network_cache, default_k=6):
    """Build a complete dashboard payload from the dataset and model caches."""
    frame, weekly = _weekly_frame(df)

    summary = get_dataset_summary(df)
    community_spread = _build_community_spread(df)
    weekly_activity = _build_weekly_activity(weekly)
    weekly_activity_summary = _build_weekly_activity_summary(weekly_activity)
    momentum = _build_platform_momentum(frame) if not frame.empty else []
    rhythm = _build_dataset_rhythm(weekly)
    turn_signals = _build_turn_signals(weekly)
    topics = _build_topics(df, embeddings, default_k=default_k)
    network_health = _build_network_health(network_cache)
    evidence = _build_evidence(momentum, rhythm, turn_signals)

    return {
        'generated_at': pd.Timestamp.now(tz='UTC').isoformat(),
        'summary': summary,
        'community_spread': community_spread,
        'weekly_activity': weekly_activity,
        'weekly_activity_summary': weekly_activity_summary,
        'platform_momentum': momentum,
        'dataset_rhythm': rhythm,
        'turn_signals': turn_signals,
        'topics': topics,
        'network_health': network_health,
        'evidence': evidence,
    }
