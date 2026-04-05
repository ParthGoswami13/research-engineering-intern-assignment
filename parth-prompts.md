# AI Prompt Log (Parth Goswami) - NarrativeTrace

This project made use of AI to expedite planning, boilerplate creation, debugging, and documentation. Final validation, endpoint contracts, integration decisions, and architectural choices were all done by hand. Planning prompts and implementation/debug prompts used during development and deployment are listed below.

This log is organized section-wise and numbered sequentially to match submission requirements.

## Section-Wise AI-Assisted Development Timeline

| Section | Focus | Prompt Range | How AI Helped | What I Corrected Manually |
|---|---|---|---|---|
| A | Project scoping and planning | Prompts 1-5 | Helped draft roadmap and stack options | Reduced scope and aligned to assignment rubric |
| B | Data integration and preprocessing | Prompts 6-8 | Drafted loaders and cleaning rules | Corrected crosspost extraction and safer null handling |
| C | Backend API and system design | Prompts 9-14 | Scaffolded endpoints and cache ideas | Fixed readiness, query filters, stress-test behavior, and CORS strategy |
| D | NLP/ML and retrieval | Prompts 15-21 | Generated embedding/search/clustering drafts | Fixed ranking logic, edge handling, and grouped-source search outputs |
| E | Frontend UX and dashboard flow | Prompts 22-29 | Produced UI skeletons and chart wiring | Removed repetitive panels, fixed layout/interaction regressions |
| F | Testing and debugging | Prompts 30-34 | Suggested checks and fixes | Added smoke tests, resolved lint/deprecation/deployment issues |
| G | Deployment and submission packaging | Prompts 35-36 | Helped with deployment docs and checklist | Validated claims, fixed README gaps, organized artifacts |

---

## A. Project Scoping and Planning

### Prompt 1 - Assignment Understanding
**Component:** Requirement comprehension

**Prompt:** "look i had applied in one company named Simppl and the policy for hiring employees of that company is as par the pdf first you analyze that"

**Issue with output:** Initial analysis was broad and interview-oriented, not implementation-oriented.

**Fix applied:** I converted it into concrete engineering checkpoints mapped to the assignment rubric.

### Prompt 2 - Requirement Extraction
**Component:** Instruction parsing

**Prompt:** "i have attached instruction.md which is full fledge instruction of what they want and the protips.md to make more effective production which off beat simple products"

**Issue with output:** Mandatory and optional requirements were mixed.

**Fix applied:** I split must-have requirements from nice-to-have ideas and prioritized accordingly.

### Prompt 3 - Meta Prompt Generation
**Component:** Planning workflow

**Prompt:** "can you make propt of making .md file of this entire project so that i can give that prompt to another AI and then it will make the .md file and then based on that i will follow that and will generate the code step by step"

**Issue with output:** First draft prompt was too generic to produce actionable output.

**Fix applied:** I constrained deliverables and demanded practical phase-wise tasks.

### Prompt 4 - Stack-Specific Prompt Refinement
**Component:** Prompt optimization

**Prompt:** "make a better version of this prompt that is more specific to your own stack, like React + Flask + Python + NLP + Streamlit-style dashboard, so the AI gives you a plan closer to the code you will actually build."

**Issue with output:** Suggested tooling did not fully match chosen implementation stack.

**Fix applied:** I tightened stack assumptions to React + Flask + sentence-transformers + Recharts/D3 flow.

### Prompt 5 - Complete Project Blueprint
**Component:** End-to-end architecture plan

**Prompt:** "You are an expert full-stack engineer, ML engineer, and product designer... generate PROJECT_PLAN.md with architecture, features, ML plan, phases, deployment, README, video plan, and final checklist."

**Issue with output:** Scope was too wide for realistic project timeline.

**Fix applied:** I narrowed scope to fewer high-quality, robust features aligned with SimPPL expectations.

---

## B. Data Integration and Preprocessing

