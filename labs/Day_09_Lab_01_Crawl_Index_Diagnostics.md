# Day 9, Lab 1 — Crawl & Index Diagnostics

**Day:** Day 9 — Technical SEO Foundations: Crawlability & Indexability  
**Lab Number:** Lab 1  
**Estimated Time:** 2-3 hours  
**Learning Outcomes Reinforced:**
- Identify crawlability and indexability issues confidently
- Diagnose why pages are not getting indexed
- Avoid technical SEO mistakes that block growth

---

## Learning Objective

By completing this lab, you will systematically diagnose crawlability and indexability issues for your WordPress blog (or a provided website) using browser tools and Google Search Console (if available), identifying blocked URLs, excluded pages, crawl errors, and status code issues, demonstrating ability to diagnose why pages are not getting indexed.

---

## Prerequisites

Before starting this lab, ensure you have:

- [ ] Read all Day 9 chapters:
  - Chapter 1: Technical SEO Foundations: Crawlability and Indexability
  - Chapter 2: Common Technical SEO Blockers and Diagnostics
- [ ] Access to required tools:
  - Browser Developer Tools — Built into all modern browsers
  - Google Search Console — Free, if available (requires Google account and website verification)
  - Google Search — Free, accessible via any web browser
  - HTTP Status Code Checker — Free online tools (optional but helpful)
- [ ] Downloaded the Submission Template:
  - **Template:** [Day_9_Lab_1_Submission_Format.md](Day_9_Lab_1_Submission_Format.md)
  - **Location:** Available in your course materials or LMS

---

## Tools & Resources

### Primary Tools

**Browser Developer Tools**
- **Purpose:** Browser developer tools enable you to inspect HTML, check for noindex tags, verify robots directives, and understand how search engines see pages. By inspecting page elements, you'll identify technical blockers that prevent crawling or indexing.
- **Access:** Built into all modern browsers (right-click → Inspect or View Source)
- **Note:** Basic inspection for HTML tags and page source is sufficient.

**Google Search Console (If Available)**
- **Purpose:** Google Search Console provides crawl error reports, indexation coverage data, and URL inspection tools that help identify technical SEO issues. By analyzing GSC data, you'll understand what's blocking crawling and indexing.
- **Access:** Free, if available (requires Google account and website verification)
- **Note:** If GSC is not available, you can complete the lab using browser tools and manual checks.

**Google Search (site: operator)**
- **Purpose:** Google Search with site: operator enables you to check which pages are indexed and identify pages that should be indexed but aren't. By using site:yourdomain.com, you'll see indexation status.
- **Access:** Free, accessible via any web browser
- **Note:** This helps identify indexation issues even without GSC.

**HTTP Status Code Checker (Optional)**
- **Purpose:** Online status code checkers enable you to verify HTTP status codes for pages. By checking status codes, you'll identify server errors, redirects, and access issues that affect crawling.
- **Access:** Free online tools (search for "HTTP status code checker")
- **Note:** Optional but helpful for verifying status codes.

### Alternative Tools

If Google Search Console is unavailable, you can use:
- Google Search site: operator — For checking indexation
- Browser inspection tools — For checking HTML and tags
- Manual status code checks — For verifying HTTP responses
- Provided website examples — If your own site is not available

---

## Submission Instructions

### Step 1: Download Submission Template

Download and use the Submission Template for this lab:
- **Template:** [Day_9_Lab_1_Submission_Format.md](Day_9_Lab_1_Submission_Format.md)
- **Location:** Available in your course materials or LMS

### Step 2: Complete Submission Template

As you complete this lab, fill out the Submission Template. The template includes:
- Sections for diagnostic findings
- Error documentation
- Blocker identification
- Fix recommendations
- Self-assessment components

### Step 3: Submit Your Work

- **Submission Method:** Submit via your LMS or as instructed by your instructor
- **Deadline:** As specified by your instructor
- **Format:** Markdown file or PDF export of your completed Submission Template

**Important:** Your submission must include all evidence specified in the Submission Template. Incomplete submissions will not be accepted.

---

## Lab Steps

### Step 1: Select Website and Pages to Diagnose

**What to Do:**
Select your WordPress blog (or a provided website) and identify 5-10 pages to diagnose. Choose pages that:
- Represent different content types
- May have technical issues (new pages, pages not indexed, pages with errors)
- Are accessible for inspection
- Cover different sections of the site

**Tool to Use:**
WordPress Blog Editor, Browser

**What to Record:**
Record your selection in the Submission Template, Section 1:
- Website selected
- List of pages to diagnose (titles, URLs, content types)
- Why you selected these pages
- Initial observations

**Checkpoint:**
You've completed this step when:
- [ ] You have selected website and pages to diagnose
- [ ] You have recorded selections in the Submission Template
- [ ] You have noted initial observations

---

### Step 2: Check Robots.txt for Blocks

**What to Do:**
Check robots.txt file for blocks that might prevent crawling:

1. **Access robots.txt:**
   - Navigate to: `yourdomain.com/robots.txt`
   - View robots.txt file in browser

