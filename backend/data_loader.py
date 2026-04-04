"""
data_loader.py - Load and clean the Reddit JSONL dataset for NarrativeTrace.

Handles:
- Loading raw JSONL with nested Reddit structure
- Text cleaning (removing URLs, normalizing whitespace)
- Timestamp normalization
- Creating a clean DataFrame for analysis
"""

import json
import re
import os
import pandas as pd
from datetime import datetime, timezone


DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data.jsonl')
PROCESSED_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'processed', 'cleaned_posts.csv')


def clean_text(text):
    """
    Clean post text for embedding/analysis:
    - Remove URLs
    - Remove HTML entities
    - Remove Reddit markdown artifacts
    - Strip @mentions and u/ references
    - Normalize whitespace
    """
    if not text or not isinstance(text, str):
        return ""
    
    # Remove URLs
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'www\.\S+', '', text)
    
    # Remove HTML entities
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&#\d+;', '', text)
    text = re.sub(r'&\w+;', '', text)
    
    # Remove Reddit markdown
    text = re.sub(r'\[.*?\]\(.*?\)', '', text)  # markdown links
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)  # markdown images
    text = re.sub(r'#{1,6}\s', '', text)  # headers
    text = re.sub(r'\*{1,3}(.*?)\*{1,3}', r'\1', text)  # bold/italic
    text = re.sub(r'~~(.*?)~~', r'\1', text)  # strikethrough
    text = re.sub(r'`{1,3}.*?`{1,3}', '', text, flags=re.DOTALL)  # code blocks
    text = re.sub(r'^>\s.*$', '', text, flags=re.MULTILINE)  # blockquotes
    text = re.sub(r'---+', '', text)  # horizontal rules

    # Remove u/ and r/ references (keep the name)
    text = re.sub(r'u/(\w+)', r'\1', text)
    text = re.sub(r'r/(\w+)', r'\1', text)
    
    # Remove "RT @user:" prefix
    text = re.sub(r'^RT\s+@\w+:\s*', '', text)
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text


def load_raw_data(path=None):
    """Load the raw JSONL file and return list of dicts."""
    if path is None:
        path = DATA_PATH
    
    records = []
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return records


def extract_posts(records):
    """
    Extract relevant fields from raw Reddit JSON into a flat list of dicts.
    Each record has {kind: "t3", data: {...}} structure.
    """
    posts = []
    
    for r in records:
        d = r.get('data', {})
        
        # Combine title and selftext for full text content
        title = d.get('title', '') or ''
        selftext = d.get('selftext', '') or ''
        full_text = f"{title}. {selftext}".strip() if selftext.strip() else title
        
        # Get crosspost source info for network building
        crosspost_parent = d.get('crosspost_parent')
        crosspost_from_sub = None
        crosspost_from_author = None
        if d.get('crosspost_parent_list'):
            cp = d['crosspost_parent_list'][0]
            crosspost_from_sub = cp.get('subreddit')
            crosspost_from_author = cp.get('author')
        
        post = {
            'id': d.get('id', ''),
            'name': d.get('name', ''),
            'title': title,
            'selftext': selftext,
            'full_text': full_text,
            'clean_text': clean_text(full_text),
            'author': d.get('author', ''),
            'subreddit': d.get('subreddit', ''),
            'score': d.get('score', 0),
            'upvote_ratio': d.get('upvote_ratio', 0.0),
            'num_comments': d.get('num_comments', 0),
            'created_utc': d.get('created_utc', 0),
            'created_date': datetime.fromtimestamp(
                d.get('created_utc', 0), tz=timezone.utc
            ).strftime('%Y-%m-%d') if d.get('created_utc') else None,
            'created_datetime': datetime.fromtimestamp(
                d.get('created_utc', 0), tz=timezone.utc
            ).strftime('%Y-%m-%d %H:%M:%S') if d.get('created_utc') else None,
            'domain': d.get('domain', ''),
            'url': d.get('url_overridden_by_dest') or d.get('url', ''),
            'permalink': d.get('permalink', ''),
            'is_self': d.get('is_self', False),
            'over_18': d.get('over_18', False),
            'crosspost_parent': crosspost_parent,
            'crosspost_from_sub': crosspost_from_sub,
            'crosspost_from_author': crosspost_from_author,
            'num_crossposts': d.get('num_crossposts', 0),
        }
        
        posts.append(post)
    
    return posts


def load_dataframe(path=None, use_cache=True):
    """
    Load dataset and return a clean DataFrame.
    Caches to CSV for faster subsequent loads.
    """
    if use_cache and os.path.exists(PROCESSED_PATH):
        print(f"Loading cached data from {PROCESSED_PATH}")
        return pd.read_csv(PROCESSED_PATH)
    
    print("Loading raw data...")
    records = load_raw_data(path)
    print(f"Loaded {len(records)} raw records")
    
    print("Extracting and cleaning posts...")
    posts = extract_posts(records)
    df = pd.DataFrame(posts)
    
    # Drop posts with no meaningful text (<10 chars after cleaning)
    original_count = len(df)
    df = df[df['clean_text'].str.len() >= 10].reset_index(drop=True)
    print(f"Dropped {original_count - len(df)} posts with <10 char clean text")
    print(f"Final dataset: {len(df)} posts")
    
    # Save processed data
    os.makedirs(os.path.dirname(PROCESSED_PATH), exist_ok=True)
    df.to_csv(PROCESSED_PATH, index=False)
    print(f"Saved processed data to {PROCESSED_PATH}")
    
    return df


def get_dataset_summary(df):
    """Return a summary dict of the dataset for the overview endpoint."""
    return {
        'total_posts': len(df),
        'unique_authors': df['author'].nunique(),
        'unique_subreddits': df['subreddit'].nunique(),
        'subreddits': df['subreddit'].unique().tolist(),
        'date_range': {
            'start': df['created_date'].min(),
            'end': df['created_date'].max(),
            'span_days': (pd.to_datetime(df['created_date'].max()) - 
                         pd.to_datetime(df['created_date'].min())).days
        },
        'total_score': int(df['score'].sum()),
        'avg_score': round(df['score'].mean(), 1),
        'total_comments': int(df['num_comments'].sum()),
        'top_subreddits': df['subreddit'].value_counts().head(10).to_dict(),
        'top_authors': df['author'].value_counts().head(10).to_dict(),
        'top_domains': df['domain'].value_counts().head(10).to_dict(),
        'posts_with_text': int((df['selftext'].str.len() > 10).sum()),
        'crossposts': int(df['crosspost_parent'].notna().sum()),
    }


if __name__ == '__main__':
    df = load_dataframe(use_cache=False)
    print(f"\nDataset shape: {df.shape}")
    print(f"\nColumns: {list(df.columns)}")
    summary = get_dataset_summary(df)
    print(f"\nSummary:")
    for k, v in summary.items():
        print(f"  {k}: {v}")
