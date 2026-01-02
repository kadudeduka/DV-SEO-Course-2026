"""
Generate Visual #1: SERP Intent Signals
Day 1, Chapter 4: Intent Analysis & Keyword Mapping

VISUAL GOAL:
Show how SERP components signal intent

FIXED: Uses explicit bounds instead of 'tight' to prevent text clipping
"""

import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent.parent / "_shared"))
from design_system import (
    PRIMARY, NEUTRAL, ACCENT, FONTS, STYLE, EXPORT_CONFIG,
    setup_figure, ZORDER_BACKGROUND, ZORDER_BASE, ZORDER_CONTENT, ZORDER_FOREGROUND,
    get_text_height, calculate_text_bounds
)

fig, ax = setup_figure(figsize=(8, 10), background_color=NEUTRAL['background'])

# SERP components with intent signals
components_data = [
    {"name": "Featured Snippet", "intent": "Informational", "height": 0.8, "color": PRIMARY['blue']},
    {"name": "Shopping Ads", "intent": "Transactional", "height": 0.8, "color": PRIMARY['green']},
    {"name": "Blog Posts", "intent": "Informational", "height": 1, "color": PRIMARY['blue']},
    {"name": "Product Pages", "intent": "Transactional", "height": 1, "color": PRIMARY['green']},
    {"name": "People Also Ask", "intent": "Informational", "height": 0.8, "color": PRIMARY['purple']},
]

# Constants for layout
x_center = 4
width = 6

# Text heights
TEXT_HEIGHT_BODY = get_text_height(FONTS['sizes']['body'])
TEXT_HEIGHT_CAPTION = get_text_height(FONTS['sizes']['caption'])

# Spacing constants
CLEARANCE_ABOVE = STYLE['text_offsets']['above_box']  # Space between box top and label
CLEARANCE_BELOW = STYLE['text_offsets']['below_box']  # Space between box bottom and label
MIN_SPACING = 0.4  # Minimum space between elements

# Calculate positions from top to bottom
current_y = 9.5  # Start from top
all_x_positions = [x_center - width/2, x_center + width/2]
all_y_positions = []

components = []

for comp_data in components_data:
    # Calculate positions for this component
    
    # 1. Name label (above box, va='bottom' means text extends upward)
    name_y = current_y
    name_top, name_bottom = calculate_text_bounds(name_y, FONTS['sizes']['body'], 'bottom')
    all_y_positions.append(name_top)  # Track top of text
    
    # 2. Box (below name label)
    box_top = name_bottom - CLEARANCE_ABOVE
    box_bottom = box_top - comp_data['height']
    box_center_y = (box_top + box_bottom) / 2
    all_y_positions.extend([box_top, box_bottom])
    
    # 3. Intent label (below box, va='top' means text extends downward)
    intent_y = box_bottom - CLEARANCE_BELOW
    intent_top, intent_bottom = calculate_text_bounds(intent_y, FONTS['sizes']['caption'], 'top')
    all_y_positions.append(intent_bottom)  # Track bottom of text
    
    # Store component info
    components.append({
        'data': comp_data,
        'name_y': name_y,
        'name_top': name_top,
        'name_bottom': name_bottom,
        'box_center_y': box_center_y,
        'box_top': box_top,
        'box_bottom': box_bottom,
        'intent_y': intent_y,
        'intent_top': intent_top,
        'intent_bottom': intent_bottom
    })
    
    # Move to next component (start below intent label with spacing)
    current_y = intent_bottom - MIN_SPACING

# Draw components
for comp in components:
    comp_data = comp['data']
    
    # Component box (ZORDER_CONTENT)
    rect = Rectangle((x_center - width/2, comp['box_bottom']),
                    width, comp_data['height'],
                    facecolor=comp_data['color'], alpha=0.2,
                    edgecolor=comp_data['color'], linewidth=STYLE['line_widths']['normal'],
                    zorder=ZORDER_CONTENT)
    ax.add_patch(rect)
    
    # Component name ABOVE box
    ax.text(x_center, comp['name_y'], comp_data['name'],
           ha='center', va='bottom',
           fontsize=FONTS['sizes']['body'],
           fontweight=FONTS['weights']['bold'],
           color=NEUTRAL['dark'],
           zorder=ZORDER_FOREGROUND)
    
    # Intent signal BELOW box
    ax.text(x_center, comp['intent_y'], f"→ {comp_data['intent']} Intent",
           ha='center', va='top',
           fontsize=FONTS['sizes']['caption'],
           color=comp_data['color'],
           fontweight=FONTS['weights']['bold'],
           zorder=ZORDER_FOREGROUND)

# Calculate bounds with GENEROUS padding to ensure all text is visible
# Add extra padding for text rendering margins (fonts can extend slightly beyond metrics)
padding = 1.5  # Generous padding to account for font rendering

x_min = min(all_x_positions) - padding
x_max = max(all_x_positions) + padding
y_min = min(all_y_positions) - padding
y_max = max(all_y_positions) + padding

# Ensure minimum reasonable bounds with extra margin
x_min = min(x_min, -1.5)  # Extra margin on left
x_max = max(x_max, width + 1.5)  # Extra margin on right
y_min = min(y_min, -1.0)  # Extra margin on bottom for text
y_max = max(y_max, 11.0)  # Extra margin on top for text

# Set explicit limits BEFORE saving
ax.set_xlim(x_min, x_max)
ax.set_ylim(y_min, y_max)
ax.axis('off')

# Save WITHOUT bbox_inches='tight' to use our explicit limits
# This ensures all content within our calculated bounds is included
output_path = Path(__file__).parent.parent / "visual-1-serp-intent-signals.svg"
plt.savefig(output_path, format='svg', dpi=EXPORT_CONFIG['dpi'],
           bbox_inches=None,  # Use explicit limits instead of tight
           pad_inches=0.0,  # No additional padding since we calculated it
           facecolor='white')
print(f"Generated: {output_path}")
print(f"Canvas bounds: x=[{x_min:.2f}, {x_max:.2f}], y=[{y_min:.2f}, {y_max:.2f}]")
print(f"Content range: x=[{min(all_x_positions):.2f}, {max(all_x_positions):.2f}], y=[{min(all_y_positions):.2f}, {max(all_y_positions):.2f}]")
plt.close()
