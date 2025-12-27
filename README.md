# Deliverables — Final User-Facing Files

**Purpose:** This folder contains all final, production-ready files that will be shared with learners.

**Status:** Active  
**Last Updated:** 2025-01-27

---

## Directory Structure

```
deliverables/
├── books/              # Final book chapters (user-facing)
│   ├── Day_01_Chapter_01_Seo_Fundamentals_And_The_Modern_Search_Landscape.md
│   ├── Day_01_Chapter_02_How_Search_Engines_Work_And_Search_Intent_Fundamentals.md
│   ├── Day_01_Chapter_03_Seo_Terminology_And_Professional_Language.md
│   ├── Day_01_Chapter_04_Search_Intent_Analysis_Serp_Validation_And_Keyword_Mapping.md
│   ├── Day_02_Chapter_01_How_Search_Engines_Work_And_Search_Intent_Fundamentals.md
│   ├── Day_02_Chapter_02_Serp_Analysis_And_Zero_Click_Searches.md
│   ├── Day_02_Chapter_03_Search_Intent_Categories_Deep_Dive.md
│   ├── Day_03_Chapter_01_Keyword_Research_Foundations_And_Opportunity_Discovery.md
│   ├── Day_03_Chapter_02_Keyword_Expansion_And_Tools.md
│   ├── Day_03_Chapter_03_Keyword_Opportunity_Evaluation_And_Prioritization.md
│   ├── Day_04_Chapter_01_Search_Intent_Analysis_And_Serp_Validation.md
│   └── ...
├── labs/               # Final guided lab files (user-facing)
│   ├── Day_01_Lab_01_Exploring_Real_Search_Landscape.md
│   ├── Day_01_Lab_02_Seo_Terminology_In_Action.md
│   ├── Day_02_Lab_01_Crawl_Index_Rank_Observation.md
│   ├── Day_02_Lab_02_Search_Intent_Serp_Decoding.md
│   ├── Day_03_Lab_01_Seed_Keyword_Discovery.md
│   ├── Day_03_Lab_02_Keyword_Expansion.md
│   ├── Day_04_Lab_01_Serp_Dissection_Intent_Validation.md
│   ├── Day_04_Lab_02_Keyword_To_Page_Mapping.md
│   └── ...
├── visuals/            # All visual assets (SVG files)
│   ├── day-1/          # Day 1 visuals
│   ├── day-2/          # Day 2 visuals
│   ├── day-3/          # Day 3 visuals
│   ├── day-4/          # Day 4 visuals
│   └── ...
├── resources/          # Supporting resources (user-facing)
│   ├── Tool_Registry.md
│   └── ...
├── Table_of_Contents.md # Complete program table of contents
├── INDEX.md            # File index
├── README.md           # This file
├── MIGRATION_GUIDE.md  # How to move files
└── NAMING_CONVENTIONS.md # Naming rules
```

---

## Current Contents

### Books ✅
- **Day 1:** 4 chapters (complete)
  - Chapter 1: SEO Fundamentals & the Modern Search Landscape
  - Chapter 2: How Search Engines Work & Search Intent Fundamentals
  - Chapter 3: SEO Terminology & Professional Language
  - Chapter 4: Search Intent Analysis, SERP Validation & Keyword Mapping
- **Day 2:** 3 chapters (complete)
  - Chapter 1: How Search Engines Work & Search Intent Fundamentals
  - Chapter 2: SERP Analysis and Zero-Click Searches
  - Chapter 3: Search Intent Categories Deep Dive
- **Day 3:** 3 chapters (complete)
  - Chapter 1: Keyword Research Foundations & Opportunity Discovery
  - Chapter 2: Keyword Expansion & Tools
  - Chapter 3: Keyword Opportunity Evaluation & Prioritization
- **Day 4:** 1 chapter (complete)
  - Chapter 1: Search Intent Analysis & SERP Validation

### Labs ✅
- **Day 1:** 2 labs (complete)
  - Lab 1: Exploring Real Search Landscape
  - Lab 2: SEO Terminology in Action
- **Day 2:** 2 labs (complete)
  - Lab 1: Crawl, Index & Rank Observation
  - Lab 2: Search Intent & SERP Decoding
- **Day 3:** 2 labs (complete)
  - Lab 1: Seed Keyword Discovery
  - Lab 2: Keyword Expansion
- **Day 4:** 2 labs (complete)
  - Lab 1: SERP Dissection & Intent Validation
  - Lab 2: Keyword-to-Page Mapping

### Resources ✅
- `Tool_Registry.md` - Central registry of all tools used in labs
- `Table_of_Contents.md` - Complete program table of contents

---

## Naming Conventions

### Book Chapters
**Format:** `Day_{DD}_Chapter_{CC}_{Title}.md`

**Examples:**
- `Day_01_Chapter_01_Seo_Fundamentals_And_The_Modern_Search_Landscape.md`
- `Day_01_Chapter_02_How_Search_Engines_Work_And_Search_Intent_Fundamentals.md`

**Rules:**
- Zero-padded numbers (01, 02, not 1, 2)
- Title case with underscores
- No spaces in filename
- Descriptive title included

### Guided Labs
**Format:** `Day_{DD}_Lab_{LL}_{Title}.md`

**Rules:**
- Zero-padded numbers
- Title case with underscores
- No spaces

### Resources
**Format:** `{Resource_Name}.md`

**Examples:**
- `Tool_Registry.md`
- `Table_of_Contents.md`

See `NAMING_CONVENTIONS.md` for detailed rules.

---

## File Status

### ✅ Ready for Users
Files in this folder are:
- Final, production-ready versions
- Reviewed and approved
- Free of internal notes and placeholders
- Properly formatted for learner consumption
- Complete with all visuals and resources
- Visual paths updated for deliverables location
- Enhanced with editorial improvements (callout boxes, bold formatting)

### ⚠️ Work in Progress
Files being prepared for this folder:
- Located in `../books/phase-outputs/` (for chapters - intermediate files)
- Located in `../labs/day-X/` (for labs)
- Will be moved here when finalized

**Note:** Old draft files have been removed. Final versions are in this `deliverables/` folder.

---

## Visual Paths

All visuals in deliverables use paths relative to the book files:
- Path format: `../visuals/day-X/visual-X.svg` (from `deliverables/books/` to `deliverables/visuals/`)
- All visuals are stored in `deliverables/visuals/day-X/` folders
- This ensures visuals work correctly from deliverables location

---

## Workflow

### Moving Files to Deliverables

1. **Final Review:** Ensure file is complete and approved
2. **Rename:** Apply proper naming convention
3. **Clean:** Remove internal notes, placeholders, TODOs
4. **Update Paths:** Fix visual and link paths for deliverables location
5. **Verify:** Check all links, visuals, and resources work
6. **Move:** Copy to appropriate `deliverables/` subfolder
7. **Update:** Update INDEX.md and any references

See `MIGRATION_GUIDE.md` for detailed steps.

---

## Quality Checklist

Before moving a file to `deliverables/`:

- [ ] File is final and approved
- [ ] Naming convention followed
- [ ] All visuals included and linked correctly
- [ ] Visual paths updated for deliverables location
- [ ] All internal notes/placeholders removed
- [ ] All links verified and working
- [ ] Formatting is consistent
- [ ] Content is complete
- [ ] No TODO items or placeholders
- [ ] Ready for learner consumption

---

## Maintenance

**Update Frequency:** As files are finalized  
**Responsibility:** Content team  
**Review:** Before each program delivery

---

**Note:** This folder is the single source of truth for all user-facing deliverables. Files here are ready to be shared with learners.
