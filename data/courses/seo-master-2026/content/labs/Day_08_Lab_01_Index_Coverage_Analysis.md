# Day 8, Lab 1 — Index Coverage Analysis

**Day:** Day 8 — Indexation Control, Canonicalization & Duplication Management  
**Lab Number:** Lab 1  
**Estimated Time:** 2-3 hours  
**Learning Outcomes Reinforced:**
- Control which pages get indexed
- Identify and resolve indexation issues
- Prevent index bloat and SEO dilution

---

## Learning Objective

By completing this lab, you will analyze indexation status using Google Search Console (if available) or alternative methods to identify indexed vs excluded pages, understand causes of indexation problems, and create an indexation improvement plan, demonstrating ability to control which pages get indexed and prevent index bloat.

---

## Prerequisites

Before starting this lab, ensure you have:

- [ ] Read all Day 8 chapters:
  - Chapter 1: Technical SEO Audits and Crawlability
  - Chapter 2: Indexation Control and Index Bloat Prevention
- [ ] Access to required tools:
  - Google Search Console — Free, if available (requires Google account and website verification)
  - Google Search — Free, accessible via any web browser
  - Browser Tools — Built into all modern browsers
- [ ] Downloaded the Submission Template:
  - **Template:** [Day_8_Lab_1_Submission_Format.md](Day_8_Lab_1_Submission_Format.md)
  - **Location:** Available in your course materials or LMS

---

## Tools & Resources

### Primary Tools

**Google Search Console (If Available)**
- **Purpose:** Google Search Console provides detailed indexation data showing which pages are indexed, which are excluded, and why. By analyzing GSC indexation reports, you'll understand how to identify indexation issues and control which pages get indexed.
- **Access:** Free, if available (requires Google account and website verification)
- **Note:** If GSC is not available, you can complete the lab using Google Search site: operator and manual checks.

**Google Search (site: operator)**
- **Purpose:** Google Search with site: operator enables you to check which pages from a website are indexed. By using site:yourdomain.com, you'll see indexed pages and can identify indexation patterns.
- **Access:** Free, accessible via any web browser
- **Note:** This is an alternative method if Google Search Console is not available.

**Browser Tools**
- **Purpose:** Browser tools enable you to inspect pages and check for indexation signals (noindex tags, robots directives). By inspecting pages, you'll understand how indexation is controlled.
- **Access:** Built into all modern browsers
- **Note:** Basic inspection for HTML tags is sufficient.

### Alternative Tools

If Google Search Console is unavailable, you can use:
- Google Search site: operator — For checking indexed pages
- Manual indexation checks — For verifying page status
- Provided website examples — If your own site is not available

---

## Submission Instructions

### Step 1: Download Submission Template

Download and use the Submission Template for this lab:
- **Template:** [Day_8_Lab_1_Submission_Format.md](Day_8_Lab_1_Submission_Format.md)
- **Location:** Available in your course materials or LMS

### Step 2: Complete Submission Template

As you complete this lab, fill out the Submission Template. The template includes:
- Sections for indexation analysis
- Exclusion cause documentation
- Improvement plans
- Self-assessment components

### Step 3: Submit Your Work

- **Submission Method:** Submit via your LMS or as instructed by your instructor
- **Deadline:** As specified by your instructor
- **Format:** Markdown file or PDF export of your completed Submission Template

**Important:** Your submission must include all evidence specified in the Submission Template. Incomplete submissions will not be accepted.

---

## Lab Steps

### Step 1: Access Indexation Data

**What to Do:**
Access indexation data for your WordPress blog (or provided website):

**If Google Search Console is available:**
1. Log into Google Search Console
2. Select your property (website)
3. Navigate to "Pages" or "Indexing" section
4. Review indexation coverage report
5. Note total indexed pages, excluded pages, and reasons

**If Google Search Console is NOT available:**
1. Use Google Search with site: operator
2. Search for: `site:yourdomain.com`
3. Note how many pages appear (this shows indexed pages)
4. Check specific pages using: `site:yourdomain.com/page-url`
5. Document indexed pages manually

**Tool to Use:**
Google Search Console (if available) or Google Search (site: operator)

**What to Record:**
Record your access method in the Submission Template, Section 1:
- Which method you used (GSC or site: operator)
- Total pages checked
- Initial observations about indexation status

**Checkpoint:**
You've completed this step when:
- [ ] You have accessed indexation data (via GSC or site: operator)
- [ ] You have noted initial indexation status
- [ ] You have recorded access method in the Submission Template

---

### Step 2: Analyze Indexed Pages

**What to Do:**
Analyze which pages are indexed:

**If using Google Search Console:**
1. Review "Valid" indexed pages
2. Note page types that are indexed (blog posts, pages, categories, etc.)
3. Identify patterns in indexed pages
4. Document indexed page types and counts

