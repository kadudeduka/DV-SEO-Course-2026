"""
Generate Visual #2: SEO as Alignment
Day 1, Chapter 1: SEO Fundamentals & the Modern Search Landscape

VISUAL GOAL:
Show how three elements converge to create organic search visibility.
"""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import Circle
import numpy as np
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent.parent / "_shared"))
from design_system import (
    PRIMARY, NEUTRAL, ACCENT, FONTS, STYLE, EXPORT_CONFIG,
    setup_figure, ZORDER_BACKGROUND, ZORDER_BASE, ZORDER_CONTENT, ZORDER_FOREGROUND
)

fig, ax = setup_figure(figsize=(10, 8), background_color=NEUTRAL['background'])

# Create three overlapping circles (Venn diagram style)
# Positions for three circles
center1 = (2.5, 5)
center2 = (5, 5)
center3 = (3.75, 3.5)
radius = 2.5

# Colors for each element
color_content = PRIMARY['blue']
color_user_intent = PRIMARY['green']
color_search_goals = PRIMARY['orange']

# Track positions for dynamic sizing
all_x_positions = []
all_y_positions = []

# Create circles with transparency (ZORDER_CONTENT)
circle1 = Circle(center1, radius, facecolor=color_content, alpha=0.4, 
                 edgecolor=color_content, linewidth=STYLE['line_widths']['normal'],
                 zorder=ZORDER_CONTENT)
circle2 = Circle(center2, radius, facecolor=color_user_intent, alpha=0.4,
                 edgecolor=color_user_intent, linewidth=STYLE['line_widths']['normal'],
                 zorder=ZORDER_CONTENT)
circle3 = Circle(center3, radius, facecolor=color_search_goals, alpha=0.4,
                 edgecolor=color_search_goals, linewidth=STYLE['line_widths']['normal'],
                 zorder=ZORDER_CONTENT)

ax.add_patch(circle1)
ax.add_patch(circle2)
ax.add_patch(circle3)

# Track circle bounds
for cx, cy in [center1, center2, center3]:
    all_x_positions.extend([cx - radius, cx + radius])
    all_y_positions.extend([cy - radius, cy + radius])

# Labels for each circle (with proper spacing above circles)
# Text above circle 1
text1_y = center1[1] + radius + STYLE['text_offsets']['above_box']
ax.text(center1[0], text1_y, "Content\n(Solves Problems)", 
        ha='center', va='bottom',
        fontsize=FONTS['sizes']['subheading'],
        fontweight=FONTS['weights']['bold'],
        color=NEUTRAL['dark'],
        zorder=ZORDER_FOREGROUND)
all_y_positions.append(text1_y)

# Text above circle 2
text2_y = center2[1] + radius + STYLE['text_offsets']['above_box']
ax.text(center2[0], text2_y, "User Intent\n(What Users Seek)", 
        ha='center', va='bottom',
        fontsize=FONTS['sizes']['subheading'],
        fontweight=FONTS['weights']['bold'],
        color=NEUTRAL['dark'],
        zorder=ZORDER_FOREGROUND)
all_y_positions.append(text2_y)

# Text below circle 3
text3_y = center3[1] - radius - STYLE['text_offsets']['below_box']
ax.text(center3[0], text3_y, "Search Engine Goals\n(Satisfying Users)", 
        ha='center', va='top',
        fontsize=FONTS['sizes']['subheading'],
        fontweight=FONTS['weights']['bold'],
        color=NEUTRAL['dark'],
        zorder=ZORDER_FOREGROUND)
all_y_positions.append(text3_y)

# Label overlap area (SEO success) - centered in overlap
ax.text(3.75, 4.5, "SEO\nSuccess", 
        ha='center', va='center',
        fontsize=FONTS['sizes']['heading'],
        fontweight=FONTS['weights']['bold'],
        color=NEUTRAL['dark'],
        bbox=dict(boxstyle='round,pad=0.5', facecolor='white', alpha=0.9, edgecolor='none'),
        zorder=ZORDER_FOREGROUND)

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
output_path = Path(__file__).parent.parent / "visual-2-seo-alignment-diagram.svg"
plt.savefig(output_path, format='svg', dpi=EXPORT_CONFIG['dpi'],
           bbox_inches=EXPORT_CONFIG['bbox_inches'], pad_inches=EXPORT_CONFIG['pad_inches'])
print(f"Generated: {output_path}")
plt.close()
