"""
Generate Visual #6: SEO Career Path
Day 1, Chapter 1: SEO Fundamentals & the Modern Search Landscape

VISUAL GOAL:
Show progression from entry-level to specialist roles.
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

fig, ax = setup_figure(figsize=(12, 7), background_color=NEUTRAL['background'])

# Career progression stages
stages = [
    {"name": "Entry Level", "y": 2, "color": PRIMARY['blue']},
    {"name": "Intermediate", "y": 3.5, "color": PRIMARY['green']},
    {"name": "Advanced", "y": 5, "color": PRIMARY['purple']},
    {"name": "Specialist", "y": 6.5, "color": PRIMARY['orange']}
]

box_width = 3
box_height = 0.9
x_center = 6

all_x_positions = []
all_y_positions = []

# Draw progression boxes
for i, stage in enumerate(stages):
    y = stage['y']
    all_y_positions.append(y)
    all_x_positions.extend([x_center - box_width/2, x_center + box_width/2])
    
    # Stage box (ZORDER_CONTENT)
    box = FancyBboxPatch((x_center - box_width/2, y - box_height/2),
                        box_width, box_height,
                        boxstyle='round,pad=0.2',
                        facecolor=stage['color'], alpha=0.3,
                        edgecolor=stage['color'], linewidth=STYLE['line_widths']['normal'],
                        zorder=ZORDER_CONTENT)
    ax.add_patch(box)
    
    # Stage label INSIDE box (ZORDER_FOREGROUND)
    ax.text(x_center, y, stage['name'],
           ha='center', va='center',
           fontsize=FONTS['sizes']['body'],
           fontweight=FONTS['weights']['bold'],
           color=NEUTRAL['dark'],
           zorder=ZORDER_FOREGROUND)
    
    # Arrow to next stage (except last) - ZORDER_BASE (behind boxes)
    if i < len(stages) - 1:
        next_y = stages[i+1]['y']
        arrow_start_y = y + box_height/2 + STYLE['arrow_offsets']['from_box_edge']
        arrow_end_y = next_y - box_height/2 - STYLE['arrow_offsets']['from_box_edge']
        arrow = FancyArrowPatch((x_center, arrow_start_y),
                               (x_center, arrow_end_y),
                               arrowstyle='->',
                               linewidth=STYLE['line_widths']['normal'],
                               color=NEUTRAL['dark'],
                               zorder=ZORDER_BASE)
        ax.add_patch(arrow)

# Dynamic sizing with padding
padding = max(0.5, STYLE['text_offsets']['min_from_shape'])
x_min = x_center - box_width/2 - padding
x_max = x_center + box_width/2 + padding
y_min = min(all_y_positions) - box_height/2 - padding
y_max = max(all_y_positions) + box_height/2 + padding

ax.set_xlim(x_min, x_max)
ax.set_ylim(y_min, y_max)
ax.axis('off')

# Save
output_path = Path(__file__).parent.parent / "visual-6-career-path.svg"
plt.savefig(output_path, format='svg', dpi=EXPORT_CONFIG['dpi'],
           bbox_inches=EXPORT_CONFIG['bbox_inches'], pad_inches=EXPORT_CONFIG['pad_inches'])
print(f"Generated: {output_path}")
plt.close()
