"""
Generate Visual #1: Crawl → Index → Rank Flow
Day 1, Chapter 2: How Search Engines Work

VISUAL GOAL:
Show the three-stage sequential process: crawl → index → rank
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

fig, ax = setup_figure(figsize=(12, 6), background_color=NEUTRAL['background'])

# Three stages
stages = [
    {"name": "Crawl", "desc": "Discover\npages", "x": 2, "color": PRIMARY['blue']},
    {"name": "Index", "desc": "Store\npages", "x": 5, "color": PRIMARY['green']},
    {"name": "Rank", "desc": "Order\nresults", "x": 8, "color": PRIMARY['orange']}
]

box_width = 2
box_height = 1.5
y_center = 2.5

all_x_positions = []
all_y_positions = []

# Draw stages
for i, stage in enumerate(stages):
    x = stage['x']
    all_x_positions.extend([x - box_width/2, x + box_width/2])
    all_y_positions.extend([y_center - box_height/2, y_center + box_height/2])
    
    # Stage box (ZORDER_CONTENT)
    box = FancyBboxPatch((x - box_width/2, y_center - box_height/2),
                        box_width, box_height,
                        boxstyle='round,pad=0.2',
                        facecolor=stage['color'], alpha=0.3,
                        edgecolor=stage['color'], linewidth=STYLE['line_widths']['thick'],
                        zorder=ZORDER_CONTENT)
    ax.add_patch(box)
    
    # Stage name ABOVE box with proper spacing (ZORDER_FOREGROUND)
    name_y = y_center + box_height/2 + STYLE['text_offsets']['above_box']
    ax.text(x, name_y, stage['name'],
           ha='center', va='bottom',
           fontsize=FONTS['sizes']['heading'],
           fontweight=FONTS['weights']['bold'],
           color=NEUTRAL['dark'],
           zorder=ZORDER_FOREGROUND)
    all_y_positions.append(name_y)
    
    # Stage description INSIDE box (ZORDER_FOREGROUND)
    ax.text(x, y_center, stage['desc'],
           ha='center', va='center',
           fontsize=FONTS['sizes']['body'],
           color=NEUTRAL['gray_dark'],
           zorder=ZORDER_FOREGROUND)
    
    # Arrow to next stage (except last) - ZORDER_BASE
    if i < len(stages) - 1:
        next_x = stages[i+1]['x']
        arrow_start_x = x + box_width/2 + STYLE['arrow_offsets']['from_box_edge']
        arrow_end_x = next_x - box_width/2 - STYLE['arrow_offsets']['from_box_edge']
        arrow = FancyArrowPatch((arrow_start_x, y_center),
                               (arrow_end_x, y_center),
                               arrowstyle='->',
                               linewidth=STYLE['line_widths']['normal'],
                               color=NEUTRAL['dark'],
                               zorder=ZORDER_BASE)
        ax.add_patch(arrow)

# Dynamic sizing with padding
padding = max(0.5, STYLE['text_offsets']['min_from_shape'])
x_min = min(all_x_positions) - padding
x_max = max(all_x_positions) + padding
y_min = min(all_y_positions) - padding
y_max = max(all_y_positions) + padding

ax.set_xlim(x_min, x_max)
ax.set_ylim(y_min, y_max)
ax.axis('off')

# Save
output_path = Path(__file__).parent.parent / "visual-1-crawl-index-rank-flow.svg"
plt.savefig(output_path, format='svg', dpi=EXPORT_CONFIG['dpi'],
           bbox_inches=EXPORT_CONFIG['bbox_inches'], pad_inches=EXPORT_CONFIG['pad_inches'])
print(f"Generated: {output_path}")
plt.close()
