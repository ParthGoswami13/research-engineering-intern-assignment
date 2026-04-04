"""
network.py - Build interaction network from Reddit crosspost data.

Builds a directed graph of crosspost relationships between authors/subreddits.
Computes PageRank influence scores and Louvain community detection.
"""

import networkx as nx
from collections import defaultdict


def build_network(df):
    """
    Build a directed interaction graph from the dataset.
    
    Network edges are built from:
    1. Crosspost relationships (user A crossposts from user B)
    2. Subreddit overlap (users posting in same subreddits)
    3. Domain sharing (users sharing same URLs/domains)
    
    Args:
        df: pandas DataFrame with columns: author, subreddit, crosspost_from_author,
            crosspost_from_sub, domain, url
            
    Returns:
        networkx.DiGraph with nodes (authors) and weighted edges
    """
    G = nx.DiGraph()
    
    # 1. Crosspost edges: author -> crosspost_from_author
    crosspost_edges = defaultdict(int)
    for _, row in df.iterrows():
        if row.get('crosspost_from_author') and row['author'] != row['crosspost_from_author']:
            author = str(row['author'])
            source = str(row['crosspost_from_author'])
            if author and source and author != '[deleted]' and source != '[deleted]':
                crosspost_edges[(author, source)] += 1
    
    for (src, tgt), weight in crosspost_edges.items():
        if G.has_edge(src, tgt):
            G[src][tgt]['weight'] += weight
        else:
            G.add_edge(src, tgt, weight=weight, edge_type='crosspost')
    
    # 2. Subreddit co-posting edges: users who post in same subreddits
    sub_authors = defaultdict(set)
    for _, row in df.iterrows():
        author = str(row.get('author', ''))
        sub = str(row.get('subreddit', ''))
        if author and author != '[deleted]' and author != 'AutoModerator':
            sub_authors[sub].add(author)
    
    # Create co-posting edges (undirected, add both directions)
    copost_edges = defaultdict(int)
    for sub, authors in sub_authors.items():
        authors_list = list(authors)
        if len(authors_list) > 100:
            # Cap to avoid O(n^2) explosion on large subreddits
            import random
            random.seed(42)
            authors_list = random.sample(authors_list, 100)
        for i in range(len(authors_list)):
            for j in range(i + 1, len(authors_list)):
                copost_edges[(authors_list[i], authors_list[j])] += 1
    
    for (a, b), weight in copost_edges.items():
        if not G.has_edge(a, b):
            G.add_edge(a, b, weight=weight, edge_type='co_subreddit')
        if not G.has_edge(b, a):
            G.add_edge(b, a, weight=weight, edge_type='co_subreddit')
    
    # 3. Domain sharing: users who share links from same domains
    domain_authors = defaultdict(set)
    for _, row in df.iterrows():
        domain = str(row.get('domain', ''))
        author = str(row.get('author', ''))
        if (domain and author and 
            not domain.startswith('self.') and 
            author != '[deleted]' and 
            author != 'AutoModerator'):
            domain_authors[domain].add(author)
    
    for domain, authors in domain_authors.items():
        authors_list = list(authors)
        if len(authors_list) > 50:
            import random
            random.seed(42)
            authors_list = random.sample(authors_list, 50)
        for i in range(len(authors_list)):
            for j in range(i + 1, len(authors_list)):
                a, b = authors_list[i], authors_list[j]
                if not G.has_edge(a, b):
                    G.add_edge(a, b, weight=1, edge_type='shared_domain')
    
    # Remove self-loops
    G.remove_edges_from(nx.selfloop_edges(G))
    
    return G


def compute_pagerank(G, alpha=0.85):
    """Compute PageRank scores for all nodes."""
    if len(G) == 0:
        return {}
    try:
        scores = nx.pagerank(G, alpha=alpha, weight='weight')
    except nx.PowerIterationFailedConvergence:
        scores = nx.pagerank(G, alpha=alpha, weight='weight', max_iter=200)
    return scores


def detect_communities(G):
    """
    Detect communities using Louvain algorithm.
    
    Returns:
        dict mapping node -> community_id
    """
    if len(G) == 0:
        return {}
    
    # Convert to undirected for community detection
    G_undirected = G.to_undirected()
    
    try:
        import community as community_louvain
        partition = community_louvain.best_partition(G_undirected, random_state=42)
    except ImportError:
        # Fallback: use networkx's built-in
        communities = list(nx.community.louvain_communities(G_undirected, seed=42))
        partition = {}
        for i, comm in enumerate(communities):
            for node in comm:
                partition[node] = i
    
    return partition


def get_network_data(df, max_nodes=200):
    """
    Full network analysis pipeline.
    
    Returns:
        dict with nodes, edges, communities, pagerank scores, top influencers
    """
    G = build_network(df)
    
    # If graph is too large, prune low-degree nodes
    if len(G) > max_nodes:
        # Keep top nodes by degree
        degree_dict = dict(G.degree())
        top_nodes = sorted(degree_dict, key=degree_dict.get, reverse=True)[:max_nodes]
        G = G.subgraph(top_nodes).copy()
    
    # Skip PageRank for very small graphs
    if len(G) < 3:
        return {
            'nodes': [],
            'edges': [],
            'communities': {},
            'pagerank': {},
            'top_influencers': [],
            'stats': {
                'num_nodes': len(G),
                'num_edges': G.number_of_edges(),
                'message': 'Not enough interaction data to build a network'
            }
        }
    
    pagerank = compute_pagerank(G)
    communities = detect_communities(G)
    
    # Detect connected components
    G_undirected = G.to_undirected()
    components = list(nx.connected_components(G_undirected))
    
    # Build node list
    nodes = []
    for node in G.nodes():
        nodes.append({
            'id': node,
            'pagerank': round(pagerank.get(node, 0), 6),
            'community': communities.get(node, 0),
            'degree': G.degree(node),
            'in_degree': G.in_degree(node),
            'out_degree': G.out_degree(node),
        })
    
    # Build edge list (prune weakest if too many)
    edges_list = []
    for u, v, data in G.edges(data=True):
        edges_list.append({
            'source': u,
            'target': v,
            'weight': data.get('weight', 1),
            'edge_type': data.get('edge_type', 'unknown')
        })
    
    # Top influencers by PageRank
    top_influencers = sorted(
        nodes, key=lambda x: x['pagerank'], reverse=True
    )[:10]
    
    return {
        'nodes': nodes,
        'edges': edges_list,
        'communities': communities,
        'pagerank': {k: round(v, 6) for k, v in pagerank.items()},
        'top_influencers': top_influencers,
        'stats': {
            'num_nodes': len(nodes),
            'num_edges': len(edges_list),
            'num_communities': len(set(communities.values())) if communities else 0,
            'num_components': len(components),
            'components': [
                {'size': len(c), 'label': f'Component {i+1}'}
                for i, c in enumerate(sorted(components, key=len, reverse=True)[:5])
            ]
        }
    }
