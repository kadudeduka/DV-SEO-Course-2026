# Day 8, Lab 2 — Canonical & Duplication Audit

**Day:** Day 8 — Indexation Control, Canonicalization & Duplication Management  
**Lab Number:** Lab 2  
**Estimated Time:** 2-3 hours  
**Learning Outcomes Reinforced:**
- Use canonical tags correctly
- Identify and resolve duplicate content issues
- Handle pagination and URL parameters safely

---

## Learning Objective

By completing this lab, you will audit pages from your WordPress blog (or provided examples) for canonical tag implementation and duplicate content issues, identify errors and problems, and recommend fixes, demonstrating ability to apply canonicalization correctly and handle duplicate content effectively.

---

## Prerequisites

Before starting this lab, ensure you have:

- [ ] Read all Day 8 chapters:
  - Chapter 1: Technical SEO Audits and Crawlability
  - Chapter 2: Indexation Control and Index Bloat Prevention
- [ ] Access to required tools:
  - Browser Developer Tools — Built into all modern browsers
  - WordPress Blog Editor — Access to your WordPress blog (required per course setup)
  - Google Search — Free, accessible via any web browser
- [ ] Downloaded the Submission Template:
  - **Template:** [Day_8_Lab_2_Submission_Format.md](Day_8_Lab_2_Submission_Format.md)
  - **Location:** Available in your course materials or LMS

---

## Tools & Resources

### Primary Tools

**Browser Developer Tools**
- **Purpose:** Browser developer tools enable you to inspect HTML and check for canonical tags, noindex tags, and duplicate content signals. By inspecting page source, you'll understand how canonicalization is implemented and identify errors.
- **Access:** Built into all modern browsers (right-click → Inspect or View Source)
- **Note:** Basic inspection for HTML tags is sufficient.

**WordPress Blog Editor**
- **Purpose:** WordPress enables you to access pages for auditing. By reviewing your actual pages, you'll understand canonical tag implementation and duplicate content issues in real content.
- **Access:** Your WordPress blog (required per course setup)
- **Note:** If you don't have enough pages, you can audit available pages or use provided examples.

**Google Search**
- **Purpose:** Google Search enables you to check for duplicate content by searching for unique content snippets. By searching for content, you'll identify if content appears on multiple URLs.
- **Access:** Free, accessible via any web browser
- **Note:** This helps identify duplicate content issues.

### Alternative Tools

If WordPress is unavailable, you can use:
- Any CMS/blog platform — Similar page access
- Browser inspection tools — Universal across platforms
- Provided example pages — If your own pages are not available

---

## Submission Instructions

### Step 1: Download Submission Template

Download and use the Submission Template for this lab:
- **Template:** [Day_8_Lab_2_Submission_Format.md](Day_8_Lab_2_Submission_Format.md)
- **Location:** Available in your course materials or LMS

### Step 2: Complete Submission Template

As you complete this lab, fill out the Submission Template. The template includes:
- Sections for canonical tag audit
- Duplicate content identification
- Error documentation
- Fix recommendations
- Self-assessment components

### Step 3: Submit Your Work

- **Submission Method:** Submit via your LMS or as instructed by your instructor
- **Deadline:** As specified by your instructor
- **Format:** Markdown file or PDF export of your completed Submission Template

**Important:** Your submission must include all evidence specified in the Submission Template. Incomplete submissions will not be accepted.

---

## Lab Steps

### Step 1: Select Pages to Audit

**What to Do:**
Select 5-10 pages from your WordPress blog to audit for canonical tags and duplicate content. Choose pages that:
- Represent different content types (blog posts, pages, category pages if available)
- May have duplicate content (similar posts, pagination, parameters)
- Are accessible for inspection
- Cover different topics or sections

If you don't have 5-10 pages, select all available pages or use provided examples.

**Tool to Use:**
WordPress Blog Editor

**What to Record:**
Record your selections in the Submission Template, Section 1:
- List of pages selected (titles, URLs, content types)
- Why you selected these pages
- Initial observations about pages

**Checkpoint:**
You've completed this step when:
- [ ] You have selected 5-10 pages to audit
- [ ] You have recorded selections in the Submission Template
- [ ] You have noted initial observations

---

### Step 2: Audit Canonical Tags

**What to Do:**
For each selected page, check canonical tag implementation:

