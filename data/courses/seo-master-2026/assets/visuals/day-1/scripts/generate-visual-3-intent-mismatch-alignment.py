"""
Generate Visual #3: Intent Mismatch vs Alignment
Day 1, Chapter 4: Intent Analysis & Keyword Mapping

VISUAL GOAL:
Show what intent mismatch looks like vs proper alignment
"""

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent.parent / "_shared"))
from design_system import (
    PRIMARY, NEUTRAL, ACCENT, FONTS, STYLE, EXPORT_CONFIG,
    setup_figure, ZORDER_BACKGROUND, ZORDER_BASE, ZORDER_CONTENT, ZORDER_FOREGROUND
)

fig, ax = setup_figure(figsize=(12, 7), background_color=NEUTRAL['background'])

# Comparison: Mismatch vs Alignment
scenarios = [
    {
        "title": "Mismatch",
        "query": "buy running shoes",
        "content": "Blog: How to Choose Shoes",
        "result": "Poor Performance",
        "x": 3,
        "query_color": PRIMARY['green'],
        "content_color": PRIMARY['blue'],
        "result_color": PRIMARY['red']
    },
    {
        "title": "Alignment",
        "query": "buy running shoes",
        "content": "Product Page: Running Shoes",
        "result": "Good Performance",
        "x": 9,
        "query_color": PRIMARY['green'],
        "content_color": PRIMARY['green'],
        "result_color": PRIMARY['green']
    }
]

box_width = 3.5
box_height = 1
# Increased vertical spacing to prevent overlap
# Space between boxes: box_height + clearance (min 0.5)
box_spacing = box_height + max(STYLE['text_offsets']['min_from_shape'], 0.5)
y_title = 6.5
y_query = 4.5
y_content = y_query - box_spacing  # 3.5
y_result = y_content - box_spacing  # 2

all_x_positions = []
all_y_positions = []

for scenario in scenarios:
    x = scenario['x']
    all_x_positions.extend([x - box_width/2, x + box_width/2])
    
    # Title (ZORDER_FOREGROUND)
    ax.text(x, y_title, scenario['title'],
           ha='center', va='bottom',
           fontsize=FONTS['sizes']['subheading'],
           fontweight=FONTS['weights']['bold'],
           color=NEUTRAL['dark'],
           zorder=ZORDER_FOREGROUND)
    all_y_positions.append(y_title)
    
    # Query box (ZORDER_CONTENT)
    query_box = FancyBboxPatch((x - box_width/2, y_query - box_height/2),
                              box_width, box_height,
                              boxstyle='round,pad=0.2',
                              facecolor=scenario['query_color'], alpha=0.2,
                              edgecolor=scenario['query_color'], linewidth=STYLE['line_widths']['normal'],
                              zorder=ZORDER_CONTENT)
    ax.add_patch(query_box)
    all_y_positions.extend([y_query - box_height/2, y_query + box_height/2])
    
    # Query text (ZORDER_FOREGROUND)
    ax.text(x, y_query, f"Query: {scenario['query']}",
           ha='center', va='center',
           fontsize=FONTS['sizes']['body'],
           color=NEUTRAL['dark'],
           zorder=ZORDER_FOREGROUND)
    
    # Arrow (ZORDER_BASE) - pointing DOWN from query to content
    # Arrow starts at bottom of query box and ends at top of content box
    arrow_start_y = y_query - box_height/2 - STYLE['arrow_offsets']['from_box_edge']
    arrow_end_y = y_content + box_height/2 + STYLE['arrow_offsets']['from_box_edge']
    # Arrow goes DOWN (negative dy), so we need to ensure dy is negative
    dy = arrow_end_y - arrow_start_y  # This will be negative (going down)
    ax.arrow(x, arrow_start_y, 0, dy,
            head_width=0.2, head_length=0.15,
            fc=NEUTRAL['dark'], ec=NEUTRAL['dark'],
            linewidth=STYLE['line_widths']['normal'],
            zorder=ZORDER_BASE)
    
    # Content box (ZORDER_CONTENT)
    content_box = FancyBboxPatch((x - box_width/2, y_content - box_height/2),
                                box_width, box_height,
                                boxstyle='round,pad=0.2',
                                facecolor=scenario['content_color'], alpha=0.2,
                                edgecolor=scenario['content_color'], linewidth=STYLE['line_widths']['normal'],
                                zorder=ZORDER_CONTENT)
    ax.add_patch(content_box)
    all_y_positions.extend([y_content - box_height/2, y_content + box_height/2])
    
    # Content text (ZORDER_FOREGROUND)
    ax.text(x, y_content, scenario['content'],
           ha='center', va='center',
           fontsize=FONTS['sizes']['body'],
           color=NEUTRAL['dark'],
           zorder=ZORDER_FOREGROUND)
    
    # Arrow (ZORDER_BASE) - pointing DOWN from content to result
    # Arrow starts at bottom of content box and ends at top of result box
    arrow_start_y = y_content - box_height/2 - STYLE['arrow_offsets']['from_box_edge']
    arrow_end_y = y_result + box_height/2 + STYLE['arrow_offsets']['from_box_edge']
    # Arrow goes DOWN (negative dy), so we need to ensure dy is negative
    dy = arrow_end_y - arrow_start_y  # This will be negative (going down)
    ax.arrow(x, arrow_start_y, 0, dy,
            head_width=0.2, head_length=0.15,
            fc=NEUTRAL['dark'], ec=NEUTRAL['dark'],
            linewidth=STYLE['line_widths']['normal'],
            zorder=ZORDER_BASE)
    
    # Result box (ZORDER_CONTENT)
    result_box = FancyBboxPatch((x - box_width/2, y_result - box_height/2),
                               box_width, box_height,
                               boxstyle='round,pad=0.2',
                               facecolor=scenario['result_color'], alpha=0.3,
                               edgecolor=scenario['result_color'], linewidth=STYLE['line_widths']['normal'],
                               zorder=ZORDER_CONTENT)
    ax.add_patch(result_box)
    all_y_positions.extend([y_result - box_height/2, y_result + box_height/2])
    
    # Result text (ZORDER_FOREGROUND)
    ax.text(x, y_result, scenario['result'],
           ha='center', va='center',
           fontsize=FONTS['sizes']['body'],
           fontweight=FONTS['weights']['bold'],
           color=NEUTRAL['dark'],
           zorder=ZORDER_FOREGROUND)

# Dynamic sizing with padding
padding = max(0.5, STYLE['text_offsets']['min_from_shape'])
x_min = min(all_x_positions) - box_width/2 - padding
x_max = max(all_x_positions) + box_width/2 + padding
y_min = min(all_y_positions) - box_height/2 - padding
y_max = max(all_y_positions) + padding

ax.set_xlim(x_min, x_max)
ax.set_ylim(y_min, y_max)
ax.axis('off')

# Save
output_path = Path(__file__).parent.parent / "visual-3-intent-mismatch-alignment.svg"
plt.savefig(output_path, format='svg', dpi=EXPORT_CONFIG['dpi'],
           bbox_inches=EXPORT_CONFIG['bbox_inches'], pad_inches=EXPORT_CONFIG['pad_inches'])
print(f"Generated: {output_path}")
plt.close()
