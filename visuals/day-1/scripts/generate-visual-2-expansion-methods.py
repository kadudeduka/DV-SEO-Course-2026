"""
Generate Visual #2: Keyword Expansion Methods
Day 1, Chapter 3: Keyword Research Foundations

VISUAL GOAL:
Show different expansion methods and how they work together
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

fig, ax = setup_figure(figsize=(10, 8), background_color=NEUTRAL['background'])

# Seed keyword at center
seed_x, seed_y = 5, 4

# Expansion methods
methods = [
    {"name": "Related\nSearches", "x": 2, "y": 6, "color": PRIMARY['blue']},
    {"name": "Autocomplete", "x": 8, "y": 6, "color": PRIMARY['green']},
    {"name": "People Also\nAsk", "x": 2, "y": 2, "color": PRIMARY['purple']},
    {"name": "LSI Keywords", "x": 8, "y": 2, "color": PRIMARY['orange']},
]

box_width = 3
box_height = 1.2

all_x_positions = [seed_x]
all_y_positions = [seed_y]

# Seed keyword box (ZORDER_CONTENT)
seed_box = FancyBboxPatch((seed_x - 1.5, seed_y - 0.5),
                         3, 1,
                         boxstyle='round,pad=0.2',
                         facecolor=ACCENT['yellow'], alpha=0.4,
                         edgecolor=ACCENT['yellow'], linewidth=STYLE['line_widths']['thick'],
                         zorder=ZORDER_CONTENT)
ax.add_patch(seed_box)
all_x_positions.extend([seed_x - 1.5, seed_x + 1.5])
all_y_positions.extend([seed_y - 0.5, seed_y + 0.5])

# Seed keyword text (ZORDER_FOREGROUND)
ax.text(seed_x, seed_y, "Seed Keyword",
       ha='center', va='center',
       fontsize=FONTS['sizes']['subheading'],
       fontweight=FONTS['weights']['bold'],
       color=NEUTRAL['dark'],
       zorder=ZORDER_FOREGROUND)

# Draw expansion methods
for method in methods:
    x, y = method['x'], method['y']
    all_x_positions.extend([x - box_width/2, x + box_width/2])
    all_y_positions.extend([y - box_height/2, y + box_height/2])
    
    # Method box (ZORDER_CONTENT)
    method_box = FancyBboxPatch((x - box_width/2, y - box_height/2),
                               box_width, box_height,
                              boxstyle='round,pad=0.2',
                              facecolor=method['color'], alpha=0.3,
                              edgecolor=method['color'], linewidth=STYLE['line_widths']['normal'],
                              zorder=ZORDER_CONTENT)
    ax.add_patch(method_box)
    
    # Method text INSIDE box (ZORDER_FOREGROUND)
    ax.text(x, y, method['name'],
           ha='center', va='center',
           fontsize=FONTS['sizes']['body'],
           color=NEUTRAL['dark'],
           zorder=ZORDER_FOREGROUND)
    
    # Connection arrow (ZORDER_BASE - behind boxes)
    # Calculate arrow endpoints with proper offsets
    if y > seed_y:  # Above seed
        arrow_start_y = seed_y + 0.5 + STYLE['arrow_offsets']['from_box_edge']
        arrow_end_y = y - box_height/2 - STYLE['arrow_offsets']['from_box_edge']
    else:  # Below seed
        arrow_start_y = seed_y - 0.5 - STYLE['arrow_offsets']['from_box_edge']
        arrow_end_y = y + box_height/2 + STYLE['arrow_offsets']['from_box_edge']
    
    # Adjust x based on position
    if x < seed_x:  # Left of seed
        arrow_start_x = seed_x - 1.5 + STYLE['arrow_offsets']['from_box_edge']
        arrow_end_x = x + box_width/2 - STYLE['arrow_offsets']['from_box_edge']
    else:  # Right of seed
        arrow_start_x = seed_x + 1.5 - STYLE['arrow_offsets']['from_box_edge']
        arrow_end_x = x - box_width/2 + STYLE['arrow_offsets']['from_box_edge']
    
    arrow = FancyArrowPatch((arrow_start_x, arrow_start_y),
                           (arrow_end_x, arrow_end_y),
                           arrowstyle='->',
                           linewidth=STYLE['line_widths']['normal'],
                           color=NEUTRAL['gray'],
                           alpha=0.5,
                           zorder=ZORDER_BASE)
    ax.add_patch(arrow)

# Dynamic sizing with padding
padding = max(0.5, STYLE['text_offsets']['min_from_shape'])
x_min = min(all_x_positions) - box_width/2 - padding
x_max = max(all_x_positions) + box_width/2 + padding
y_min = min(all_y_positions) - box_height/2 - padding
y_max = max(all_y_positions) + box_height/2 + padding

ax.set_xlim(x_min, x_max)
ax.set_ylim(y_min, y_max)
ax.axis('off')

# Save
output_path = Path(__file__).parent.parent / "visual-2-expansion-methods.svg"
plt.savefig(output_path, format='svg', dpi=EXPORT_CONFIG['dpi'],
           bbox_inches=EXPORT_CONFIG['bbox_inches'], pad_inches=EXPORT_CONFIG['pad_inches'])
print(f"Generated: {output_path}")
plt.close()