**If using site: operator:**
1. Review search results to see indexed pages
2. Note page types that appear
3. Count indexed pages (approximate)
4. Identify patterns in indexed pages

**Tool to Use:**
Google Search Console (if available) or Google Search

**What to Record:**
Record your analysis in the Submission Template, Section 2, Evidence Item 1:
- List of indexed pages (or page types if many pages)
- Page type breakdown (blog posts, pages, categories, etc.)
- Total indexed pages count
- Screenshots of GSC indexation report or site: search results
- Patterns observed in indexed pages

**Checkpoint:**
You've completed this step when:
- [ ] You have analyzed indexed pages
- [ ] You have documented page types and counts
- [ ] You have identified patterns
- [ ] You have recorded findings in the Submission Template

---

### Step 3: Analyze Excluded Pages

**What to Do:**
Analyze which pages are excluded from indexing and why:

**If using Google Search Console:**
1. Review "Excluded" pages section
2. Note exclusion reasons (Duplicate, Crawled - currently not indexed, Discovered - currently not indexed, etc.)
3. Identify patterns in exclusions
4. Document exclusion causes and counts

**If using site: operator:**
1. Check specific pages that should be indexed but don't appear
2. Use browser inspection to check for noindex tags
3. Document pages that are excluded
4. Note potential exclusion reasons

**Tool to Use:**
Google Search Console (if available), Google Search, Browser Developer Tools

**What to Record:**
Record your analysis in the Submission Template, Section 2, Evidence Item 2:
- List of excluded pages (or exclusion categories)
- Exclusion reasons identified
- Exclusion reason breakdown (counts by reason)
- Screenshots of GSC exclusion report or excluded pages
- Patterns observed in exclusions

**Checkpoint:**
You've completed this step when:
- [ ] You have analyzed excluded pages
- [ ] You have documented exclusion reasons
- [ ] You have identified patterns
- [ ] You have recorded findings in the Submission Template

---

### Step 4: Identify Indexation Issues

**What to Do:**
Identify specific indexation issues:

1. **Pages that should be indexed but aren't:**
   - Important pages missing from index
   - New content not getting indexed
   - Pages with noindex tags that shouldn't have them

2. **Pages that shouldn't be indexed but are:**
   - Duplicate content pages
   - Low-value pages
   - Pages that should have noindex tags

3. **Index bloat indicators:**
   - Too many similar/duplicate pages indexed
   - Parameter URLs indexed
   - Pagination pages indexed unnecessarily

4. **Indexation errors:**
   - Pages with indexation errors
   - Crawl issues preventing indexation
   - Technical issues blocking indexation

**Tool to Use:**
Google Search Console (if available), Google Search, Browser Developer Tools

**What to Record:**
Record issue identification in the Submission Template, Section 2, Evidence Item 3:
- Pages that should be indexed but aren't (with reasons)
- Pages that shouldn't be indexed but are (with reasons)
- Index bloat indicators identified
- Indexation errors found
- Screenshots showing specific issues

**Checkpoint:**
You've completed this step when:
- [ ] You have identified indexation issues
- [ ] You have categorized issues by type
- [ ] You have documented specific problems
- [ ] You have recorded findings in the Submission Template

---

### Step 5: Analyze Exclusion Causes

**What to Do:**
For pages that are excluded, analyze the specific causes:

1. **Duplicate content:**
   - Pages marked as duplicate
   - Why they're considered duplicate
   - Whether canonicalization is needed

2. **Crawled but not indexed:**
   - Pages that are crawled but not indexed
   - Potential reasons (quality, value, duplicate signals)
   - Whether these should be indexed

3. **Discovered but not indexed:**
   - Pages that are discovered but not crawled/indexed
   - Potential reasons (crawl budget, priority, access issues)
   - Whether these should be indexed

4. **Noindex tags:**
   - Pages with noindex tags
   - Whether noindex is intentional or accidental
   - Whether noindex should be removed

**Tool to Use:**
Google Search Console (if available), Browser Developer Tools, Google Search

**What to Record:**
Record cause analysis in the Submission Template, Section 3:
- Detailed analysis of exclusion causes
- Assessment of whether exclusions are appropriate
- Identification of problematic exclusions
- Recommendations for addressing exclusion causes

**Checkpoint:**
You've completed this step when:
- [ ] You have analyzed exclusion causes
- [ ] You have assessed whether exclusions are appropriate
- [ ] You have identified problematic exclusions
- [ ] You have recorded analysis in the Submission Template

---

### Step 6: Create Indexation Improvement Plan

**What to Do:**
Create a prioritized plan to improve indexation:

1. **Fix pages that should be indexed:**
   - Remove noindex tags where inappropriate
   - Fix crawl/indexation errors
   - Improve page quality if needed
   - Document specific fixes needed