### Prompt 6 - Dataset Loader
**Component:** data_loader

**Prompt:** "Create a robust Reddit JSONL loader that extracts useful fields, cleans text, normalizes timestamps, and caches cleaned output."

**Issue with output:** Initial extraction missed nested crosspost information.

**Fix applied:** I added crosspost source fields and null-safe parsing for stability.

### Prompt 7 - Text Cleaning Pipeline
**Component:** Preprocessing quality

**Prompt:** "Build cleaning rules for URLs, markdown, HTML entities, and noisy social-media artifacts before embedding generation."

**Issue with output:** First cleaning pass removed too much semantic signal.

**Fix applied:** I balanced cleaning strictness to reduce noise while preserving meaning.

### Prompt 8 - Dataset Summary Metrics
**Component:** Overview analytics

**Prompt:** "Generate overview-ready dataset summary stats (authors, subreddits, scores, domains, date span)."

**Issue with output:** Some aggregations were fragile with missing values.

**Fix applied:** I added safe conversion and NaN-tolerant metric logic.

---

## C. Backend API and System Design

### Prompt 9 - Flask API Scaffold
**Component:** API baseline

**Prompt:** "Build Flask endpoints for overview, timeseries, network, search, clusters, embeddings, posts, and summary for a dashboard."

**Issue with output:** Response schemas were inconsistent across endpoints.

**Fix applied:** I normalized payload shapes and error conventions.

### Prompt 10 - Initialization Reliability
**Component:** Startup logic

**Prompt:** "Make backend startup safe for local and hosted environments with lazy initialization fallback."

**Issue with output:** Hosted-import mode could still surface data-not-loaded behavior.

**Fix applied:** I implemented readiness checks with ensure_initialized and guarded fallbacks.

### Prompt 11 - Query-Aware Time Series
**Component:** timeseries endpoint

**Prompt:** "Add query filtering (q) to timeseries endpoint and return empty-safe payload when nothing matches."

**Issue with output:** Empty filtered results were not communicated clearly.

**Fix applied:** I returned explicit no-match payloads with message and safe defaults.

### Prompt 12 - Network Stress Testing API
**Component:** network endpoint

**Prompt:** "Add query-scoped network endpoint with remove_top_n to simulate removing highly connected/influential nodes."

**Issue with output:** Invalid actor entries could leak into graph operations.

**Fix applied:** I filtered invalid actors and returned removed-node diagnostics for interpretability.

### Prompt 13 - Dashboard Load Optimization
**Component:** consolidated dashboard API

**Prompt:** "Create a consolidated /api/dashboard payload so overview can render from one cached request instead of many calls."

**Issue with output:** Multi-call overview loading caused occasional unavailable panels.

**Fix applied:** I added startup-cached consolidated payload with lazy rebuild fallback.

### Prompt 14 - CORS Hardening
**Component:** deployment security/config

**Prompt:** "Replace wildcard CORS with env-driven allowed origins for local + deployed frontend domains."

**Issue with output:** Wildcard CORS was deployment-fragile and less controlled.

**Fix applied:** I moved to environment-driven origin parsing with explicit allowed origins.

---

## D. NLP/ML Features and Semantic Retrieval

### Prompt 15 - Embedding Generation and Cache
**Component:** embeddings pipeline

**Prompt:** "Generate embeddings with all-MiniLM-L6-v2, cache to disk, and reload if shapes match."

**Issue with output:** Repeated encoding happened when cache checks were weak.

**Fix applied:** I strengthened cache validation and deterministic reload behavior.

### Prompt 16 - Search Runtime Noise and Latency
**Component:** semantic search runtime

**Prompt:** "Reduce Hugging Face warning noise and avoid model reload per query in semantic search."

**Issue with output:** Query-time model loads increased latency and noisy logs.

**Fix applied:** I switched to singleton model loading and runtime logging suppression.

