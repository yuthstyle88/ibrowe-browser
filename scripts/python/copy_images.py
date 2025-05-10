#!/usr/bin/env python3

import os
import shutil
from pathlib import Path
from collections import defaultdict
from datetime import datetime

def copy_files():
    # Define source directory (relative to script location)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    source_dir = os.path.join(script_dir, "../../src/brave")
    
    # Create timestamped output directory
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = os.path.join(script_dir, f"../../ibrave_images_{timestamp}")
    
    # Create output directory and subdirectories
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(os.path.join(output_dir, "images"), exist_ok=True)
    os.makedirs(os.path.join(output_dir, "xml"), exist_ok=True)
    
    # Dictionary to store counts
    file_counts = defaultdict(int)
    
    # Walk through the source directory
    for root, dirs, files in os.walk(source_dir):
        for file in files:
            # Get file extension
            ext = file.lower().split('.')[-1]
            
            # Get relative path from source directory
            rel_path = os.path.relpath(root, source_dir)
            
            # Create new filename based on path
            path_name = rel_path.replace('/', '_').replace('\\', '_').strip('_')
            new_filename = f"{path_name}_{file}"
            
            # Handle image files
            if ext in ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']:
                source_file = os.path.join(root, file)
                target_file = os.path.join(output_dir, "images", new_filename)
                shutil.copy2(source_file, target_file)
                file_counts[f"image_{ext}"] += 1
            
            # Handle XML files
            elif ext == 'xml':
                source_file = os.path.join(root, file)
                target_file = os.path.join(output_dir, "xml", new_filename)
                shutil.copy2(source_file, target_file)
                file_counts['xml'] += 1
    
    # Print summary
    print("\nCopy Summary:")
    print("-" * 20)
    print(f"Output directory: {output_dir}")
    print(f"  ├── images/")
    print(f"  └── xml/")
    print("-" * 20)
    
    # Print image counts
    print("\nImage files:")
    for key, count in file_counts.items():
        if key.startswith('image_'):
            ext = key.split('_')[1].upper()
            print(f"{ext}: {count} files")
    
    # Print XML count
    print("\nXML files:")
    print(f"XML: {file_counts['xml']} files")
    
    print("-" * 20)
    print(f"Total files copied: {sum(file_counts.values())}")

if __name__ == "__main__":
    copy_files()