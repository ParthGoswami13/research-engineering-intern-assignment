# NarrativeTrace: SimPPL Research Engineering Assignment

Interactive investigative dashboard for analyzing narrative spread across political Reddit communities.

## 1. Project Goal

NarrativeTrace is designed to answer three investigation questions:

1. How does discussion volume change over time for a given narrative query?
2. Which accounts are most central to that narrative's network?
3. How do semantic themes cluster in embedding space, and what happens at clustering extremes?

This implementation combines time-series analysis, semantic retrieval, network centrality, topic clustering, and GenAI summaries in one queryable workflow.

## 2. Public Hosting Proof

Fill these values before final submission:

- Frontend dashboard URL: ADD_PUBLIC_FRONTEND_URL
- Backend API base URL: ADD_PUBLIC_BACKEND_URL
- Backend health check: ADD_PUBLIC_BACKEND_URL/api/health
- Video walkthrough URL (YouTube/Drive): ADD_VIDEO_URL

Submission checklist for this section:

- [ ] Frontend URL opens without authentication
- [ ] Backend health endpoint returns status JSON
- [ ] Frontend can query backend in deployed environment
- [ ] Video walkthrough link is public

## 3. Screenshots

Add final screenshots before submission:

1. Overview page
2. Trend Analysis with query filter + GenAI summary
3. Network Analysis with node-removal stress test
4. Semantic Search results with warnings/suggestions
5. Topic Explorer with cluster slider and embedding scatter

## 4. Architecture

- Frontend: React + Vite + Framer Motion + Recharts + D3
- Backend: Flask REST API
- Data: Reddit JSONL processed into clean tabular format
- ML/NLP: sentence-transformers embeddings + KMeans topic clustering
- Network: NetworkX PageRank + Louvain communities
- GenAI: Gemini for chart summaries and suggested follow-up queries

Flow:

1. Load and clean Reddit dataset
2. Generate/load sentence embeddings
3. Build time-series, network, cluster outputs
4. Serve query-aware APIs
5. Render interactive visualizations with dynamic AI summaries

## 5. Local Setup

### Backend

From repository root:

```bash
pip install -r requirements.txt
cd backend
python app.py
```

Backend default URL: http://localhost:5000

Optional environment variables:

- GEMINI_API_KEY: enables Gemini-generated summaries
- PORT: backend port override
- FLASK_DEBUG: true/false
- FLASK_SKIP_INIT: true to skip startup preload
- CORS_ORIGINS: comma-separated allowed frontend origins (for deployed environments)

### Frontend

From repository root:

```bash
cd frontend
npm install
npm run dev
```

Frontend default URL: http://localhost:5173

If backend is deployed elsewhere, set:

```bash
VITE_API_URL=https://your-backend-domain
```

### Run API smoke tests

From repository root:

```bash
python -m unittest backend.tests.test_api_smoke
```

This suite checks rubric-critical edge cases for search, clustering bounds, network stress tests, embedding payload integrity, and summary endpoint behavior.

## 6. Feature Walkthrough

### Overview

- Dataset summary statistics (posts, authors, subreddits, domains)
- AI insight panel for non-technical narrative summary

### Trend Analysis

- Time-series visualization by daily/weekly/monthly granularity
- Query-aware filtering for keyword/phrase/URL
- Automatic GenAI plain-language summary beneath chart
- Spike detection and top-post drill-down for spike dates

### Network Analysis

- Query-aware interaction network
- PageRank-based influence ranking
- Louvain community detection
- Stress-test control: remove top N central nodes (0-5)
- Component count and disconnected-graph-safe behavior

### Semantic Search

- Embedding similarity ranking (not keyword exact match)
- Unified multi-platform abstraction with grouped results by source (Reddit + External Web links)
- Handles empty query, short query warnings, non-English detection
- Suggested follow-up exploratory queries

### Topic Explorer

- KMeans topic clustering with tunable K (2-20)
- Cluster cards with keyword labels and sample posts
- 2D embedding scatter plot
- TensorFlow Projector export/download links using environment-aware API URLs

## 7. Required Semantic Search Examples (Zero Keyword Overlap)

The assignment requires examples where the query and correct result have zero keyword overlap.

### Example 1

