import json
import subprocess
from pathlib import Path

# Get modified files from git status
result = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True)
lines = result.stdout.strip().split('\n')

modified_files = []
for line in lines:
    if line.startswith(' M ') or line.startswith('?? '):
        file_path = line[3:].strip()
        if Path(file_path).exists() and Path(file_path).is_file():
            modified_files.append(file_path)

# Filter detection results to only include modified files
with open('.graphify_detect.json', 'r') as f:
    detect_data = json.load(f)

filtered_files = {'code': [], 'document': [], 'paper': [], 'image': [], 'video': []}
total_words = 0

for category, files in detect_data['files'].items():
    for file_path in files:
        if file_path in modified_files:
            filtered_files[category].append(file_path)
            # Rough word count estimate
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    total_words += len(content.split())
            except:
                pass

filtered_data = {
    'files': filtered_files,
    'total_files': sum(len(files) for files in filtered_files.values()),
    'total_words': total_words,
    'needs_graph': True,
    'warning': None,
    'skipped_sensitive': [],
    'graphifyignore_patterns': 0
}

with open('.graphify_detect_modified.json', 'w') as f:
    json.dump(filtered_data, f, indent=2)

print(f'Filtered to {filtered_data["total_files"]} modified files with ~{total_words} words')