2. **Exclude pages that shouldn't be indexed:**
   - Add noindex tags to low-value pages
   - Use canonical tags for duplicates
   - Block parameter URLs if needed
   - Document exclusion strategy

3. **Address index bloat:**
   - Identify duplicate/variation pages to exclude
   - Plan canonicalization strategy
   - Document index bloat reduction plan

4. **Prioritize fixes:**
   - High priority: Critical indexation issues
   - Medium priority: Important improvements
   - Low priority: Nice-to-have optimizations

**Tool to Use:**
Documentation Tool

**What to Record:**
Record improvement plan in the Submission Template, Section 3:
- Prioritized fix list
- Specific actions for each fix
- Indexation control strategy
- Timeline estimates
- Expected impact of fixes

**Checkpoint:**
You've completed this step when:
- [ ] You have created improvement plan
- [ ] Fixes are prioritized
- [ ] Specific actions are documented
- [ ] You have recorded plan in the Submission Template

---

## Checkpoints

### Checkpoint 1: After Step 3 (Exclusion Analysis)

Before proceeding, verify:
- [ ] You have analyzed excluded pages
- [ ] You understand exclusion reasons
- [ ] You have identified patterns
- [ ] Analysis is recorded in Submission Template

**Self-Validation:**
- Can you explain why pages are excluded?
- Do you understand different exclusion reasons?
- Have you identified problematic exclusions?

---

### Checkpoint 2: After Step 5 (Cause Analysis)

Before proceeding, verify:
- [ ] You have analyzed exclusion causes
- [ ] You have assessed whether exclusions are appropriate
- [ ] You have identified issues
- [ ] Analysis is recorded in Submission Template

**Self-Validation:**
- Can you explain exclusion causes?
- Do you understand when exclusions are appropriate vs problematic?
- Have you identified specific issues to address?

---

### Checkpoint 3: After Step 6 (Final Review)

Before submitting, verify:
- [ ] All analysis steps are complete
- [ ] Indexation issues are identified
- [ ] Improvement plan is created and prioritized
- [ ] All evidence is captured in Submission Template
- [ ] Self-assessment is completed

**Self-Validation:**
- Do you understand how to control indexation?
- Can you identify indexation issues?
- Do you have a clear plan for improving indexation?

---

## Completion Guidelines

### You're Done When:

- [ ] All lab steps have been completed
- [ ] Indexation status has been analyzed
- [ ] Indexed and excluded pages have been documented
- [ ] Indexation issues have been identified
- [ ] Exclusion causes have been analyzed
- [ ] Improvement plan has been created
- [ ] All evidence has been captured and recorded in Submission Template
- [ ] Analysis documentation is complete
- [ ] Self-assessment has been completed
- [ ] Submission Template has been saved/exported

### Before Submitting:

1. Review your Submission Template to ensure all sections are complete
2. Verify indexation analysis is detailed
3. Check that improvement plan is actionable
4. Ensure all issues are documented
5. Complete the self-assessment honestly
6. Verify that your submission meets all requirements

### Submit Your Work:

Follow the Submission Instructions (Section 5) to submit your completed Submission Template.

---

## Troubleshooting

### Issue: I don't have Google Search Console access

**Symptoms:**
You can't access Google Search Console for your website.

**Solution:**
1. Use Google Search site: operator instead
2. Search for: `site:yourdomain.com`
3. Check specific pages: `site:yourdomain.com/page-url`
4. Use browser inspection to check for noindex tags
5. Document what you can observe

**If This Doesn't Work:**
Focus on understanding indexation concepts through manual checks. The learning objective is understanding indexation control, not perfect data access.

---

### Issue: I can't verify my website in Google Search Console

**Symptoms:**
You're trying to set up GSC but can't verify your website.

**Solution:**
1. Use alternative verification methods (HTML file, meta tag, DNS)
2. If verification isn't possible, use site: operator method
3. Contact your instructor if you need help with verification
4. Complete the lab using alternative methods

**If This Doesn't Work:**
Use site: operator and manual checks. The lab can be completed without GSC access.

---

### Issue: I'm not sure what exclusion reasons mean

**Symptoms:**
You're uncertain about what different exclusion reasons indicate.

**Solution:**
1. Review Day 8 Chapter 2 for exclusion reason explanations
2. "Duplicate" means page is considered duplicate of another
3. "Crawled - currently not indexed" means page was crawled but not added to index
4. "Discovered - currently not indexed" means page was found but not crawled/indexed
5. Document what you observe even if uncertain

**If This Doesn't Work:**
Focus on identifying pages that are excluded and whether that seems appropriate. The learning is in the analysis process, not perfect understanding of every exclusion reason.

---

**END — Day 8, Lab 1: Index Coverage Analysis**