- Query: public funds mismanaged by officials
- Returned result: 9 Surefire Ways Bureaucrats Can Hide Fraudulent Spending From DOGE
- Why correct: The result discusses hidden/fraudulent government spending, which is semantically equivalent to mismanaged public funds despite no direct keyword overlap.

### Example 2

- Query: civilian displacement across national boundaries
- Returned result: Indigenous people being stopped from traversing through their continent and Native homeland because of a militarized border that fascist foreign Anglo invaders created
- Why correct: The post addresses border restrictions and forced movement constraints, matching the displacement-across-borders concept without shared query keywords.

### Example 3

- Query: authoritarian limits on free expression
- Returned result: Why some people turn to authoritarianism in the name of freedom
- Why correct: The result connects authoritarian politics and freedom discourse, which aligns with constraints on expression at the concept level, not lexical overlap.

## 8. ML/AI Components (Model, Key Params, Library/API)

### Embedding Model

- Model: sentence-transformers/all-MiniLM-L6-v2
- Key params: 384-dimensional normalized embeddings, batch_size=64
- Library/API: sentence_transformers.SentenceTransformer.encode

### Semantic Ranking

- Algorithm: cosine similarity on normalized vectors
- Key params: top_k retrieval (default 10)
- Library/API: numpy.dot + numpy.argsort

### Topic Clustering

- Algorithm: KMeans clustering
- Key params: n_clusters=k (user-controlled 2-20), random_state=42, n_init=10, max_iter=300
- Library/API: sklearn.cluster.KMeans.fit_predict

### Cluster Labeling

- Algorithm: TF-IDF top-term extraction per cluster
- Key params: max_features=100, stop_words=english, max_df=0.9
- Library/API: sklearn.feature_extraction.text.TfidfVectorizer

### Network Influence + Communities

- Algorithms: PageRank centrality + Louvain community detection
- Key params: PageRank alpha=0.85, weighted edges
- Library/API: networkx.pagerank + python-louvain best_partition (or networkx louvain fallback)

### Embedding Visualization

- Algorithm: PCA projection to 2D
- Key params: n_components=2, random_state=42
- Library/API: sklearn.decomposition.PCA.fit_transform

### GenAI Summarization

- Model: gemini-2.5-flash (summaries), gemini-2.0-flash (follow-up query suggestions)
- Key params: chart_type and chart_data-driven prompt
- Library/API: google.generativeai.GenerativeModel.generate_content

## 9. Edge-Case Handling

### Semantic Search

- Empty query returns safe empty response and guidance message
- Very short query triggers low-confidence warning
- Non-English input is detected and handled without crash

### Clustering

- Rejects k < 2
- Rejects excessive k relative to dataset size
- Embedding scatter uses stable row_index mapping to preserve cluster label correctness under subsampling

### Network

- Handles disconnected components and reports component breakdown
- Handles small/insufficient graphs gracefully
- Supports stress-test by removing top PageRank nodes

## 10. Rubric Mapping

| Rubric Requirement | Where Implemented |
| --- | --- |
| Documentation + usage | This README |
| Public hosting proof | Section 2 (fill URLs before submit) |
| Time-series visualization | Trend Analysis page + /api/timeseries |
| Network visualization + centrality | Network Analysis page + /api/network + PageRank/Louvain |
| Dynamic GenAI summary under time-series | Trend Analysis auto summary + /api/summary |
| Semantic relevance ranking | /api/search + embedding similarity |
| Multi-platform grouped search sources | /api/search grouped_results + platforms |
| Empty/short/non-English handling | /api/search safeguards |
| Suggested follow-up queries | Search UI + backend suggestions |
| Topic clustering with tunable K | Topic Explorer + /api/clusters |
| Embedding visualization + projector link | Topic Explorer + /api/embeddings + /api/projector/* |
| ML/AI declaration lines | Section 8 |

## 11. Known Limitations

- Additional platforms currently use adapter abstractions over the same core dataset; no separate live API ingestion yet
- Offline real-world event overlays are not yet integrated
- Public URLs and video link must be filled before submission

## 12. AI Usage Log File

AI-assisted development log is included in:

- parth-prompts.md

Log format:

- Numbered prompts with component, prompt text, and one-line fix notes