### Prompt 17 - Search Robustness Rules
**Component:** semantic search edge cases

**Prompt:** "Handle empty queries, short queries, and non-English input safely in semantic search API."

**Issue with output:** Early edge responses lacked consistent guidance fields.

**Fix applied:** I added warnings/messages and stable behavior for all tested edge cases.

### Prompt 18 - Suggested Follow-Up Queries
**Component:** search UX enrichment

**Prompt:** "Generate 2-3 related follow-up queries after search results to improve exploration flow."

**Issue with output:** Suggestions were generic and not result-conditioned.

**Fix applied:** I grounded suggestions in current query and top result context.

### Prompt 19 - Topic Clustering Bounds
**Component:** clustering endpoint

**Prompt:** "Implement KMeans clustering with tunable K and hard bounds to prevent incoherent extreme values."

**Issue with output:** Extreme K values could degrade coherence and UI behavior.

**Fix applied:** I enforced backend validation and warning emission for out-of-range requests.

### Prompt 20 - Embedding-Cluster Consistency
**Component:** embeddings + topic explorer integration

**Prompt:** "Ensure sampled embedding points map to correct cluster labels even after subsampling."

**Issue with output:** Cluster labels did not always match sampled points.

**Fix applied:** I added row_index mapping through backend payload and frontend label lookup.

### Prompt 21 - Multi-Source Semantic Search
**Component:** platform adapters

**Prompt:** "Implement platform adapters so one semantic query can return grouped sources (Reddit + external web links)."

**Issue with output:** Flat result lists hid source semantics and reduced clarity.

**Fix applied:** I added grouped results and platform metadata to API and UI.

---

## E. Frontend UX and Dashboard Experience

### Prompt 22 - Overview Redesign
**Component:** overview page

**Prompt:** "Redesign overview to be evidence-first with richer dataset-driven visuals, not repetitive stat blocks."

**Issue with output:** Initial layout was repetitive and low-signal.

**Fix applied:** I implemented evidence cards plus non-overlapping chart roles.

### Prompt 23 - Evidence Card Alignment
**Component:** overview cards

**Prompt:** "Add Platform Momentum, Dataset Rhythm, and Turn Signals as aligned evidence cards in the overview."

**Issue with output:** Card alignment and responsive behavior were uneven.

**Fix applied:** I added dedicated grid CSS and responsive breakpoints.

### Prompt 24 - Trend UX and Dynamic Summary
**Component:** trend analysis page

**Prompt:** "Add query input to trend analysis and make chart summary dynamic for selected filters."

**Issue with output:** Summary flow depended on manual trigger and became stale.

**Fix applied:** I moved to automatic summary refresh on filter/data change.

### Prompt 25 - Network Controls and Flags
**Component:** network page

**Prompt:** "Add query filtering and stress slider UI to network page with clear badges for active filters/removed nodes."

**Issue with output:** Stress and filter states were not visible enough.

**Fix applied:** I added slider controls, filter badges, and removed-node indicators.

### Prompt 26 - Grouped Search UI
**Component:** semantic search page

**Prompt:** "Render semantic results grouped by source platform with per-platform counts and clear sectioning."

**Issue with output:** Flat list presentation reduced interpretability.

**Fix applied:** I grouped output blocks by source with source count badges.

### Prompt 27 - Deployment-Safe Projector Links
**Component:** topic explorer

**Prompt:** "Use environment-aware API URLs for TensorFlow projector files instead of localhost hardcoding."

**Issue with output:** Localhost-only links failed after deployment.

**Fix applied:** I switched links to use environment-aware API URL helper.

### Prompt 28 - Landing Polish and Rhythm Gap Fix
**Component:** overview polish

**Prompt:** "Bring back animated increasing stats and remove empty visual gaps in dataset rhythm evidence card."

**Issue with output:** Redesign had removed count-up feel and left empty space.

**Fix applied:** I restored animated stat counters and added no-data rhythm fallback blocks.

