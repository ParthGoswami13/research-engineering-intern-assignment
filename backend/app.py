"""
app.py - Flask backend for NarrativeTrace.

REST API serving precomputed ML results + live semantic search + GenAI summaries.
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from data_loader import load_dataframe, get_dataset_summary
from embeddings import generate_embeddings, load_embeddings, generate_2d_projection, semantic_search
from clustering import get_cluster_data
from network import get_network_data
from summarizer import get_genai_summary, get_suggested_queries

app = Flask(__name__)
CORS(app, origins=['*'])  # Updated to specific origin for production

# Global state (loaded at startup)
df = None
embeddings_cache = None
embeddings_2d_cache = None
network_cache = None


def _safe_text(value, max_len=None):
    """Return a safe string from mixed/NaN dataframe values."""
    if value is None or pd.isna(value):
        text = ''
    elif isinstance(value, str):
        text = value
    else:
        text = str(value)

    return text[:max_len] if max_len is not None else text


def _safe_int(value, default=0):
    """Convert dataframe numeric values to int with NaN fallback."""
    if value is None or pd.isna(value):
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def initialize():
    """Load data and precompute ML results at startup."""
    global df, embeddings_cache, embeddings_2d_cache, network_cache
    
    print("=" * 60)
    print("NarrativeTrace - Initializing...")
    print("=" * 60)
    
    # Step 1: Load and clean data
    print("\n[1/4] Loading dataset...")
    df = load_dataframe()
    print(f"  Dataset: {len(df)} posts")
    
    # Step 2: Generate embeddings
    print("\n[2/4] Loading/generating embeddings...")
    texts = df['clean_text'].tolist()
    embeddings_cache = generate_embeddings(texts)
    print(f"  Embeddings shape: {embeddings_cache.shape}")
    
    # Step 3: Generate 2D projections
    print("\n[3/4] Loading/generating 2D projections...")
    embeddings_2d_cache = generate_2d_projection(embeddings_cache, method='pca')
    print(f"  2D projections shape: {embeddings_2d_cache.shape}")
    
    # Step 4: Build network
    print("\n[4/4] Building network graph...")
    network_cache = get_network_data(df)
    print(f"  Network: {network_cache['stats']['num_nodes']} nodes, "
          f"{network_cache['stats']['num_edges']} edges")
    
    print("\n" + "=" * 60)
    print("NarrativeTrace - Ready!")
    print("=" * 60)


# ============================================================
# API Endpoints
# ============================================================

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'posts_loaded': len(df) if df is not None else 0,
        'embeddings_loaded': embeddings_cache is not None,
    })


@app.route('/api/overview', methods=['GET'])
def overview():
    """
    Dataset overview stats.
    Returns: total posts, date range, top subreddits, top authors, etc.
    """
    if df is None:
        return jsonify({'error': 'Data not loaded'}), 503
    
    summary = get_dataset_summary(df)
    return jsonify(summary)


@app.route('/api/timeseries', methods=['GET'])
def timeseries():
    """
    Time-series post counts with optional granularity.
    Query params:
        - granularity: 'daily', 'weekly', 'monthly' (default: 'daily')
        - subreddit: filter by subreddit (optional)
    """
    if df is None:
        return jsonify({'error': 'Data not loaded'}), 503
    
    granularity = request.args.get('granularity', 'daily')
    subreddit = request.args.get('subreddit', None)
    
    filtered = df.copy()
    if subreddit:
        filtered = filtered[filtered['subreddit'] == subreddit]
    
    filtered['date'] = pd.to_datetime(filtered['created_date'])
    
    if granularity == 'weekly':
        filtered['period'] = filtered['date'].dt.to_period('W').dt.start_time
    elif granularity == 'monthly':
        filtered['period'] = filtered['date'].dt.to_period('M').dt.start_time
    else:  # daily
        filtered['period'] = filtered['date']
    
    # Aggregate counts
    ts = filtered.groupby('period').agg(
        count=('id', 'count'),
        avg_score=('score', 'mean'),
        total_comments=('num_comments', 'sum')
    ).reset_index()
    
    ts['period'] = ts['period'].dt.strftime('%Y-%m-%d')
    
    # Per-subreddit breakdown
    sub_ts = filtered.groupby(['period', 'subreddit']).size().reset_index(name='count')
    sub_ts['period'] = sub_ts['period'].dt.strftime('%Y-%m-%d')
    
    # Detect spikes (2x rolling average)
    counts = ts['count'].values
    if len(counts) > 3:
        rolling_avg = pd.Series(counts).rolling(window=7, min_periods=1).mean().values
        spikes = []
        for i, (c, avg) in enumerate(zip(counts, rolling_avg)):
            if c > avg * 2 and c > 10:
                # Get dominant subreddit for this period
                period = ts.iloc[i]['period']
                period_posts = filtered[filtered['period'].dt.strftime('%Y-%m-%d') == period]
                dominant_sub = period_posts['subreddit'].mode().iloc[0] if len(period_posts) > 0 else ''
                spikes.append({
                    'date': period,
                    'count': int(c),
                    'avg': round(float(avg), 1),
                    'dominant_subreddit': dominant_sub
                })
    else:
        spikes = []
    
    # Find peak
    peak_idx = ts['count'].idxmax() if len(ts) > 0 else None
    peak_date = ts.iloc[peak_idx]['period'] if peak_idx is not None else None
    peak_count = int(ts.iloc[peak_idx]['count']) if peak_idx is not None else 0
    
    result = {
        'timeseries': ts.to_dict(orient='records'),
        'by_subreddit': sub_ts.to_dict(orient='records'),
        'spikes': spikes,
        'peak': {'date': peak_date, 'count': peak_count},
        'granularity': granularity,
        'total_posts': len(filtered)
    }
    
    return jsonify(result)


@app.route('/api/network', methods=['GET'])
def network():
    """
    Network graph data with PageRank and communities.
    Returns: nodes, edges, top influencers, community stats.
    """
    if network_cache is None:
        return jsonify({'error': 'Network not computed'}), 503
    
    return jsonify(network_cache)


@app.route('/api/search', methods=['GET'])
def search():
    """
    Semantic search endpoint.
    Query params:
        - q: search query (required)
        - k: number of results (default: 10)
    """
    if df is None or embeddings_cache is None:
        return jsonify({'error': 'Data not loaded'}), 503
    
    query = request.args.get('q', '').strip()
    top_k = int(request.args.get('k', 10))
    
    # Edge case: empty query
    if not query:
        return jsonify({
            'results': [],
            'query': '',
            'message': 'Type something to search',
            'suggested_queries': []
        })
    
    # Edge case: very short query
    warnings = []
    if len(query.split()) < 3:
        warnings.append('Short queries may have lower accuracy. Try a full phrase for better results.')
    
    # Detect non-English query
    try:
        from langdetect import detect
        lang = detect(query)
        if lang != 'en':
            warnings.append(f'Query detected as {lang}. Results are based on semantic similarity and may still be relevant.')
    except Exception:
        lang = 'en'
    
    # Perform semantic search
    results = semantic_search(query, embeddings_cache, top_k=top_k)
    
    # Build response
    search_results = []
    for idx, score in results:
        row = df.iloc[idx]
        permalink = _safe_text(row.get('permalink'))
        search_results.append({
            'id': _safe_text(row.get('id')),
            'title': _safe_text(row.get('title')),
            'text': _safe_text(row.get('selftext'), 500),
            'clean_text': _safe_text(row.get('clean_text'), 300),
            'author': _safe_text(row.get('author')),
            'subreddit': _safe_text(row.get('subreddit')),
            'score': _safe_int(row.get('score')),
            'created_date': _safe_text(row.get('created_date')),
            'similarity': round(score * 100, 1),  # as percentage
            'permalink': f"https://reddit.com{permalink}" if permalink else '',
        })
    
    # Low confidence warning
    if search_results and search_results[0]['similarity'] < 40:
        warnings.append('Low confidence results. The query may not closely match any posts in the dataset.')
    
    # Generate suggested follow-up queries
    results_context = ', '.join([r['title'][:50] for r in search_results[:3]])
    suggested = get_suggested_queries(query, results_context)
    
    return jsonify({
        'results': search_results,
        'query': query,
        'language': lang if lang != 'en' else None,
        'warnings': warnings,
        'suggested_queries': suggested,
        'total_results': len(search_results)
    })


@app.route('/api/clusters', methods=['GET'])
def clusters():
    """
    Topic clustering with adjustable k.
    Query params:
        - k: number of clusters (default: 5, range: 2-20)
    """
    if df is None or embeddings_cache is None:
        return jsonify({'error': 'Data not loaded'}), 503
    
    k = int(request.args.get('k', 5))
    
    # Validate k
    if k < 2:
        return jsonify({
            'error': 'Minimum 2 clusters required',
            'k': 2
        }), 400
    
    if k > len(df) // 5:
        return jsonify({
            'error': f'Too many clusters for this dataset. Maximum: {len(df) // 5}',
            'k': len(df) // 5
        }), 400
    
    texts = df['clean_text'].tolist()
    result = get_cluster_data(embeddings_cache, texts, k=k)
    
    # Add sample posts per cluster
    for cluster_id, info in result['cluster_info'].items():
        cluster_indices = [i for i, label in enumerate(result['labels']) if label == cluster_id]
        sample_indices = cluster_indices[:3]  # top 3 samples
        info['sample_posts'] = [
            {
                'title': df.iloc[i]['title'],
                'author': df.iloc[i]['author'],
                'subreddit': df.iloc[i]['subreddit'],
                'score': int(df.iloc[i]['score']),
                'created_date': df.iloc[i]['created_date'],
            }
            for i in sample_indices
        ]
    
    return jsonify(result)


@app.route('/api/embeddings', methods=['GET'])
def embeddings_2d():
    """
    2D embedding coordinates for scatter plot visualization.
    Returns: list of {x, y, cluster, subreddit, ...} for each post.
    """
    if df is None or embeddings_2d_cache is None:
        return jsonify({'error': 'Data not loaded'}), 503
    
    # Subsample if too many points
    max_points = int(request.args.get('max', 2000))
    n = len(df)
    
    if n > max_points:
        indices = np.random.RandomState(42).choice(n, max_points, replace=False)
    else:
        indices = np.arange(n)
    
    points = []
    for idx in indices:
        points.append({
            'x': float(embeddings_2d_cache[idx, 0]),
            'y': float(embeddings_2d_cache[idx, 1]),
            'subreddit': df.iloc[idx]['subreddit'],
            'title': df.iloc[idx]['title'][:80],
            'author': df.iloc[idx]['author'],
            'id': df.iloc[idx]['id'],
        })
    
    return jsonify({
        'points': points,
        'total': n,
        'sampled': len(indices)
    })


@app.route('/api/summary', methods=['POST'])
def summary():
    """
    GenAI summary for a chart.
    Body: {chart_type: str, chart_data: dict}
    """
    body = request.get_json()
    if not body:
        return jsonify({'error': 'Request body required'}), 400
    
    chart_type = body.get('chart_type', '')
    chart_data = body.get('chart_data', {})
    
    if not chart_type:
        return jsonify({'error': 'chart_type is required'}), 400
    
    result = get_genai_summary(chart_type, chart_data)
    
    return jsonify({
        'summary': result,
        'chart_type': chart_type,
        'is_ai_generated': bool(os.environ.get('GEMINI_API_KEY'))
    })


@app.route('/api/posts', methods=['GET'])
def get_posts():
    """
    Get posts with filters.
    Query params:
        - subreddit: filter by subreddit
        - date: filter by date
        - limit: max results (default: 20)
        - offset: pagination offset
    """
    if df is None:
        return jsonify({'error': 'Data not loaded'}), 503
    
    subreddit = request.args.get('subreddit', None)
    date = request.args.get('date', None)
    limit = int(request.args.get('limit', 20))
    offset = int(request.args.get('offset', 0))
    
    filtered = df.copy()
    if subreddit:
        filtered = filtered[filtered['subreddit'] == subreddit]
    if date:
        filtered = filtered[filtered['created_date'] == date]
    
    total = len(filtered)
    filtered = filtered.sort_values('score', ascending=False).iloc[offset:offset + limit]
    
    posts = filtered[['id', 'title', 'selftext', 'author', 'subreddit', 
                       'score', 'num_comments', 'created_date', 'domain', 
                       'permalink', 'url']].to_dict(orient='records')
    
    # Ensure selftext is truncated
    for p in posts:
        p['selftext'] = _safe_text(p.get('selftext'), 500)
        permalink = _safe_text(p.get('permalink'))
        p['permalink'] = f"https://reddit.com{permalink}" if permalink else ''
        p['title'] = _safe_text(p.get('title'))
        p['author'] = _safe_text(p.get('author'))
        p['subreddit'] = _safe_text(p.get('subreddit'))
        p['domain'] = _safe_text(p.get('domain'))
        p['url'] = _safe_text(p.get('url'))
        p['created_date'] = _safe_text(p.get('created_date'))
        p['score'] = _safe_int(p.get('score'))
        p['num_comments'] = _safe_int(p.get('num_comments'))
        p['id'] = _safe_text(p.get('id'))
    
    return jsonify({
        'posts': posts,
        'total': total,
        'limit': limit,
        'offset': offset
    })


@app.route('/api/projector/<path:filename>', methods=['GET'])
def get_projector_file(filename):
    """Serve the generated TSV files for TF Projector."""
    projector_dir = os.path.join(os.path.dirname(__file__), '..', 'data', 'projector')
    if not os.path.exists(os.path.join(projector_dir, filename)):
        return jsonify({'error': 'File not found. Please run export_projector.py'}), 404
    return send_from_directory(projector_dir, filename)

# ============================================================
# Main
# ============================================================

if __name__ == '__main__':
    initialize()
    
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'true').lower() == 'true'
    
    print(f"\nStarting server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=debug)
