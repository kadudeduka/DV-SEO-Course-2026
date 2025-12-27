"""
Generate Visual #1: Crawl → Index → Rank Flow
Day 2, Chapter 1: How Search Engines Work (Revisited)

Same as Day 1 Chapter 2 - can reuse the same visual
Copied script for Day 2 structure consistency
"""

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent.parent / "_shared"))
from design_system import (
    PRIMARY, NEUTRAL, ACCENT, FONTS, STYLE, EXPORT_CONFIG,
    setup_figure, ZORDER_BACKGROUND, ZORDER_BASE, ZORDER_CONTENT, ZORDER_FOREGROUND
)

fig, ax = setup_figure(figsize=(12, 5), background_color=NEUTRAL['background'])

# Three stages
stages = [
    {"name": "Crawl", "desc": "Discover\npages", "x": 2, "color": PRIMARY['blue']},
    {"name": "Index", "desc": "Store\npages", "x": 5, "color": PRIMARY['green']},
    {"name": "Rank", "desc": "Order\nresults", "x": 8, "color": PRIMARY['orange']}
]

box_width = 2
box_height = 1.5
y_center = 2.5

all_x, all_y = [], []

# Draw stages
for i, stage in enumerate(stages):
    x = stage['x']
    all_x.append(x)
    all_y.append(y_center)
    
    # Stage box
    box = FancyBboxPatch((x - box_width/2, y_center - box_height/2),
                        box_width, box_height,
                        boxstyle='round,pad=0.2',
                        facecolor=stage['color'], alpha=0.3,
                        edgecolor=stage['color'], linewidth=STYLE['line_widths']['thick'],
                        zorder=ZORDER_CONTENT)
    ax.add_patch(box)
    
    # Stage name
    ax.text(x, y_center + 0.3, stage['name'],
           ha='center', va='center',
           fontsize=FONTS['sizes']['heading'],
           fontweight=FONTS['weights']['bold'],
           color=NEUTRAL['dark'],
           zorder=ZORDER_FOREGROUND)
    
    # Stage description
    ax.text(x, y_center - 0.3, stage['desc'],
           ha='center', va='center',
           fontsize=FONTS['sizes']['body'],
           color=NEUTRAL['gray_dark'],
           zorder=ZORDER_FOREGROUND)
    
    # Arrow to next stage (except last)
    if i < len(stages) - 1:
        next_x = stages[i+1]['x']
        arrow = FancyArrowPatch((x + box_width/2 + 0.1, y_center),
                               (next_x - box_width/2 - 0.1, y_center),
                               arrowstyle='->',
                               linewidth=STYLE['line_widths']['normal'],
                               color=NEUTRAL['dark'],
                               zorder=ZORDER_CONTENT)
        ax.add_patch(arrow)

# Dynamic sizing
x_min = min(all_x) - box_width/2 - 0.5
x_max = max(all_x) + box_width/2 + 0.5
y_min = y_center - box_height/2 - 0.5
y_max = y_center + box_height/2 + 0.5

ax.set_xlim(x_min, x_max)
ax.set_ylim(y_min, y_max)
ax.axis('off')

# Save
output_path = Path(__file__).parent.parent / "visual-1-crawl-index-rank-flow.svg"
plt.savefig(output_path, format='svg', dpi=EXPORT_CONFIG['dpi'],
           bbox_inches=EXPORT_CONFIG['bbox_inches'], pad_inches=EXPORT_CONFIG['pad_inches'])
print(f"Generated: {output_path}")
plt.close()