### Prompt 29 - Premium Frontend Redesign (Integration-Safe)
**Component:** frontend enhancement prompt

**Prompt:** "You are a senior React frontend architect, motion designer, and data-visual UX engineer. Redesign the existing React frontend to look premium and highly attractive while preserving all existing backend and ML integration contracts exactly as-is. Do not change API endpoints, request/response shapes, route paths, env variable usage, or data flow. Use Framer Motion for transitions/stagger reveals, GSAP + ScrollTrigger for parallax and scroll choreography, and D3.js interaction layers for advanced cursor events and hover intelligence in plots. Keep all pages and features functional, responsive, and readable. Add smooth parallax, section-wise scroll interactions, animated page transitions, and interactive chart behaviors (hover focus, cursor-follow tooltips, highlight-on-hover). Keep performance optimized (transform/opacity-first animations), respect reduced-motion preferences, and avoid clutter. Deliver updated React components/styles only, with a validation summary showing how backend connectivity and ML-powered features remained intact."

**Issue with output:** Original request emphasized heavy animation but did not explicitly protect integration boundaries.

**Fix applied:** I converted it into a professional, constraint-first prompt with strict API contract protection, readability requirements, and performance/accessibility guardrails.

---

## F. Testing, Debugging, and Reliability

### Prompt 30 - API Smoke Test Suite
**Component:** backend test coverage

**Prompt:** "Create backend smoke tests covering semantic search edge cases, cluster bounds, network stress, embeddings, and dashboard payload."

**Issue with output:** Manual verification was not enough for confidence.

**Fix applied:** I added unittest smoke tests for rubric-critical endpoints and edge behavior.

### Prompt 31 - Hook Ordering and Lint Fixes
**Component:** frontend stability

**Prompt:** "Fix React hook/lint issues in overview after UI refactor."

**Issue with output:** One refactor introduced lint/runtime risk.

**Fix applied:** I normalized hook flow and component composition.

### Prompt 32 - Deprecation Cleanup
**Component:** backend timestamp generation

**Prompt:** "Fix deprecated UTC timestamp usage in backend payload generation."

**Issue with output:** Deprecated calls created warning noise.

**Fix applied:** I switched to timezone-aware timestamp generation.

### Prompt 33 - Render 502 Troubleshooting
**Component:** deployment diagnostics

**Prompt:** "Diagnose intermittent Render 502 and verify if backend is actually unhealthy or just cold-starting."

**Issue with output:** Root-path behavior was mistaken for API failure.

**Fix applied:** I validated repeated /api/health checks and documented free-tier cold-start expectations.

### Prompt 34 - CORS Production Debugging
**Component:** deployment integration

**Prompt:** "Investigate deployed frontend API failures by checking Access-Control-Allow-Origin behavior for Vercel origin."

**Issue with output:** Backend only allowed localhost origins.

**Fix applied:** I updated origin guidance to include deployed frontend domain.

---

## G. Deployment and Submission Packaging

### Prompt 35 - Deployment Strategy
**Component:** release workflow

**Prompt:** "Give A-to-Z deployment steps for this exact stack on Render (backend) and Vercel (frontend)."

**Issue with output:** Generic deployment steps caused confusion.

**Fix applied:** I used service-specific commands, env vars, and verification checks.

### Prompt 36 - README Rubric Alignment
**Component:** documentation completeness

**Prompt:** "Audit README against Instructions.md and Pro-Tips.md and patch missing evidence sections."

**Issue with output:** README had placeholders and stale feature wording.

**Fix applied:** I updated hosting proof, corrected feature descriptions, and tightened limitations.

---

## Closing Notes

AI accelerated drafts, repetitive scaffolding, and troubleshooting hypotheses. Final correctness depended on manual validation, integration checks, endpoint contract safety, and production verification. The most important project decisions such as architecture simplification, cache strategy, edge-case handling, and deployment stability were manually decided and verified.