2. **Review robots.txt content:**
   - Check for `Disallow:` directives
   - Identify what's being blocked
   - Check for syntax errors
   - Verify if important pages are blocked

3. **Test robots.txt impact:**
   - Check if selected pages are blocked
   - Verify if blocks are intentional or accidental
   - Document any problematic blocks

**Tool to Use:**
Browser (navigate to robots.txt URL)

**What to Record:**
Record robots.txt check in the Submission Template, Section 2, Evidence Item 1:
- Screenshot of robots.txt file
- List of Disallow directives found
- Assessment of whether blocks are appropriate
- Identification of problematic blocks
- Impact on selected pages

**Checkpoint:**
You've completed this step when:
- [ ] You have checked robots.txt file
- [ ] You have identified blocks and their impact
- [ ] You have recorded findings in the Submission Template

---

### Step 3: Check Sitemap Availability

**What to Do:**
Check if XML sitemap exists and is accessible:

1. **Check for sitemap:**
   - Try common sitemap URLs: `yourdomain.com/sitemap.xml`, `yourdomain.com/sitemap_index.xml`
   - Check robots.txt for sitemap reference
   - Verify sitemap is accessible

2. **Review sitemap content:**
   - Check if sitemap includes important pages
   - Verify sitemap structure
   - Check for errors in sitemap

3. **Assess sitemap quality:**
   - Is sitemap complete?
   - Are important pages included?
   - Is sitemap properly formatted?

**Tool to Use:**
Browser (navigate to sitemap URL)

**What to Record:**
Record sitemap check in the Submission Template, Section 2, Evidence Item 2:
- Screenshot of sitemap (or note if missing)
- Sitemap URL
- Assessment of sitemap completeness
- Identification of sitemap issues
- Impact on discovery

**Checkpoint:**
You've completed this step when:
- [ ] You have checked for sitemap
- [ ] You have assessed sitemap quality
- [ ] You have recorded findings in the Submission Template

---

### Step 4: Check HTTP Status Codes

**What to Do:**
Check HTTP status codes for selected pages:

1. **Check status codes:**
   - Use browser developer tools (Network tab) or online status code checker
   - Check status code for each selected page
   - Verify pages return 200 (OK) status

2. **Identify status code issues:**
   - Pages returning errors (4xx, 5xx)
   - Pages with redirects (3xx) that might be incorrect
   - Pages with unexpected status codes

3. **Assess impact:**
   - How do status codes affect crawling?
   - Which status codes are problematic?
   - What fixes are needed?

**Tool to Use:**
Browser Developer Tools (Network tab), HTTP Status Code Checker (online), or Browser (check page loads)

**What to Record:**
Record status code check in the Submission Template, Section 2, Evidence Item 3:
- Status code for each selected page
- Identification of status code issues
- Impact assessment
- Screenshots showing status codes (if available)

**Checkpoint:**
You've completed this step when:
- [ ] You have checked status codes for selected pages
- [ ] You have identified status code issues
- [ ] You have recorded findings in the Submission Template

---

### Step 5: Check for Noindex Tags

**What to Do:**
Check selected pages for noindex tags that prevent indexing:

1. **Inspect page source:**
   - View page source (right-click → View Page Source)
   - Search for "noindex" in page source
   - Check for `<meta name="robots" content="noindex">` tags

2. **Identify noindex issues:**
   - Pages with noindex tags that shouldn't have them
   - Pages that should have noindex but don't
   - Incorrect noindex implementation

3. **Assess impact:**
   - How do noindex tags affect indexation?
   - Which pages are incorrectly blocked?
   - What fixes are needed?

**Tool to Use:**
Browser Developer Tools (View Source)

**What to Record:**
Record noindex check in the Submission Template, Section 2, Evidence Item 4:
- For each selected page: noindex tag present? (Yes/No)
- Identification of noindex issues
- Impact assessment
- Screenshots showing noindex tags (if found)

**Checkpoint:**
You've completed this step when:
- [ ] You have checked for noindex tags on selected pages
- [ ] You have identified noindex issues
- [ ] You have recorded findings in the Submission Template

---

### Step 6: Check Indexation Status

**What to Do:**
Check which selected pages are indexed:

**If Google Search Console is available:**
1. Use GSC URL Inspection tool
2. Check indexation status for each selected page
3. Note which pages are indexed vs excluded
4. Review exclusion reasons

**If Google Search Console is NOT available:**
1. Use Google Search site: operator
2. Search for: `site:yourdomain.com/page-url`
3. Check if page appears in results
4. Document indexation status

**Tool to Use:**
Google Search Console (if available) or Google Search (site: operator)

**What to Record:**
Record indexation check in the Submission Template, Section 2, Evidence Item 5:
- For each selected page: indexed? (Yes/No)
- Exclusion reasons (if not indexed)
- Patterns in indexation issues
- Screenshots of GSC reports or site: search results

**Checkpoint:**
You've completed this step when:
- [ ] You have checked indexation status for selected pages
- [ ] You have identified indexation issues
- [ ] You have recorded findings in the Submission Template

