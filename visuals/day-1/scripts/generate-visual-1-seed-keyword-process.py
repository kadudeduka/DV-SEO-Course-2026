"""
Generate Visual #1: Seed Keyword Identification Process
Day 1, Chapter 3: Keyword Research Foundations

VISUAL GOAL:
Show the process of identifying seed keywords systematically
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

fig, ax = setup_figure(figsize=(10, 6), background_color=NEUTRAL['background'])

# Process steps (flowchart style)
steps = [
    {"name": "Identify\nCore Topic", "x": 2, "y": 3},
    {"name": "Business\nOffering", "x": 5, "y": 5},
    {"name": "Target\nAudience", "x": 8, "y": 3},
]

# Converge to seed keywords
seed_x, seed_y = 5, 1.5

box_width = 2
box_height = 1
all_x_positions = []
all_y_positions = []

# Draw input steps
for step in steps:
    x, y = step['x'], step['y']
    all_x_positions.extend([x - box_width/2, x + box_width/2])
    all_y_positions.extend([y - box_height/2, y + box_height/2])
    
    # Input box (ZORDER_CONTENT)
    box = FancyBboxPatch((x - box_width/2, y - box_height/2),
                        box_width, box_height,
                        boxstyle='round,pad=0.2',
                        facecolor=PRIMARY['blue'], alpha=0.3,
                        edgecolor=PRIMARY['blue'], linewidth=STYLE['line_widths']['normal'],
                        zorder=ZORDER_CONTENT)
    ax.add_patch(box)
    
    # Step text INSIDE box (ZORDER_FOREGROUND)
    ax.text(x, y, step['name'],
           ha='center', va='center',
           fontsize=FONTS['sizes']['body'],
           color=NEUTRAL['dark'],
           zorder=ZORDER_FOREGROUND)
    
    # Arrow to seed keywords (ZORDER_BASE)
    arrow_start_y = y - box_height/2 - STYLE['arrow_offsets']['from_box_edge']
    arrow_end_y = seed_y + box_height/2 + STYLE['arrow_offsets']['from_box_edge']
    arrow = FancyArrowPatch((x, arrow_start_y),
                           (seed_x, arrow_end_y),
                           arrowstyle='->',
                           linewidth=STYLE['line_widths']['normal'],
                           color=NEUTRAL['dark'],
                           zorder=ZORDER_BASE)
    ax.add_patch(arrow)

# Seed keywords box (ZORDER_CONTENT)
seed_box = FancyBboxPatch((seed_x - box_width, seed_y - box_height/2),
                          box_width * 2, box_height,
                          boxstyle='round,pad=0.2',
                          facecolor=PRIMARY['green'], alpha=0.4,
                          edgecolor=PRIMARY['green'], linewidth=STYLE['line_widths']['thick'],
                          zorder=ZORDER_CONTENT)
ax.add_patch(seed_box)
all_x_positions.extend([seed_x - box_width, seed_x + box_width])
all_y_positions.extend([seed_y - box_height/2, seed_y + box_height/2])

# Seed keywords text (ZORDER_FOREGROUND)
ax.text(seed_x, seed_y, "Seed Keywords",
       ha='center', va='center',
       fontsize=FONTS['sizes']['subheading'],
       fontweight=FONTS['weights']['bold'],
       color=NEUTRAL['dark'],
       zorder=ZORDER_FOREGROUND)

# Dynamic sizing with padding
padding = max(0.5, STYLE['text_offsets']['min_from_shape'])
x_min = min(all_x_positions) - box_width/2 - padding
x_max = max(all_x_positions) + box_width/2 + padding
y_min = seed_y - box_height/2 - padding
y_max = max(all_y_positions) + box_height/2 + padding

ax.set_xlim(x_min, x_max)
ax.set_ylim(y_min, y_max)
ax.axis('off')

# Save
output_path = Path(__file__).parent.parent / "visual-1-seed-keyword-process.svg"
plt.savefig(output_path, format='svg', dpi=EXPORT_CONFIG['dpi'],
           bbox_inches=EXPORT_CONFIG['bbox_inches'], pad_inches=EXPORT_CONFIG['pad_inches'])
print(f"Generated: {output_path}")
plt.close()
