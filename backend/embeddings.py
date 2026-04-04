"""
embeddings.py - Generate and manage post embeddings using sentence-transformers.

Model: all-MiniLM-L6-v2 (80MB, 384-dim, CPU-friendly)
"""

import os
import numpy as np

MODELS_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')
EMBEDDINGS_PATH = os.path.join(MODELS_DIR, 'embeddings.npy')
EMBEDDINGS_2D_PATH = os.path.join(MODELS_DIR, 'embeddings_2d.npy')
MODEL_NAME = 'sentence-transformers/all-MiniLM-L6-v2'


def generate_embeddings(texts, force=False):
    """
    Generate embeddings for a list of texts using sentence-transformers.
    Caches result to models/embeddings.npy.
    
    Args:
        texts: list of strings to embed
        force: if True, regenerate even if cache exists
        
    Returns:
        numpy array of shape (len(texts), 384)
    """
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    if not force and os.path.exists(EMBEDDINGS_PATH):
        print(f"Loading cached embeddings from {EMBEDDINGS_PATH}")
        embs = np.load(EMBEDDINGS_PATH)
        if embs.shape[0] == len(texts):
            return embs
        print(f"Cache size mismatch ({embs.shape[0]} vs {len(texts)}), regenerating...")
    
    print(f"Generating embeddings for {len(texts)} texts...")
    from sentence_transformers import SentenceTransformer
    
    model = SentenceTransformer(MODEL_NAME)
    embeddings = model.encode(
        texts, 
        batch_size=64, 
        show_progress_bar=True,
        normalize_embeddings=True
    )
    
    np.save(EMBEDDINGS_PATH, embeddings)
    print(f"Saved embeddings to {EMBEDDINGS_PATH} (shape: {embeddings.shape})")
    
    return embeddings


def load_embeddings():
    """Load precomputed embeddings from cache."""
    if not os.path.exists(EMBEDDINGS_PATH):
        raise FileNotFoundError(
            f"Embeddings not found at {EMBEDDINGS_PATH}. "
            "Run generate_embeddings() first."
        )
    return np.load(EMBEDDINGS_PATH)


def generate_2d_projection(embeddings, method='pca', force=False):
    """
    Project embeddings to 2D using PCA or UMAP.
    
    Args:
        embeddings: numpy array of shape (n, dim)
        method: 'pca' or 'umap'
        force: if True, regenerate even if cache exists
        
    Returns:
        numpy array of shape (n, 2)
    """
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    if not force and os.path.exists(EMBEDDINGS_2D_PATH):
        print(f"Loading cached 2D projections from {EMBEDDINGS_2D_PATH}")
        proj = np.load(EMBEDDINGS_2D_PATH)
        if proj.shape[0] == embeddings.shape[0]:
            return proj
        print("Cache size mismatch, regenerating...")
    
    print(f"Generating 2D projection using {method}...")
    
    # Subsample if too many points
    n_samples = embeddings.shape[0]
    max_samples = 5000
    indices = None
    
    if n_samples > max_samples:
        indices = np.random.choice(n_samples, max_samples, replace=False)
        emb_subset = embeddings[indices]
    else:
        emb_subset = embeddings
    
    if method == 'umap':
        try:
            import umap
            reducer = umap.UMAP(n_components=2, random_state=42, n_neighbors=15, min_dist=0.1)
            coords_subset = reducer.fit_transform(emb_subset)
        except ImportError:
            print("UMAP not available, falling back to PCA")
            method = 'pca'
    
    if method == 'pca':
        from sklearn.decomposition import PCA
        pca = PCA(n_components=2, random_state=42)
        coords_subset = pca.fit_transform(emb_subset)
    
    # If we subsampled, we need to project remaining points too
    if indices is not None:
        # For the full dataset, use PCA on all points (fast enough)
        from sklearn.decomposition import PCA
        pca = PCA(n_components=2, random_state=42)
        coords_2d = pca.fit_transform(embeddings)
    else:
        coords_2d = coords_subset
    
    np.save(EMBEDDINGS_2D_PATH, coords_2d)
    print(f"Saved 2D projections to {EMBEDDINGS_2D_PATH} (shape: {coords_2d.shape})")
    
    return coords_2d


def semantic_search(query, corpus_embeddings, top_k=10):
    """
    Find the most semantically similar texts to a query.
    
    Args:
        query: string to search for
        corpus_embeddings: precomputed embeddings for the corpus
        top_k: number of results to return
        
    Returns:
        list of (index, similarity_score) tuples, sorted by score descending
    """
    from sentence_transformers import SentenceTransformer
    
    model = SentenceTransformer(MODEL_NAME)
    query_embedding = model.encode([query], normalize_embeddings=True)[0]
    
    # Cosine similarity (embeddings are normalized, so dot product = cosine sim)
    similarities = np.dot(corpus_embeddings, query_embedding)
    
    # Get top-K indices
    top_indices = np.argsort(similarities)[::-1][:top_k]
    
    results = [(int(idx), float(similarities[idx])) for idx in top_indices]
    return results
