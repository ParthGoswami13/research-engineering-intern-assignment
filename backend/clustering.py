"""
clustering.py - Topic clustering using KMeans + TF-IDF label extraction.

Groups posts by semantic similarity with adjustable cluster count.
"""

import numpy as np
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer


def cluster_posts(embeddings, k=5):
    """
    Cluster posts using KMeans on their embeddings.
    
    Args:
        embeddings: numpy array of shape (n, dim)
        k: number of clusters (2-20)
        
    Returns:
        numpy array of cluster labels (shape: (n,))
    """
    k = max(2, min(k, min(20, len(embeddings) // 5)))
    
    kmeans = KMeans(
        n_clusters=k,
        random_state=42,
        n_init=10,
        max_iter=300
    )
    labels = kmeans.fit_predict(embeddings)
    
    return labels, kmeans


def extract_cluster_labels(texts, labels, top_n=5):
    """
    Extract top TF-IDF terms for each cluster to create labels.
    
    Args:
        texts: list of cleaned text strings
        labels: cluster assignment labels
        top_n: number of top terms per cluster
        
    Returns:
        dict mapping cluster_id -> {keywords: [...], label: "..."}
    """
    unique_labels = sorted(set(labels))
    cluster_info = {}
    
    for cluster_id in unique_labels:
        # Get texts belonging to this cluster
        cluster_texts = [texts[i] for i in range(len(texts)) if labels[i] == cluster_id]
        
        if not cluster_texts:
            cluster_info[int(cluster_id)] = {
                'keywords': [],
                'label': f'Cluster {cluster_id}',
                'count': 0
            }
            continue
        
        # TF-IDF on this cluster's texts
        try:
            tfidf = TfidfVectorizer(
                max_features=100,
                stop_words='english',
                max_df=0.9,
                min_df=2 if len(cluster_texts) > 5 else 1
            )
            tfidf_matrix = tfidf.fit_transform(cluster_texts)
            
            # Get top terms by mean TF-IDF score
            feature_names = tfidf.get_feature_names_out()
            mean_scores = tfidf_matrix.mean(axis=0).A1
            top_indices = mean_scores.argsort()[::-1][:top_n]
            top_terms = [feature_names[i] for i in top_indices]
        except Exception:
            top_terms = [f'topic_{cluster_id}']
        
        # Generate a readable label from top terms
        label = ' | '.join(top_terms[:3]).title()
        
        cluster_info[int(cluster_id)] = {
            'keywords': top_terms,
            'label': label,
            'count': len(cluster_texts)
        }
    
    return cluster_info


def get_cluster_data(embeddings, texts, k=5):
    """
    Full clustering pipeline: cluster + extract labels.
    
    Returns:
        dict with cluster_labels (array), cluster_info (dict), k (int)
    """
    n_posts = len(texts)
    
    # Validate k
    k = max(2, min(k, min(20, n_posts // 5)))
    
    # Warn if k is too high
    warnings = []
    if k > n_posts // 5:
        warnings.append(f"Reduced k to {k} (too many clusters for {n_posts} posts)")
    
    labels, kmeans = cluster_posts(embeddings, k)
    cluster_info = extract_cluster_labels(texts, labels)
    
    return {
        'labels': labels.tolist(),
        'cluster_info': cluster_info,
        'k': k,
        'warnings': warnings
    }
