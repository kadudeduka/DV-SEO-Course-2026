# Migration Guide — Moving Files to Deliverables

**Purpose:** Step-by-step guide for moving finalized files to the deliverables folder

---

## Quick Reference

### Book Chapters
```bash
# Source
books/drafts/Day_1_Chapter_1_Draft.md

# Target
deliverables/books/Day_01_Chapter_01_{Title}.md
```

### Guided Labs
```bash
# Source
labs/day-1/Day_1_Lab_1_{Title}.md

# Target
deliverables/labs/Day_01_Lab_01_{Title}.md
```

---

## Step-by-Step Process

### 1. Prepare the File

**Checklist:**
- [ ] Content is complete and final
- [ ] All placeholders removed
- [ ] All internal notes removed
- [ ] All visuals included and linked
- [ ] All links verified
- [ ] File is approved for release

### 2. Determine Target Name

**For Chapters:**
1. Extract day number → zero-pad (1 → 01)
2. Extract chapter number → zero-pad (1 → 01)
3. Extract title from chapter → convert to Title_Case_With_Underscores
4. Format: `Day_01_Chapter_01_{Title}.md`

**For Labs:**
1. Extract day number → zero-pad (1 → 01)
2. Extract lab number → zero-pad (1 → 01)
3. Extract title from lab → convert to Title_Case_With_Underscores
4. Format: `Day_01_Lab_01_{Title}.md`

### 3. Clean the File

**Remove:**
- Version suffixes (v1, v2, Draft, etc.)
- Internal notes (<!-- TODO -->, [NOTE], etc.)
- Placeholders ([PLACEHOLDER], [TBD], etc.)
- Development comments

**Ensure:**
- All visuals use relative paths from deliverables folder
- All links are updated if needed
- Formatting is consistent

### 4. Copy to Deliverables

```bash
# Example: Chapter
cp books/drafts/Day_1_Chapter_1_Draft.md \
   deliverables/books/Day_01_Chapter_01_SEO_Fundamentals_and_Modern_Search_Landscape.md

# Example: Lab
cp labs/day-1/Day_1_Lab_1_Exploring_Real_Search_Landscape.md \
   deliverables/labs/Day_01_Lab_01_Exploring_Real_Search_Landscape.md
```

### 5. Update References

**Check and update:**
- Project README
- Index files
- Cross-references between files
- Any documentation that references the file

### 6. Verify

**Final checks:**
- [ ] File opens correctly
- [ ] All visuals display
- [ ] All links work
- [ ] Formatting is correct
- [ ] No broken references

---

## Naming Examples

### Chapters

| Source Name | Target Name |
|------------|-------------|
| `Day_1_Chapter_1_Draft.md` | `Day_01_Chapter_01_SEO_Fundamentals_and_Modern_Search_Landscape.md` |
| `Day_2_Chapter_2_Draft.md` | `Day_02_Chapter_02_Search_Intent_Fundamentals.md` |
| `Day_10_Chapter_1_Draft.md` | `Day_10_Chapter_01_Local_SEO_Fundamentals.md` |

### Labs

| Source Name | Target Name |
|------------|-------------|
| `Day_1_Lab_1_Exploring_Real_Search_Landscape.md` | `Day_01_Lab_01_Exploring_Real_Search_Landscape.md` |
| `Day_1_Lab_2_SEO_Terminology_in_Action.md` | `Day_01_Lab_02_SEO_Terminology_in_Action.md` |
| `Day_5_Lab_1_Technical_SEO_Audit.md` | `Day_05_Lab_01_Technical_SEO_Audit.md` |

---

## Common Issues

### Issue: Visual paths break

**Problem:** Visuals referenced with `../visuals/` won't work from deliverables

**Solution:** Update paths to be relative from deliverables folder, or use absolute paths from project root

### Issue: Cross-references break

**Problem:** References to other chapters/labs use old paths

**Solution:** Update all cross-references to use deliverables paths

### Issue: File too long

**Problem:** Filename exceeds 100 characters

**Solution:** Abbreviate title while keeping it descriptive

---

## Automation Script

A script can be created to automate this process. For now, use manual process above.

---

**Status:** Ready for use