---

### Step 7: Identify Technical SEO Blockers

**What to Do:**
Compile all findings to identify technical SEO blockers:

1. **Categorize blockers:**
   - Crawlability blockers (robots.txt, status codes, access issues)
   - Indexability blockers (noindex tags, canonical issues)
   - Discovery blockers (sitemap issues)

2. **Assess blocker impact:**
   - Which blockers are most critical?
   - Which blockers affect multiple pages?
   - Which blockers are easiest to fix?

3. **Prioritize blockers:**
   - High priority: Critical blockers preventing access
   - Medium priority: Important issues affecting multiple pages
   - Low priority: Minor issues with limited impact

**Tool to Use:**
Documentation from previous steps

**What to Record:**
Record blocker identification in the Submission Template, Section 3:
- Complete list of technical blockers found
- Blocker categorization (crawlability, indexability, discovery)
- Impact assessment for each blocker
- Prioritized list of blockers to fix
- Recommendations for addressing each blocker

**Checkpoint:**
You've completed this step when:
- [ ] You have identified all technical blockers
- [ ] You have categorized and prioritized blockers
- [ ] You have recorded findings in the Submission Template

---

## Checkpoints

### Checkpoint 1: After Step 3 (Sitemap Check)

Before proceeding, verify:
- [ ] You have checked for sitemap
- [ ] You have assessed sitemap quality
- [ ] You understand how sitemaps affect discovery
- [ ] Findings are recorded in Submission Template

**Self-Validation:**
- Can you explain how sitemaps help discovery?
- Do you understand what makes a good sitemap?
- Have you identified any sitemap issues?

---

### Checkpoint 2: After Step 6 (Indexation Check)

Before proceeding, verify:
- [ ] You have checked indexation status for selected pages
- [ ] You have identified indexation issues
- [ ] You understand why pages might not be indexed
- [ ] Findings are recorded in Submission Template

**Self-Validation:**
- Can you explain why pages might not be indexed?
- Do you understand different exclusion reasons?
- Have you identified specific indexation blockers?

---

### Checkpoint 3: After Step 7 (Final Review)

Before submitting, verify:
- [ ] All diagnostic steps are complete
- [ ] Technical blockers are identified and categorized
- [ ] Fix recommendations are created
- [ ] All evidence is captured in Submission Template
- [ ] Self-assessment is completed

**Self-Validation:**
- Do you understand how to diagnose technical SEO issues?
- Can you identify technical blockers?
- Do you have a clear plan for fixing issues?

---

## Completion Guidelines

### You're Done When:

- [ ] All lab steps have been completed
- [ ] Robots.txt has been checked
- [ ] Sitemap has been reviewed
- [ ] Status codes have been checked
- [ ] Noindex tags have been checked
- [ ] Indexation status has been analyzed
- [ ] Technical blockers have been identified
- [ ] All evidence has been captured and recorded in Submission Template
- [ ] Diagnostic documentation is complete
- [ ] Self-assessment has been completed
- [ ] Submission Template has been saved/exported

### Before Submitting:

1. Review your Submission Template to ensure all sections are complete
2. Verify diagnostic findings are detailed
3. Check that blocker identification is complete
4. Ensure fix recommendations are actionable
5. Complete the self-assessment honestly
6. Verify that your submission meets all requirements

### Submit Your Work:

Follow the Submission Instructions (Section 5) to submit your completed Submission Template.

---

## Troubleshooting

### Issue: I can't find robots.txt file

**Symptoms:**
You navigate to robots.txt URL but get a 404 error.

**Solution:**
1. Robots.txt might not exist (which could be an issue)
2. Try different URLs: `yourdomain.com/robots.txt`, `www.yourdomain.com/robots.txt`
3. Check if robots.txt is in a different location
4. Document that robots.txt is missing if you can't find it

**If This Doesn't Work:**
Missing robots.txt is itself a finding. Document that it doesn't exist and note that this might be an issue (or might be fine if no blocking is needed).

---

### Issue: I can't access Google Search Console

**Symptoms:**
You don't have GSC access for your website.

**Solution:**
1. Use Google Search site: operator instead
2. Check specific pages: `site:yourdomain.com/page-url`
3. Use browser inspection to check for noindex tags
4. Document what you can observe without GSC

**If This Doesn't Work:**
Focus on understanding diagnostic concepts through manual checks. The learning objective is understanding technical SEO diagnostics, not perfect data access.

---

### Issue: I'm not sure how to check HTTP status codes

**Symptoms:**
You're uncertain how to verify status codes.

**Solution:**
1. Use browser developer tools Network tab (open DevTools, reload page, check Network tab)
2. Use online status code checker (search for "HTTP status code checker")
3. If page loads normally, it's likely 200 (OK)
4. If page shows error, check error message for status code

**If This Doesn't Work:**
Focus on pages that clearly have issues (error pages, redirects). The learning is in understanding status codes conceptually, not perfect verification.

---

**END — Day 9, Lab 1: Crawl & Index Diagnostics**

