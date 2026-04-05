"""
summarizer.py - GenAI chart summaries using Google Gemini.

Generates dynamic, analyst-grade plain-language insights for each chart/visualization.
Falls back to template-based summaries when API key is not available.
"""

import os
import json
import warnings


_GENAI_MODULE = None


def _get_genai_module():
    """Load google.generativeai once and suppress its deprecation warning noise."""
    global _GENAI_MODULE

    if _GENAI_MODULE is not None:
        return _GENAI_MODULE

    with warnings.catch_warnings():
        warnings.simplefilter('ignore', FutureWarning)
        import google.generativeai as genai

    _GENAI_MODULE = genai
    return _GENAI_MODULE


def get_genai_summary(chart_type, chart_data, dataset_context=None):
    """
    Generate a GenAI summary for chart data using Gemini.
    
    Args:
        chart_type: e.g., "time_series", "network", "clusters", "search"
        chart_data: dict with the chart's data/stats
        dataset_context: optional string describing the dataset
        
    Returns:
        str: 3-5 sentence analytical insight
    """
    api_key = os.environ.get('GEMINI_API_KEY')
    
    if not api_key:
        return generate_fallback_summary(chart_type, chart_data)
    
    try:
        genai = _get_genai_module()
        genai.configure(api_key=api_key)
        
        if not dataset_context:
            dataset_context = (
                "A dataset of Reddit posts from 10 political subreddits "
                "(neoliberal, politics, socialism, Liberal, Conservative, "
                "Anarchism, democrats, Republican, worldpolitics, PoliticalDiscussion) "
                "spanning July 2024 to February 2025."
            )
        
        prompt = f"""You are a social media research analyst specializing in political discourse analysis.

Dataset context: {dataset_context}

Chart type: {chart_type}

Chart data summary: {json.dumps(chart_data, indent=2, default=str)}

Write a 3-5 sentence analytical insight about what this data reveals. 
Be specific. Avoid generic observations. Focus on meaning, not just description.
Mention specific numbers, dates, or accounts when relevant.
Explain WHY patterns might exist, not just WHAT the patterns are.
"""
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        
        return response.text.strip()
    
    except Exception as e:
        print(f"GenAI summary error: {e}")
        return generate_fallback_summary(chart_type, chart_data)


def generate_fallback_summary(chart_type, chart_data):
    """Generate a template-based summary when GenAI is not available."""
    
    if chart_type == 'time_series':
        total = chart_data.get('total_posts', 0)
        peak_date = chart_data.get('peak_date', 'unknown')
        peak_count = chart_data.get('peak_count', 0)
        return (
            f"The conversation contained {total} posts over the tracked period. "
            f"Activity peaked on {peak_date} with {peak_count} posts. "
            f"This spike likely corresponds to a significant political event or controversy "
            f"that drove increased engagement across political subreddits."
        )
    
    elif chart_type == 'network':
        num_nodes = chart_data.get('num_nodes', 0)
        num_communities = chart_data.get('num_communities', 0)
        top_user = chart_data.get('top_influencer', 'unknown')
        return (
            f"The network contains {num_nodes} active participants organized into "
            f"{num_communities} distinct communities. "
            f"The most influential user is '{top_user}' based on PageRank analysis, "
            f"suggesting they serve as a key bridge between different political communities."
        )
    
    elif chart_type == 'clusters':
        k = chart_data.get('k', 0)
        largest = chart_data.get('largest_cluster', 'unknown')
        return (
            f"The posts cluster into {k} distinct topic groups. "
            f"The largest cluster focuses on '{largest}', indicating this is the dominant "
            f"theme in the political discourse during this period."
        )
    
    elif chart_type == 'search':
        query = chart_data.get('query', '')
        num_results = chart_data.get('num_results', 0)
        top_score = chart_data.get('top_similarity', 0)
        return (
            f"The search for '{query}' returned {num_results} semantically similar posts. "
            f"The top result has a {top_score:.0%} similarity score, "
            f"demonstrating that the topic resonates across multiple political communities."
        )
    
    return "Summary unavailable. Set GEMINI_API_KEY environment variable for AI-generated insights."


def get_suggested_queries(query, results_context):
    """
    Generate 2-3 follow-up query suggestions based on the search results.
    
    Args:
        query: the original search query
        results_context: brief description of what was found
        
    Returns:
        list of 2-3 suggested follow-up queries
    """
    api_key = os.environ.get('GEMINI_API_KEY')
    
    if not api_key:
        # Fallback suggestions
        return [
            f"What are the opposing views on {query}?",
            f"How has {query} evolved over time?",
            f"Which communities discuss {query} most?"
        ]
    
    try:
        genai = _get_genai_module()
        genai.configure(api_key=api_key)
        
        prompt = f"""A user searched a political Reddit dataset for: "{query}"

The search returned results about: {results_context}

Suggest exactly 3 follow-up search queries the user might want to explore next.
Each should be a natural language phrase (not a keyword).
Return ONLY the 3 queries, one per line, no numbering, no other text."""
        
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content(prompt)
        
        suggestions = [line.strip() for line in response.text.strip().split('\n') if line.strip()]
        return suggestions[:3]
    
    except Exception:
        return [
            f"What are the opposing views on {query}?",
            f"How has {query} evolved over time?",
            f"Which communities discuss {query} most?"
        ]
