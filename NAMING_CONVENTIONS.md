# Naming Conventions for Deliverables

**Status:** Mandatory  
**Applies To:** All files in `deliverables/` folder

---

## General Rules

1. **Zero-pad numbers:** Always use 01, 02, 03... not 1, 2, 3
2. **Use underscores:** No spaces in filenames
3. **Title case:** Capitalize each word
4. **No version suffixes:** Remove "Draft", "v1", "v2", etc.
5. **Descriptive:** Include meaningful title
6. **Under 100 characters:** Keep filenames reasonable length

---

## Book Chapters

### Format
```
Day_{DD}_Chapter_{CC}_{Title}.md
```

### Components
- `Day_{DD}`: Day number, zero-padded (01-20)
- `Chapter_{CC}`: Chapter number, zero-padded (01-04)
- `{Title}`: Chapter title in Title_Case_With_Underscores

### Examples

✅ **Correct:**
- `Day_01_Chapter_01_SEO_Fundamentals_and_Modern_Search_Landscape.md`
- `Day_01_Chapter_02_How_Search_Engines_Work_and_Search_Intent_Fundamentals.md`
- `Day_10_Chapter_01_Local_SEO_Fundamentals.md`

❌ **Incorrect:**
- `Day_1_Chapter_1_Draft.md` (no zero-padding, includes "Draft")
- `Day 1 Chapter 1.md` (spaces)
- `day_1_chapter_1.md` (lowercase)
- `Day_1_Chapter_1.md` (no zero-padding)

---

## Guided Labs

### Format
```
Day_{DD}_Lab_{LL}_{Title}.md
```

### Components
- `Day_{DD}`: Day number, zero-padded (01-20)
- `Lab_{LL}`: Lab number, zero-padded (01-02)
- `{Title}`: Lab title in Title_Case_With_Underscores

### Examples

✅ **Correct:**
- `Day_01_Lab_01_Exploring_Real_Search_Landscape.md`
- `Day_01_Lab_02_SEO_Terminology_in_Action.md`
- `Day_05_Lab_01_Technical_SEO_Audit.md`

❌ **Incorrect:**
- `Day_1_Lab_1_Exploring.md` (no zero-padding)
- `Day_1_Lab_1_Exploring Real Search Landscape.md` (spaces)
- `day_1_lab_1.md` (lowercase, no title)

---

## Resources

### Format
```
{Resource_Name}.md
```

### Components
- `{Resource_Name}`: Descriptive name in Title_Case_With_Underscores

### Examples

✅ **Correct:**
- `Tool_Registry.md`
- `Submission_Template_Guide.md`
- `Glossary.md`
- `FAQ.md`
- `Course_Schedule.md`

❌ **Incorrect:**
- `tool registry.md` (spaces, lowercase)
- `ToolRegistry.md` (no underscores)
- `tool-registry.md` (hyphens)

---

## Title Conversion Rules

When converting a title to filename format:

1. **Capitalize each word**
2. **Replace spaces with underscores**
3. **Remove special characters** (keep only letters, numbers, underscores)
4. **Remove articles** if they make filename too long (a, an, the)
5. **Abbreviate if needed** to stay under 100 characters

### Examples

| Original Title | Filename |
|--------------|----------|
| "SEO Fundamentals & the Modern Search Landscape" | `SEO_Fundamentals_and_Modern_Search_Landscape` |
| "How Search Engines Work" | `How_Search_Engines_Work` |
| "Exploring the Real Search Landscape" | `Exploring_Real_Search_Landscape` |

---

## Validation

Before moving a file to `deliverables/`, verify:

- [ ] Follows correct format for file type
- [ ] Numbers are zero-padded
- [ ] No spaces in filename
- [ ] Title case used
- [ ] No version suffixes
- [ ] Under 100 characters
- [ ] Descriptive and clear

---

**Status:** Active — All files in `deliverables/` must follow these conventions

