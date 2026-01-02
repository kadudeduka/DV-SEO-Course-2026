"""
Generate Visual #1: The Global Search Landscape
Day 1, Chapter 1: SEO Fundamentals & the Modern Search Landscape

VISUAL GOAL:
Help learners intuitively grasp the massive scale of daily searches happening worldwide.
"""

import matplotlib.pyplot as plt
import numpy as np
import sys
import os
from pathlib import Path

# Add shared design system to path
sys.path.append(str(Path(__file__).parent.parent.parent / "_shared"))
from design_system import (
    PRIMARY, NEUTRAL, ACCENT, FONTS, STYLE, EXPORT_CONFIG,
    setup_figure, ZORDER_BACKGROUND, ZORDER_BASE, ZORDER_CONTENT, ZORDER_FOREGROUND
)

fig, ax = setup_figure(figsize=(10, 6), background_color=NEUTRAL['background'])

# Create scatter plot showing search volume scale
# Represent billions of searches with density
np.random.seed(42)

# Simulate search volume distribution (billions per day globally)
search_volume = 8.5  # Billions of searches per day globally

# Create scatter plot with density gradient
n_points = 5000
x = np.random.normal(0, 1, n_points)
y = np.random.normal(0, 1, n_points)

# Density-based coloring
density = np.exp(-(x**2 + y**2) / 2)

# Plot with color gradient (darker = more searches)
scatter = ax.scatter(x, y, c=density, cmap='Blues', s=20, alpha=0.6, 
                     edgecolors='none', zorder=ZORDER_CONTENT)

# Add scale indicator text
ax.text(0, -2.5, f"Billions of searches daily", 
        ha='center', va='top',
        fontsize=FONTS['sizes']['heading'],
        fontweight=FONTS['weights']['bold'],
        color=NEUTRAL['dark'],
        zorder=ZORDER_FOREGROUND)

ax.text(0, -3.2, "Each point represents millions of search queries", 
        ha='center', va='top',
        fontsize=FONTS['sizes']['body'],
        color=NEUTRAL['gray_dark'],
        zorder=ZORDER_FOREGROUND)

# Set limits with padding
ax.set_xlim(-4, 4)
ax.set_ylim(-4, 4)
ax.axis('off')

# Save
output_path = Path(__file__).parent.parent / "visual-1-search-landscape-scale.svg"
plt.savefig(output_path, format='svg', dpi=EXPORT_CONFIG['dpi'],
           bbox_inches=EXPORT_CONFIG['bbox_inches'], pad_inches=EXPORT_CONFIG['pad_inches'])
print(f"Generated: {output_path}")
plt.close()

