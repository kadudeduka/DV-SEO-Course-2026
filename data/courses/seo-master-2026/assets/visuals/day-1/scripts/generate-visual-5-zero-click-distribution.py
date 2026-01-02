"""
Generate Visual #5: Zero-Click Search Distribution
Day 1, Chapter 2: How Search Engines Work

VISUAL GOAL:
Show proportion of zero-click searches vs click searches
"""

import matplotlib.pyplot as plt
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent.parent / "_shared"))
from design_system import (
    PRIMARY, NEUTRAL, ACCENT, FONTS, STYLE, EXPORT_CONFIG,
    setup_figure, ZORDER_BACKGROUND, ZORDER_BASE, ZORDER_CONTENT, ZORDER_FOREGROUND
)

fig, ax = setup_figure(figsize=(8, 8), background_color=NEUTRAL['background'])

# Data: approximately 65% zero-click, 35% click
zero_click_pct = 65
click_pct = 35

# Create pie chart
sizes = [zero_click_pct, click_pct]
colors = [PRIMARY['orange'], PRIMARY['blue']]
labels = ['Zero-Click\nSearches', 'Click Searches']
explode = (0.05, 0)  # Slight separation

wedges, texts, autotexts = ax.pie(sizes, explode=explode, labels=labels, colors=colors,
                                  autopct='%1.1f%%',
                                  startangle=90,
                                  textprops={'fontsize': FONTS['sizes']['body'],
                                           'fontweight': FONTS['weights']['bold'],
                                           'color': 'white'})

# Style text
for autotext in autotexts:
    autotext.set_color('white')
    autotext.set_fontsize(FONTS['sizes']['body'])
    autotext.set_fontweight(FONTS['weights']['bold'])

for text in texts:
    text.set_fontsize(FONTS['sizes']['subheading'])
    text.set_fontweight(FONTS['weights']['bold'])
    text.set_color(NEUTRAL['dark'])

ax.set_aspect('equal')
ax.axis('off')

# Save
output_path = Path(__file__).parent.parent / "visual-5-zero-click-distribution.svg"
plt.savefig(output_path, format='svg', dpi=EXPORT_CONFIG['dpi'],
           bbox_inches=EXPORT_CONFIG['bbox_inches'], pad_inches=EXPORT_CONFIG['pad_inches'])
print(f"Generated: {output_path}")
plt.close()
