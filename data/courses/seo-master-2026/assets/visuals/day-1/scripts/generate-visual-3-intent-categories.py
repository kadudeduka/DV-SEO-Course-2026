"""
Generate Visual #3: Search Intent Categories
Day 1, Chapter 2: How Search Engines Work

VISUAL GOAL:
Show the four primary intent categories with examples
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

# Four intent categories
categories = [
    {"name": "Informational", "examples": ["how to...", "what is..."], "x": 3, "y": 6, "color": PRIMARY['blue']},
    {"name": "Navigational", "examples": ["facebook", "youtube login"], "x": 9, "y": 6, "color": PRIMARY['purple']},
    {"name": "Commercial", "examples": ["best...", "compare..."], "x": 3, "y": 2, "color": PRIMARY['orange']},
    {"name": "Transactional", "examples": ["buy...", "download..."], "x": 9, "y": 2, "color": PRIMARY['green']}
]

box_width = 3.5
box_height = 2
all_x_positions = []
all_y_positions = []

for cat in categories:
    x, y = cat['x'], cat['y']
    all_x_positions.extend([x - box_width/2, x + box_width/2])
    all_y_positions.extend([y - box_height/2, y + box_height/2])
    
    # Category box (ZORDER_CONTENT)
    box = FancyBboxPatch((x - box_width/2, y - box_height/2),
                        box_width, box_height,
                        boxstyle='round,pad=0.2',
                        facecolor=cat['color'], alpha=0.2,
                        edgecolor=cat['color'], linewidth=STYLE['line_widths']['normal'],
                        zorder=ZORDER_CONTENT)
    ax.add_patch(box)
    
    # Category name ABOVE box with proper spacing (ZORDER_FOREGROUND)
    name_y = y + box_height/2 + STYLE['text_offsets']['above_box']
    ax.text(x, name_y, cat['name'],
           ha='center', va='bottom',
           fontsize=FONTS['sizes']['subheading'],
           fontweight=FONTS['weights']['bold'],
           color=NEUTRAL['dark'],
           zorder=ZORDER_FOREGROUND)
    all_y_positions.append(name_y)
    
    # Examples INSIDE box (ZORDER_FOREGROUND)
    examples_text = "\n".join([f"• {ex}" for ex in cat['examples']])
    ax.text(x, y - 0.3, examples_text,
           ha='center', va='center',
           fontsize=FONTS['sizes']['body'],
           color=NEUTRAL['gray_dark'],
           zorder=ZORDER_FOREGROUND)

# Dynamic sizing with padding
padding = max(0.5, STYLE['text_offsets']['min_from_shape'])
x_min = min(all_x_positions) - box_width/2 - padding
x_max = max(all_x_positions) + box_width/2 + padding
y_min = min(all_y_positions) - padding
y_max = max(all_y_positions) + padding

ax.set_xlim(x_min, x_max)
ax.set_ylim(y_min, y_max)
ax.axis('off')

# Save
output_path = Path(__file__).parent.parent / "visual-3-intent-categories.svg"
plt.savefig(output_path, format='svg', dpi=EXPORT_CONFIG['dpi'],
           bbox_inches=EXPORT_CONFIG['bbox_inches'], pad_inches=EXPORT_CONFIG['pad_inches'])
print(f"Generated: {output_path}")
plt.close()
