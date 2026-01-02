"""
Generate Visual #4: SERP Anatomy
Day 1, Chapter 2: How Search Engines Work

VISUAL GOAL:
Show SERP components and what they signal about intent
"""

import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent.parent / "_shared"))
from design_system import (
    PRIMARY, NEUTRAL, ACCENT, FONTS, STYLE, EXPORT_CONFIG,
    setup_figure, ZORDER_BACKGROUND, ZORDER_BASE, ZORDER_CONTENT, ZORDER_FOREGROUND
)

fig, ax = setup_figure(figsize=(8, 10), background_color=NEUTRAL['background'])

# SERP components (vertical layout)
components = [
    {"name": "Paid Ads", "y": 9, "color": PRIMARY['red'], "height": 0.6},
    {"name": "Featured Snippet", "y": 8, "color": ACCENT['yellow'], "height": 0.8},
    {"name": "Organic Results", "y": 6.5, "color": PRIMARY['blue'], "height": 1.5},
    {"name": "People Also Ask", "y": 4.5, "color": PRIMARY['purple'], "height": 1},
    {"name": "Images", "y": 3, "color": PRIMARY['green'], "height": 0.8},
    {"name": "Related Searches", "y": 1.5, "color": NEUTRAL['gray'], "height": 0.6},
]

x_center = 4
width = 6

all_x_positions = [x_center - width/2, x_center + width/2]
all_y_positions = []

for comp in components:
    y = comp['y']
    height = comp['height']
    all_y_positions.extend([y - height/2, y + height/2])
    
    # Component box (ZORDER_CONTENT)
    rect = Rectangle((x_center - width/2, y - height/2),
                    width, height,
                    facecolor=comp['color'], alpha=0.2,
                    edgecolor=comp['color'], linewidth=STYLE['line_widths']['normal'],
                    zorder=ZORDER_CONTENT)
    ax.add_patch(rect)
    
    # Component label INSIDE box (ZORDER_FOREGROUND)
    ax.text(x_center, y, comp['name'],
           ha='center', va='center',
           fontsize=FONTS['sizes']['body'],
           fontweight=FONTS['weights']['bold'],
           color=NEUTRAL['dark'],
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
output_path = Path(__file__).parent.parent / "visual-4-serp-anatomy.svg"
plt.savefig(output_path, format='svg', dpi=EXPORT_CONFIG['dpi'],
           bbox_inches=EXPORT_CONFIG['bbox_inches'], pad_inches=EXPORT_CONFIG['pad_inches'])
print(f"Generated: {output_path}")
plt.close()
