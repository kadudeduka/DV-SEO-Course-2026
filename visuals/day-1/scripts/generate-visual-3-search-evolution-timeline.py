"""
Generate Visual #3: Evolution of Search Engines Timeline
Day 1, Chapter 1: SEO Fundamentals & the Modern Search Landscape

VISUAL GOAL:
Show progression from link-focused to intent and entity-focused search.

FIXED: Dynamic layout calculation prevents overlaps
"""

import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyArrowPatch
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent.parent / "_shared"))
from design_system import (
    PRIMARY, NEUTRAL, ACCENT, FONTS, STYLE, EXPORT_CONFIG,
    setup_figure, ZORDER_BACKGROUND, ZORDER_BASE, ZORDER_CONTENT, ZORDER_FOREGROUND,
    get_text_height, calculate_text_bounds
)

fig, ax = setup_figure(figsize=(10, 6), background_color=NEUTRAL['background'])

# Timeline data
periods = [
    {
        'name': 'Early (2000-2010)',
        'start_year': 2000,
        'end_year': 2010,
        'color': NEUTRAL['gray'],
        'focus': 'Link-focused',
        'events': []
    },
    {
        'name': 'Transition (2011-2012)',
        'start_year': 2011,
        'end_year': 2012,
        'color': ACCENT['yellow'],
        'focus': 'Algorithm Updates',
        'events': ['Panda 2011', 'Penguin 2012']
    },
    {
        'name': 'Modern (2013-present)',
        'start_year': 2013,
        'end_year': 2025,
        'color': PRIMARY['green'],
        'focus': 'Intent & Entity-focused',
        'events': ['Intent Understanding', 'Entity Understanding']
    },
]

# Constants - systematic layout
VISUAL_WIDTH = 8
PERIOD_HEIGHT = 1.0

# Text heights
TEXT_HEIGHT_PERIOD = get_text_height(FONTS['sizes']['subheading'])
TEXT_HEIGHT_FOCUS = get_text_height(FONTS['sizes']['body'])
TEXT_HEIGHT_EVENT = get_text_height(FONTS['sizes']['caption'])

# Spacing constants
CLEARANCE_PERIOD_LABEL = STYLE['text_offsets']['above_box']
CLEARANCE_FOCUS_LABEL = STYLE['text_offsets']['below_box']
CLEARANCE_EVENT_LABEL = STYLE['text_offsets']['below_box']
MIN_TEXT_SEPARATION = 0.6

# Calculate timeline Y position based on required space
# We need: period label + clearance + box + clearance + focus label + clearance + event label
required_height = (
    TEXT_HEIGHT_PERIOD + CLEARANCE_PERIOD_LABEL +
    PERIOD_HEIGHT +
    CLEARANCE_FOCUS_LABEL + TEXT_HEIGHT_FOCUS +
    CLEARANCE_EVENT_LABEL + MIN_TEXT_SEPARATION + TEXT_HEIGHT_EVENT
)

# Center timeline vertically in available space
Y_TIMELINE = 3.0  # Center of timeline boxes

# Calculate positions from timeline center
period_box_top = Y_TIMELINE + PERIOD_HEIGHT/2
period_box_bottom = Y_TIMELINE - PERIOD_HEIGHT/2

# Period labels: ABOVE box
period_label_y = period_box_top + CLEARANCE_PERIOD_LABEL
period_label_top, period_label_bottom = calculate_text_bounds(period_label_y, FONTS['sizes']['subheading'], 'bottom')

# Focus labels: BELOW box
focus_label_y = period_box_bottom - CLEARANCE_FOCUS_LABEL
focus_label_top, focus_label_bottom = calculate_text_bounds(focus_label_y, FONTS['sizes']['body'], 'top')

# Event labels: BELOW focus labels
event_label_y = focus_label_bottom - CLEARANCE_EVENT_LABEL - MIN_TEXT_SEPARATION
event_label_top, event_label_bottom = calculate_text_bounds(event_label_y, FONTS['sizes']['caption'], 'top')

def map_year_to_coordinate(year, year_min, year_max, visual_width):
    """Map year to a proportional x-coordinate within VISUAL_WIDTH."""
    return (year - year_min) / (year_max - year_min) * visual_width

def calculate_period_coordinates(period, year_min, year_max, visual_width):
    """Calculate x coordinates for timeline period."""
    x_start = map_year_to_coordinate(period['start_year'], year_min, year_max, visual_width)
    x_end = map_year_to_coordinate(period['end_year'], year_min, year_max, visual_width)
    width = x_end - x_start
    return x_start, x_end, width

def distribute_events(events, x_start, width):
    """Distribute events evenly across period width."""
    if len(events) == 0:
        return []
    if len(events) == 1:
        return [(x_start + width / 2, events[0])]
    
    positions = []
    for i, event in enumerate(events):
        offset = (i + 1) / (len(events) + 1)
        x_pos = x_start + width * offset
        positions.append((x_pos, event))
    return positions

