"""
Generate Visual #2: Keyword-to-Page Mapping Framework
Day 1, Chapter 4: Intent Analysis & Keyword Mapping

VISUAL GOAL:
Show decision framework for matching keywords to page types
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

# Decision tree: Keyword → Intent → Page Type
keyword_x, keyword_y = 5, 7

# Intent branches
intents = [
    {"name": "Informational", "x": 2, "y": 5, "color": PRIMARY['blue']},
    {"name": "Navigational", "x": 5, "y": 5, "color": PRIMARY['purple']},
    {"name": "Commercial", "x": 8, "y": 5, "color": PRIMARY['orange']},
    {"name": "Transactional", "x": 5, "y": 3, "color": PRIMARY['green']},
]

# Page types
page_types = {
    "Informational": [{"name": "Blog Post", "x": 2, "y": 1}],
    "Navigational": [{"name": "Homepage", "x": 5, "y": 1}],
    "Commercial": [{"name": "Comparison Page", "x": 8, "y": 1}],
    "Transactional": [{"name": "Product Page", "x": 5, "y": 0.5}],
}

box_width = 2
box_height = 0.8
all_x_positions = [keyword_x]
all_y_positions = [keyword_y]

# Keyword box (ZORDER_CONTENT)
keyword_box = FancyBboxPatch((keyword_x - box_width, keyword_y - box_height/2),
                            box_width * 2, box_height,
                            boxstyle='round,pad=0.2',
                            facecolor=ACCENT['yellow'], alpha=0.4,
                            edgecolor=ACCENT['yellow'], linewidth=STYLE['line_widths']['thick'],
                            zorder=ZORDER_CONTENT)
ax.add_patch(keyword_box)
all_x_positions.extend([keyword_x - box_width, keyword_x + box_width])
all_y_positions.extend([keyword_y - box_height/2, keyword_y + box_height/2])

# Keyword text (ZORDER_FOREGROUND)
ax.text(keyword_x, keyword_y, "Keyword",
       ha='center', va='center',
       fontsize=FONTS['sizes']['subheading'],
       fontweight=FONTS['weights']['bold'],
       color=NEUTRAL['dark'],
       zorder=ZORDER_FOREGROUND)

# Draw intents
for intent in intents:
    x, y = intent['x'], intent['y']
    all_x_positions.extend([x - box_width/2, x + box_width/2])
    all_y_positions.extend([y - box_height/2, y + box_height/2])
    
    # Intent box (ZORDER_CONTENT)
    intent_box = FancyBboxPatch((x - box_width/2, y - box_height/2),
                               box_width, box_height,
                               boxstyle='round,pad=0.2',
                               facecolor=intent['color'], alpha=0.3,
                               edgecolor=intent['color'], linewidth=STYLE['line_widths']['normal'],
                               zorder=ZORDER_CONTENT)
    ax.add_patch(intent_box)
    
    # Intent text INSIDE box (ZORDER_FOREGROUND)
    ax.text(x, y, intent['name'],
           ha='center', va='center',
           fontsize=FONTS['sizes']['body'],
           color=NEUTRAL['dark'],
           zorder=ZORDER_FOREGROUND)
    
    # Arrow from keyword (ZORDER_BASE)
    arrow_start_y = keyword_y - box_height/2 - STYLE['arrow_offsets']['from_box_edge']
    arrow_end_y = y + box_height/2 + STYLE['arrow_offsets']['from_box_edge']
    arrow = FancyArrowPatch((keyword_x, arrow_start_y),
                           (x, arrow_end_y),
                           arrowstyle='->',
                           linewidth=STYLE['line_widths']['normal'],
                           color=NEUTRAL['dark'],
                           zorder=ZORDER_BASE)
    ax.add_patch(arrow)
    
    # Page types
    for page in page_types[intent['name']]:
        px, py = page['x'], page['y']
        all_x_positions.extend([px - box_width/2, px + box_width/2])
        all_y_positions.extend([py - box_height/2, py + box_height/2])
        
        # Page box (ZORDER_CONTENT)
        page_box = FancyBboxPatch((px - box_width/2, py - box_height/2),
                                 box_width, box_height,
                                 boxstyle='round,pad=0.15',
                                 facecolor=intent['color'], alpha=0.2,
                                 edgecolor=intent['color'], linewidth=STYLE['line_widths']['thin'],
                                 zorder=ZORDER_CONTENT)
        ax.add_patch(page_box)
        
        # Page text INSIDE box (ZORDER_FOREGROUND)
        ax.text(px, py, page['name'],
               ha='center', va='center',
               fontsize=FONTS['sizes']['caption'],
               color=NEUTRAL['dark'],
               zorder=ZORDER_FOREGROUND)
        
        # Arrow from intent (ZORDER_BASE)
        arrow2_start_y = y - box_height/2 - STYLE['arrow_offsets']['from_box_edge']
        arrow2_end_y = py + box_height/2 + STYLE['arrow_offsets']['from_box_edge']
        arrow2 = FancyArrowPatch((x, arrow2_start_y),
                                (px, arrow2_end_y),
                                arrowstyle='->',
                                linewidth=STYLE['line_widths']['thin'],
                                color=NEUTRAL['gray'],
                                alpha=0.7,
                                zorder=ZORDER_BASE)
        ax.add_patch(arrow2)

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
output_path = Path(__file__).parent.parent / "visual-2-keyword-page-mapping.svg"
plt.savefig(output_path, format='svg', dpi=EXPORT_CONFIG['dpi'],
           bbox_inches=EXPORT_CONFIG['bbox_inches'], pad_inches=EXPORT_CONFIG['pad_inches'])
print(f"Generated: {output_path}")
plt.close()
