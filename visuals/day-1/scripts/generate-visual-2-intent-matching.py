"""
Generate Visual #2: Intent Matching
Day 1, Chapter 2: How Search Engines Work

VISUAL GOAL:
Show how search queries match to content based on intent
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

fig, ax = setup_figure(figsize=(10, 7), background_color=NEUTRAL['background'])

# Query and matching content
query_box_x, query_box_y = 5, 5
content_box_x, content_box_y = 5, 2

box_width = 4
box_height = 1

all_x_positions = []
all_y_positions = []

# Query box (ZORDER_CONTENT)
query_box = FancyBboxPatch((query_box_x - box_width/2, query_box_y - box_height/2),
                          box_width, box_height,
                         boxstyle='round,pad=0.2',
                         facecolor=PRIMARY['blue'], alpha=0.3,
                         edgecolor=PRIMARY['blue'], linewidth=STYLE['line_widths']['normal'],
                         zorder=ZORDER_CONTENT)
ax.add_patch(query_box)
all_x_positions.extend([query_box_x - box_width/2, query_box_x + box_width/2])
all_y_positions.extend([query_box_y - box_height/2, query_box_y + box_height/2])

# Query text (ZORDER_FOREGROUND)
ax.text(query_box_x, query_box_y, "Search Query\n(Intent)",
       ha='center', va='center',
       fontsize=FONTS['sizes']['body'],
       fontweight=FONTS['weights']['bold'],
       color=NEUTRAL['dark'],
       zorder=ZORDER_FOREGROUND)

# Matching arrow (ZORDER_BASE - behind boxes)
arrow_start_y = query_box_y - box_height/2 - STYLE['arrow_offsets']['from_box_edge']
arrow_end_y = content_box_y + box_height/2 + STYLE['arrow_offsets']['from_box_edge']
arrow = FancyArrowPatch((query_box_x, arrow_start_y),
                       (content_box_x, arrow_end_y),
                       arrowstyle='->',
                       linewidth=STYLE['line_widths']['thick'],
                       color=PRIMARY['green'],
                       zorder=ZORDER_BASE)
ax.add_patch(arrow)

# "Matches" label beside arrow (ZORDER_FOREGROUND)
matches_label_y = (query_box_y + content_box_y) / 2
ax.text(query_box_x + 1.5, matches_label_y, "Matches",
       ha='center', va='center',
       fontsize=FONTS['sizes']['body'],
       color=PRIMARY['green'],
       fontweight=FONTS['weights']['bold'],
       zorder=ZORDER_FOREGROUND)

# Content box (ZORDER_CONTENT)
content_box = FancyBboxPatch((content_box_x - box_width/2, content_box_y - box_height/2),
                            box_width, box_height,
                           boxstyle='round,pad=0.2',
                           facecolor=PRIMARY['green'], alpha=0.3,
                           edgecolor=PRIMARY['green'], linewidth=STYLE['line_widths']['normal'],
                           zorder=ZORDER_CONTENT)
ax.add_patch(content_box)
all_x_positions.extend([content_box_x - box_width/2, content_box_x + box_width/2])
all_y_positions.extend([content_box_y - box_height/2, content_box_y + box_height/2])

# Content text (ZORDER_FOREGROUND)
ax.text(content_box_x, content_box_y, "Content\n(Aligned with Intent)",
       ha='center', va='center',
       fontsize=FONTS['sizes']['body'],
       fontweight=FONTS['weights']['bold'],
       color=NEUTRAL['dark'],
       zorder=ZORDER_FOREGROUND)

# Dynamic sizing with padding
padding = max(0.5, STYLE['text_offsets']['min_from_shape'])
x_min = min(all_x_positions) - padding - 1
x_max = max(all_x_positions) + padding + 1
y_min = min(all_y_positions) - padding
y_max = max(all_y_positions) + padding

ax.set_xlim(x_min, x_max)
ax.set_ylim(y_min, y_max)
ax.axis('off')

# Save
output_path = Path(__file__).parent.parent / "visual-2-intent-matching.svg"
plt.savefig(output_path, format='svg', dpi=EXPORT_CONFIG['dpi'],
           bbox_inches=EXPORT_CONFIG['bbox_inches'], pad_inches=EXPORT_CONFIG['pad_inches'])
print(f"Generated: {output_path}")
plt.close()
