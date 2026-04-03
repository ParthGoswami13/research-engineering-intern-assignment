"""Quick summary of the dataset for NarrativeTrace planning."""
import json
from collections import Counter
from datetime import datetime
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parents[1] / "data.jsonl"

records = []
with open(DATA_PATH, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            records.append(json.loads(line.strip()))
        except:
            continue

print(f"TOTAL RECORDS: {len(records)}")

# Subreddits
subs = Counter(r['data'].get('subreddit','') for r in records)
print(f"\nUNIQUE SUBREDDITS: {len(subs)}")
print("TOP 15:")
for s, c in subs.most_common(15):
    print(f"  {s}: {c}")

# Authors
authors = Counter(r['data'].get('author','') for r in records)
print(f"\nUNIQUE AUTHORS: {len(authors)}")

# Timestamps
ts_list = [r['data']['created_utc'] for r in records if r['data'].get('created_utc')]
mn, mx = min(ts_list), max(ts_list)
print(f"\nDATE RANGE:")
print(f"  {datetime.utcfromtimestamp(mn)} to {datetime.utcfromtimestamp(mx)}")
print(f"  Span: {(mx-mn)/86400:.0f} days")

# Crossposts
cp = sum(1 for r in records if r['data'].get('crosspost_parent'))
cpl = sum(1 for r in records if r['data'].get('crosspost_parent_list'))
print(f"\nNETWORK DATA:")
print(f"  Posts with crosspost_parent: {cp}")
print(f"  Posts with crosspost_parent_list: {cpl}")

# Content
has_self = sum(1 for r in records if len(r['data'].get('selftext','').strip()) > 10)
has_title = sum(1 for r in records if len(r['data'].get('title','').strip()) > 0)
print(f"\nCONTENT:")
print(f"  Posts with title: {has_title}")
print(f"  Posts with selftext (>10 chars): {has_self}")

# Score stats
scores = [r['data'].get('score', 0) for r in records]
print(f"\nSCORES: min={min(scores)}, max={max(scores)}, avg={sum(scores)/len(scores):.0f}")

# Domains
domains = Counter(r['data'].get('domain','') for r in records)
print(f"\nTOP 15 DOMAINS:")
for d, c in domains.most_common(15):
    print(f"  {d}: {c}")
