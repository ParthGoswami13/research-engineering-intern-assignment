"""
export_projector.py - Export data for TensorFlow Projector.
Generates `tensors.tsv` and `metadata.tsv` from the dataset and embeddings.
"""

import os
import csv
import numpy as np

def export_for_projector(df, embeddings, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    
    # Write tensors.tsv
    tensors_path = os.path.join(output_dir, 'tensors.tsv')
    print(f"Writing {tensors_path}...")
    np.savetxt(tensors_path, embeddings, delimiter='\t', fmt='%.5f')
    
    # Write metadata.tsv
    metadata_path = os.path.join(output_dir, 'metadata.tsv')
    print(f"Writing {metadata_path}...")
    with open(metadata_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f, delimiter='\t')
        
        # Headers matching your dataset, focusing on useful clusters
        writer.writerow(['Index', 'Title', 'Subreddit', 'Author', 'Score', 'Date'])
        
        for idx, row in df.iterrows():
            title = str(row.get('title', '')).replace('\n', ' ').replace('\t', ' ')
            if len(title) > 100:
                title = title[:97] + '...'
            
            subreddit = str(row.get('subreddit', ''))
            author = str(row.get('author', ''))
            score = str(row.get('score', 0))
            date = str(row.get('created_date', ''))
            
            writer.writerow([idx, title, subreddit, author, score, date])
            
    # Write projector_config.json
    config_path = os.path.join(output_dir, 'projector_config.json')
    import json
    config = {
        "embeddings": [
            {
                "tensorName": "NarrativeTrace Embeddings",
                "tensorShape": [len(df), embeddings.shape[1]],
                "tensorPath": "tensors.tsv",
                "metadataPath": "metadata.tsv"
            }
        ]
    }
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2)
        
    print(f"Exported TF Projector files to {output_dir}")
    print("\nTo view in TensorFlow Projector:")
    print("1. Go to https://projector.tensorflow.org/")
    print("2. Click 'Load' on the left panel")
    print(f"3. Upload '{tensors_path}' in the first box")
    print(f"4. Upload '{metadata_path}' in the second box")
    print("5. Click outside the modal to view your interactive 3D embeddings!")

if __name__ == '__main__':
    from data_loader import load_dataframe
    from embeddings import load_embeddings
    
    df = load_dataframe(use_cache=True)
    embeddings = load_embeddings()
    
    # We'll just export a sample of max 5000 to avoid huge TSV files in browser
    max_pts = 5000
    if len(df) > max_pts:
        print(f"Subsampling to {max_pts} points for projector...")
        np.random.seed(42)
        indices = np.random.choice(len(df), max_pts, replace=False)
        df = df.iloc[indices].reset_index(drop=True)
        embeddings = embeddings[indices]
        
    export_for_projector(df, embeddings, os.path.join(os.path.dirname(__file__), '..', 'data', 'projector'))
