"""
embeddings.py - Generate and manage post embeddings using sentence-transformers.

Model: all-MiniLM-L6-v2 (80MB, 384-dim, CPU-friendly)
"""

import os
import logging
import warnings

import numpy as np

MODELS_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')
EMBEDDINGS_PATH = os.path.join(MODELS_DIR, 'embeddings.npy')
EMBEDDINGS_2D_PATH = os.path.join(MODELS_DIR, 'embeddings_2d.npy')
MODEL_NAME = 'sentence-transformers/all-MiniLM-L6-v2'
_EMBEDDING_MODEL = None


def _configure_hf_runtime():
    """Reduce noisy runtime logs from Hugging Face and Transformers."""
    os.environ.setdefault('HF_HUB_DISABLE_PROGRESS_BARS', '1')
    os.environ.setdefault('HF_HUB_VERBOSITY', 'error')
    os.environ.setdefault('TRANSFORMERS_VERBOSITY', 'error')
    os.environ.setdefault('TOKENIZERS_PARALLELISM', 'false')
    logging.getLogger('huggingface_hub').setLevel(logging.ERROR)
    logging.getLogger('huggingface_hub.utils._http').setLevel(logging.ERROR)
    logging.getLogger('transformers').setLevel(logging.ERROR)
    logging.getLogger('sentence_transformers').setLevel(logging.ERROR)

    try:
        from huggingface_hub.utils import logging as hf_logging
        hf_logging.set_verbosity_error()
    except Exception:
        # Safe fallback: search should still work even if hub logging API changes.
        pass

    try:
        from transformers.utils import logging as transformers_logging
        transformers_logging.set_verbosity_error()
    except Exception:
        # Safe fallback: search should still work even if transformers logging API changes.
        pass


def _get_embedding_model():
    """Load sentence-transformer model once per process and reuse it."""
    global _EMBEDDING_MODEL

    if _EMBEDDING_MODEL is not None:
        return _EMBEDDING_MODEL

    _configure_hf_runtime()

    with warnings.catch_warnings():
        warnings.filterwarnings(
            'ignore',
            message='You are sending unauthenticated requests to the HF Hub.*',
        )
        from sentence_transformers import SentenceTransformer
        _EMBEDDING_MODEL = SentenceTransformer(MODEL_NAME)

    return _EMBEDDING_MODEL


def encode_query(query):
    """Encode one search query to a normalized embedding."""
    model = _get_embedding_model()
    return model.encode([query], normalize_embeddings=True, show_progress_bar=False)[0]


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
    model = _get_embedding_model()
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


def semantic_search(query, corpus_embeddings, top_k=10, query_embedding=None):
    """
    Find the most semantically similar texts to a query.
    
    Args:
        query: string to search for
        corpus_embeddings: precomputed embeddings for the corpus
        top_k: number of results to return
        
    Returns:
        list of (index, similarity_score) tuples, sorted by score descending
    """
    if query_embedding is None:
        query_embedding = encode_query(query)
    
    # Cosine similarity (embeddings are normalized, so dot product = cosine sim)
    similarities = np.dot(corpus_embeddings, query_embedding)
    
    # Get top-K indices
    top_indices = np.argsort(similarities)[::-1][:top_k]
    
    results = [(int(idx), float(similarities[idx])) for idx in top_indices]
    return results
