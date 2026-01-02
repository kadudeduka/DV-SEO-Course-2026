"""
Generate Visual #4: Search Ecosystem Components
Day 1, Chapter 1: SEO Fundamentals & the Modern Search Landscape

VISUAL GOAL:
Show how organic search, paid ads, social, and AI-driven discovery coexist.
"""

import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyBboxPatch
import sys
import math
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent.parent / "_shared"))
from design_system import (
    PRIMARY, NEUTRAL, ACCENT, FONTS, STYLE, EXPORT_CONFIG,
    setup_figure, ZORDER_BACKGROUND, ZORDER_BASE, ZORDER_CONTENT, ZORDER_FOREGROUND
)

fig, ax = setup_figure(figsize=(10, 8), background_color=NEUTRAL['background'])

# Ecosystem components positions (circular layout)
center_x, center_y = 5, 4
radius_circle = 2.5

components = [
    {
        'name': 'Organic Search\n(SEO)',
        'angle': 0,  # Top
        'color': PRIMARY['blue']
    },
    {
        'name': 'Paid Advertising',
        'angle': 90,  # Right
        'color': PRIMARY['red']
    },
    {
        'name': 'Social Media',
        'angle': 180,  # Bottom
        'color': PRIMARY['purple']
    },
    {
        'name': 'AI-Driven Discovery',
        'angle': 270,  # Left
        'color': PRIMARY['green']
    }
]

all_x, all_y = [center_x], [center_y]
box_width = 2.4
box_height = 1.2

# Draw components
for comp in components:
    angle_rad = math.radians(comp['angle'])
    x = center_x + radius_circle * math.cos(angle_rad)
    y = center_y + radius_circle * math.sin(angle_rad)
    
    # Adjust for box positioning
    if comp['angle'] == 0:  # Top
        box_y = y - box_height/2
        all_y.append(box_y - box_height/2)
    elif comp['angle'] == 90:  # Right
        box_x = x - box_width/2
        all_x.append(box_x - box_width/2)
    elif comp['angle'] == 180:  # Bottom
        box_y = y + box_height/2
        all_y.append(box_y + box_height/2)
    else:  # Left
        box_x = x + box_width/2
        all_x.append(box_x + box_width/2)
    
    all_x.append(x)
    all_y.append(y)
    
    # Component box (ZORDER_CONTENT)
    box = FancyBboxPatch((x - box_width/2, y - box_height/2), box_width, box_height,
                        boxstyle='round,pad=0.2',
                        facecolor=comp['color'], alpha=0.3,
                        edgecolor=comp['color'], linewidth=STYLE['line_widths']['normal'],
                        zorder=ZORDER_CONTENT)
    ax.add_patch(box)
    
    # Component label (ZORDER_FOREGROUND)
    ax.text(x, y, comp['name'],
           ha='center', va='center',
           fontsize=FONTS['sizes']['body'],
           fontweight=FONTS['weights']['bold'],
           color=NEUTRAL['dark'],
           zorder=ZORDER_FOREGROUND)

# Connection lines (subtle, ZORDER_BASE - behind boxes)
for comp in components:
    angle_rad = math.radians(comp['angle'])
    x = center_x + radius_circle * math.cos(angle_rad)
    y = center_y + radius_circle * math.sin(angle_rad)
    ax.plot([center_x, x], [center_y, y],
           color=NEUTRAL['gray_light'],
           linewidth=STYLE['line_widths']['thin'],
           alpha=0.3,
           zorder=ZORDER_BASE)

# Center label (optional - search ecosystem)
ax.text(center_x, center_y, "Search\nEcosystem",
       ha='center', va='center',
       fontsize=FONTS['sizes']['caption'],
       color=NEUTRAL['gray'],
       zorder=ZORDER_FOREGROUND)

# Dynamic sizing with padding
padding = max(0.5, STYLE['text_offsets']['min_from_shape'])
x_min = min(all_x) - box_width/2 - padding
x_max = max(all_x) + box_width/2 + padding
y_min = min(all_y) - box_height/2 - padding
y_max = max(all_y) + box_height/2 + padding

ax.set_xlim(x_min, x_max)
ax.set_ylim(y_min, y_max)
ax.axis('off')

# Save
output_path = Path(__file__).parent.parent / "visual-4-search-ecosystem-components.svg"
plt.savefig(output_path, format='svg', dpi=EXPORT_CONFIG['dpi'],
           bbox_inches=EXPORT_CONFIG['bbox_inches'], pad_inches=EXPORT_CONFIG['pad_inches'])
print(f"Generated: {output_path}")
plt.close()
