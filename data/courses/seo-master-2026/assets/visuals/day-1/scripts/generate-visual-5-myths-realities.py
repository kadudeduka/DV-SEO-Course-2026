"""
Generate Visual #5: SEO Myths vs Realities
Day 1, Chapter 1: SEO Fundamentals & the Modern Search Landscape

VISUAL GOAL:
Contrast common misconceptions with realities.
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

fig, ax = setup_figure(figsize=(12, 8), background_color=NEUTRAL['background'])

# Myths vs Realities pairs
myths_realities = [
    ("Instant results", "Long-term investment"),
    ("Rankings alone", "Multiple SERP features"),
    ("Traffic only KPI", "Business outcomes matter"),
    ("SEO is dead", "SEO is evolving"),
    ("Quick and easy", "Requires expertise")
]

y_start = 7
y_spacing = 1.2
box_width = 4.5
box_height = 0.8
x_myth = 2
x_reality = 7.5

all_x_positions = []
all_y_positions = []

# Draw comparison
for i, (myth, reality) in enumerate(myths_realities):
    y = y_start - i * y_spacing
    all_y_positions.append(y)
    
    # Myth box (red tint, ZORDER_CONTENT)
    myth_box = FancyBboxPatch((x_myth - box_width/2, y - box_height/2),
                              box_width, box_height,
                              boxstyle='round,pad=0.1',
                              facecolor=PRIMARY['red'], alpha=0.2,
                              edgecolor=PRIMARY['red'], linewidth=STYLE['line_widths']['normal'],
                              zorder=ZORDER_CONTENT)
    ax.add_patch(myth_box)
    all_x_positions.extend([x_myth - box_width/2, x_myth + box_width/2])
    
    # Myth text (ZORDER_FOREGROUND)
    ax.text(x_myth, y, f"Myth: {myth}",
           ha='center', va='center',
           fontsize=FONTS['sizes']['body'],
           color=NEUTRAL['dark'],
           zorder=ZORDER_FOREGROUND)
    
    # Arrow (ZORDER_BASE - behind boxes and text)
    arrow_start_x = x_myth + box_width/2 + STYLE['arrow_offsets']['from_box_edge']
    arrow_end_x = x_reality - box_width/2 - STYLE['arrow_offsets']['from_box_edge']
    ax.arrow(arrow_start_x, y, arrow_end_x - arrow_start_x, 0,
            head_width=0.15, head_length=0.2,
            fc=NEUTRAL['dark'], ec=NEUTRAL['dark'],
            linewidth=STYLE['line_widths']['normal'],
            zorder=ZORDER_BASE)
    
    # Reality box (green tint, ZORDER_CONTENT)
    reality_box = FancyBboxPatch((x_reality - box_width/2, y - box_height/2),
                                box_width, box_height,
                                boxstyle='round,pad=0.1',
                                facecolor=PRIMARY['green'], alpha=0.2,
                                edgecolor=PRIMARY['green'], linewidth=STYLE['line_widths']['normal'],
                                zorder=ZORDER_CONTENT)
    ax.add_patch(reality_box)
    all_x_positions.extend([x_reality - box_width/2, x_reality + box_width/2])
    
    # Reality text (ZORDER_FOREGROUND)
    ax.text(x_reality, y, f"Reality: {reality}",
           ha='center', va='center',
           fontsize=FONTS['sizes']['body'],
           color=NEUTRAL['dark'],
           zorder=ZORDER_FOREGROUND)

# Column headers (ZORDER_FOREGROUND)
header_y = y_start + 0.8
ax.text(x_myth, header_y, "Myth", ha='center', va='bottom',
       fontsize=FONTS['sizes']['subheading'],
       fontweight=FONTS['weights']['bold'],
       color=PRIMARY['red'],
       zorder=ZORDER_FOREGROUND)

ax.text(x_reality, header_y, "Reality", ha='center', va='bottom',
       fontsize=FONTS['sizes']['subheading'],
       fontweight=FONTS['weights']['bold'],
       color=PRIMARY['green'],
       zorder=ZORDER_FOREGROUND)
all_y_positions.append(header_y)

# Dynamic sizing with padding
padding = max(0.5, STYLE['text_offsets']['min_from_shape'])
x_min = min(all_x_positions) - padding
x_max = max(all_x_positions) + padding
y_min = min(all_y_positions) - box_height/2 - padding
y_max = max(all_y_positions) + padding

ax.set_xlim(x_min, x_max)
ax.set_ylim(y_min, y_max)
ax.axis('off')

# Save
output_path = Path(__file__).parent.parent / "visual-5-myths-realities.svg"
plt.savefig(output_path, format='svg', dpi=EXPORT_CONFIG['dpi'],
           bbox_inches=EXPORT_CONFIG['bbox_inches'], pad_inches=EXPORT_CONFIG['pad_inches'])
print(f"Generated: {output_path}")
plt.close()