# Calculate year range
year_min = min(p['start_year'] for p in periods)
year_max = max(p['end_year'] for p in periods)

# Track element positions for dynamic sizing
all_x_positions = []
all_y_positions = [period_label_top, period_box_top, period_box_bottom, focus_label_bottom, event_label_bottom]

# Draw timeline base line FIRST (ZORDER_BASE)
x_line_start = map_year_to_coordinate(year_min - 2, year_min, year_max, VISUAL_WIDTH)
x_line_end = map_year_to_coordinate(year_max + 2, year_min, year_max, VISUAL_WIDTH)
ax.plot([x_line_start, x_line_end], [Y_TIMELINE, Y_TIMELINE],
       color=NEUTRAL['dark'],
       linewidth=STYLE['line_widths']['thick'],
       zorder=ZORDER_BASE)
all_x_positions.extend([x_line_start, x_line_end])

# Draw timeline periods (ZORDER_CONTENT)
for period in periods:
    x_start, x_end, width = calculate_period_coordinates(period, year_min, year_max, VISUAL_WIDTH)
    all_x_positions.extend([x_start, x_end])
    
    # Period box
    rect = Rectangle(
        (x_start, period_box_bottom),
        width, PERIOD_HEIGHT,
        facecolor=period['color'],
        edgecolor=NEUTRAL['dark'],
        linewidth=STYLE['line_widths']['normal'],
        alpha=0.7,
        zorder=ZORDER_CONTENT
    )
    ax.add_patch(rect)
    
    # Period label ABOVE box (va='bottom' means y is bottom of text)
    ax.text(x_start + width/2, period_label_y, period['name'],
           ha='center', va='bottom',
           fontsize=FONTS['sizes']['subheading'],
           fontweight=FONTS['weights']['bold'],
           color=NEUTRAL['dark'],
           zorder=ZORDER_FOREGROUND)
    
    # Focus label BELOW box (va='top' means y is top of text)
    ax.text(x_start + width/2, focus_label_y, period['focus'],
           ha='center', va='top',
           fontsize=FONTS['sizes']['body'],
           color=NEUTRAL['dark'],
           zorder=ZORDER_FOREGROUND)

# Arrows between periods (ZORDER_BASE - behind period boxes)
for i in range(len(periods) - 1):
    _, x_end_prev, _ = calculate_period_coordinates(periods[i], year_min, year_max, VISUAL_WIDTH)
    x_start_next, _, _ = calculate_period_coordinates(periods[i+1], year_min, year_max, VISUAL_WIDTH)
    arrow = FancyArrowPatch((x_end_prev, Y_TIMELINE), (x_start_next, Y_TIMELINE),
                           arrowstyle='->', linewidth=STYLE['line_widths']['normal'],
                           color=NEUTRAL['dark'], zorder=ZORDER_BASE)
    ax.add_patch(arrow)

# Event markers and labels (ZORDER_FOREGROUND)
event_marker_y = Y_TIMELINE  # Marker on timeline line

for period in periods:
    x_start, _, width = calculate_period_coordinates(period, year_min, year_max, VISUAL_WIDTH)
    event_positions = distribute_events(period['events'], x_start, width)
    
    for x_event, event_label in event_positions:
        all_x_positions.append(x_event)
        
        # Event marker on timeline (ZORDER_FOREGROUND so it's visible above line)
        ax.plot(x_event, event_marker_y, marker='o', markersize=8,
               color=NEUTRAL['dark'], zorder=ZORDER_FOREGROUND)
        
        # Event label BELOW timeline (va='top' means y is top of text)
        ax.text(x_event, event_label_y, event_label,
               ha='center', va='top',
               fontsize=FONTS['sizes']['caption'],
               color=NEUTRAL['dark'],
               zorder=ZORDER_FOREGROUND)

# Dynamic canvas sizing with padding
padding = 0.8
x_min = min(all_x_positions) - padding
x_max = max(all_x_positions) + padding
y_min = min(all_y_positions) - padding
y_max = max(all_y_positions) + padding

# Ensure minimum bounds
x_min = min(x_min, -0.5)
x_max = max(x_max, VISUAL_WIDTH + 0.5)
y_min = min(y_min, 0.3)  # Leave room for event labels at bottom
y_max = max(y_max, 4.8)  # Leave room for period labels at top

ax.set_xlim(x_min, x_max)
ax.set_ylim(y_min, y_max)
ax.axis('off')

# Save
output_path = Path(__file__).parent.parent / "visual-3-search-evolution-timeline.svg"
plt.savefig(output_path, format='svg', dpi=EXPORT_CONFIG['dpi'],
           bbox_inches=EXPORT_CONFIG['bbox_inches'], pad_inches=EXPORT_CONFIG['pad_inches'])
print(f"Generated: {output_path}")
plt.close()