1. **Open page in browser**
2. **View page source** (right-click → View Page Source or Inspect)
3. **Search for canonical tag** (look for `<link rel="canonical" href="...">`)
4. **Verify canonical tag:**
   - Does canonical tag exist?
   - Does canonical point to correct URL (self-referencing or preferred version)?
   - Is canonical URL absolute (full URL) or relative?
   - Is canonical tag in correct location (in `<head>` section)?
5. **Document findings** for each page

**Tool to Use:**
Browser Developer Tools (View Source or Inspect)

**What to Record:**
Record canonical tag audit in the Submission Template, Section 2, Evidence Item 1:
- For each page:
  - Canonical tag present? (Yes/No)
  - Canonical URL (if present)
  - Is canonical correct? (Yes/No/Needs Review)
  - Issues found (if any)
- Screenshots showing canonical tags in page source
- Summary of canonical tag implementation status

**Checkpoint:**
You've completed this step when:
- [ ] You have audited canonical tags for all selected pages
- [ ] You have documented findings for each page
- [ ] You have recorded audit in the Submission Template

---

### Step 3: Identify Canonical Tag Errors

**What to Do:**
Identify specific canonical tag errors:

1. **Missing canonical tags:**
   - Pages that should have canonical tags but don't
   - Document which pages need canonical tags

2. **Incorrect canonical URLs:**
   - Canonical tags pointing to wrong URLs
   - Canonical tags pointing to non-existent pages
   - Canonical tags with incorrect format

3. **Canonical tag placement issues:**
   - Canonical tags in wrong location
   - Multiple canonical tags (should be only one)
   - Canonical tags in body instead of head

4. **Self-referencing issues:**
   - Pages that should self-reference but don't
   - Pages that shouldn't self-reference but do

**Tool to Use:**
Browser Developer Tools, Documentation from Step 2

**What to Record:**
Record error identification in the Submission Template, Section 2, Evidence Item 2:
- List of canonical tag errors found
- Error type for each error
- Pages affected
- Impact assessment (how error affects SEO)
- Screenshots showing specific errors

**Checkpoint:**
You've completed this step when:
- [ ] You have identified canonical tag errors
- [ ] You have categorized errors by type
- [ ] You have documented specific errors
- [ ] You have recorded findings in the Submission Template

---

### Step 4: Identify Duplicate Content Issues

**What to Do:**
Identify duplicate content issues:

1. **Check for duplicate content:**
   - Use Google Search to check for duplicate content
   - Search for unique content snippets from pages
   - Check if content appears on multiple URLs
   - Document duplicate content found

2. **Identify duplicate content types:**
   - Exact duplicates (same content on different URLs)
   - Near duplicates (very similar content)
   - Parameter duplicates (same content with different URL parameters)
   - Pagination duplicates (same content across paginated pages)

3. **Assess duplicate content impact:**
   - Which duplicates are problematic?
   - Which duplicates need canonicalization?
   - Which duplicates should be consolidated?

**Tool to Use:**
Google Search, Browser Tools, WordPress Blog Editor

**What to Record:**
Record duplicate content identification in the Submission Template, Section 2, Evidence Item 3:
- List of duplicate content issues found
- Duplicate content type for each issue
- URLs involved in each duplicate
- Impact assessment
- Screenshots showing duplicate content

**Checkpoint:**
You've completed this step when:
- [ ] You have identified duplicate content issues
- [ ] You have categorized duplicates by type
- [ ] You have documented specific duplicates
- [ ] You have recorded findings in the Submission Template

---

### Step 5: Create Fix Recommendations

**What to Do:**
Create specific fix recommendations for canonical and duplicate content issues:

1. **Canonical tag fixes:**
   - Add missing canonical tags
   - Fix incorrect canonical URLs
   - Correct canonical tag placement
   - Document specific fixes needed

2. **Duplicate content fixes:**
   - Add canonical tags to duplicate pages
   - Consolidate duplicate content
   - Use noindex for low-value duplicates
   - Document specific fixes needed

3. **Prioritize fixes:**
   - High priority: Critical canonical errors, major duplicates
   - Medium priority: Important improvements
   - Low priority: Minor optimizations

**Tool to Use:**
Documentation Tool

**What to Record:**
Record fix recommendations in the Submission Template, Section 3:
- Prioritized fix list
- Specific actions for each fix
- Canonicalization strategy
- Duplicate content handling strategy
- Timeline estimates
- Expected impact of fixes

**Checkpoint:**
You've completed this step when:
- [ ] You have created fix recommendations
- [ ] Fixes are prioritized
- [ ] Specific actions are documented
- [ ] You have recorded recommendations in the Submission Template

---

## Checkpoints

### Checkpoint 1: After Step 2 (Canonical Audit)

Before proceeding, verify:
- [ ] You have audited canonical tags for all selected pages
- [ ] You understand canonical tag implementation
- [ ] You have documented findings
- [ ] Audit is recorded in Submission Template

**Self-Validation:**
- Can you explain what canonical tags do?
- Do you understand how to check for canonical tags?
- Have you identified any canonical tag issues?

---

### Checkpoint 2: After Step 4 (Duplicate Content Identification)

Before proceeding, verify:
- [ ] You have identified duplicate content issues
- [ ] You understand different duplicate content types
- [ ] You have documented duplicates
- [ ] Findings are recorded in Submission Template

**Self-Validation:**
- Can you explain why duplicate content is a problem?
- Do you understand how to identify duplicates?
- Have you found specific duplicate content issues?

---

### Checkpoint 3: After Step 5 (Final Review)

Before submitting, verify:
- [ ] All audit steps are complete
- [ ] Canonical and duplicate issues are identified
- [ ] Fix recommendations are created and prioritized
- [ ] All evidence is captured in Submission Template
- [ ] Self-assessment is completed

**Self-Validation:**
- Do you understand how to use canonical tags correctly?
- Can you identify duplicate content issues?
- Do you have a clear plan for fixing issues?

---

## Completion Guidelines

### You're Done When:

- [ ] All lab steps have been completed
- [ ] 5-10 pages have been audited for canonical tags
- [ ] Canonical tag errors have been identified
- [ ] Duplicate content issues have been identified
- [ ] Fix recommendations have been created
- [ ] All evidence has been captured and recorded in Submission Template
- [ ] Audit documentation is complete
- [ ] Self-assessment has been completed
- [ ] Submission Template has been saved/exported

### Before Submitting:

1. Review your Submission Template to ensure all sections are complete
2. Verify canonical tag audit is detailed
3. Check that duplicate content issues are documented
4. Ensure fix recommendations are actionable
5. Complete the self-assessment honestly
6. Verify that your submission meets all requirements

### Submit Your Work:

Follow the Submission Instructions (Section 5) to submit your completed Submission Template.

---

## Troubleshooting

### Issue: I can't find canonical tags in page source

**Symptoms:**
You're looking for canonical tags but can't find them.

**Solution:**
1. Make sure you're viewing page source (not just inspecting elements)
2. Search for "canonical" in page source (Ctrl+F or Cmd+F)
3. Look in the `<head>` section of HTML
4. Some pages may not have canonical tags (which could be an issue)
5. Document that canonical tag is missing if you can't find it

**If This Doesn't Work:**
Focus on understanding that missing canonical tags can be an issue. The learning objective is understanding canonicalization, not finding perfect implementations.

---

### Issue: I'm not sure what makes content "duplicate"

**Symptoms:**
You're uncertain about what constitutes duplicate content.

**Solution:**
1. Exact duplicates: Same content word-for-word on different URLs
2. Near duplicates: Very similar content (80%+ similar)
3. Parameter duplicates: Same content with different URL parameters (?sort=, ?page=, etc.)
4. If content is substantially the same, it's likely duplicate
5. When in doubt, document what you observe

**If This Doesn't Work:**
Focus on identifying content that appears on multiple URLs. The learning is in the identification process, not perfect duplicate detection.

---

### Issue: I don't understand canonical tag syntax

**Symptoms:**
You're uncertain about canonical tag format.

**Solution:**
1. Canonical tag format: `<link rel="canonical" href="URL">`
2. Should be in `<head>` section
3. URL should be absolute (full URL) or relative
4. Should point to preferred version of page
5. Review Day 8 Chapter 2 for canonical tag examples

**If This Doesn't Work:**
Focus on identifying whether canonical tags exist and whether they point to reasonable URLs. Perfect syntax understanding comes with practice.

---

**END — Day 8, Lab 2: Canonical & Duplication Audit**

