# Day 10, Lab 1 — Core Web Vitals Diagnosis

**Day:** Day 10 — Core Web Vitals, Page Experience & Performance Optimization  
**Lab Number:** Lab 1  
**Estimated Time:** 2-3 hours  
**Learning Outcomes Reinforced:**
- Understand Core Web Vitals and their SEO impact
- Diagnose performance issues using real tools
- Differentiate lab data vs field data

---

## Learning Objective

By completing this lab, you will analyze Core Web Vitals for pages from your WordPress blog (or provided examples) using Google PageSpeed Insights and Google Search Console (if available), identifying real performance issues, interpreting lab vs field data, and understanding how performance affects SEO, demonstrating ability to diagnose performance issues using real tools.

---

## Prerequisites

Before starting this lab, ensure you have:

- [ ] Read all Day 10 chapters:
  - Chapter 1: Core Web Vitals and Page Experience Signals
  - Chapter 2: SEO-Friendly Performance Prioritization
- [ ] Access to required tools:
  - Google PageSpeed Insights — Free, accessible via any web browser
  - Google Search Console — Free, if available (requires Google account and website verification)
  - Browser Tools — Built into all modern browsers
- [ ] Downloaded the Submission Template:
  - **Template:** [Day_10_Lab_1_Submission_Format.md](Day_10_Lab_1_Submission_Format.md)
  - **Location:** Available in your course materials or LMS

---

## Tools & Resources

### Primary Tools

**Google PageSpeed Insights**
- **Purpose:** Google PageSpeed Insights provides Core Web Vitals measurements (LCP, INP, CLS) and performance analysis for any webpage. By analyzing pages with PageSpeed Insights, you'll understand how to measure Core Web Vitals and identify performance issues that affect SEO.
- **Access:** Free, accessible via any web browser at pagespeed.web.dev
- **Note:** PageSpeed Insights provides lab data (simulated conditions) and field data (real user data from Chrome User Experience Report if available).

**Google Search Console (If Available)**
- **Purpose:** Google Search Console provides Core Web Vitals field data (real user measurements) from your website. By comparing GSC field data with PageSpeed Insights lab data, you'll understand the difference between lab and field data and how to interpret performance metrics.
- **Access:** Free, if available (requires Google account and website verification)
- **Note:** If GSC is not available, you can complete the lab using PageSpeed Insights alone.

**Browser Tools**
- **Purpose:** Browser developer tools enable you to inspect pages, check network performance, and understand how pages load. By inspecting page loading, you'll understand what affects Core Web Vitals.
- **Access:** Built into all modern browsers
- **Note:** Basic browser inspection is sufficient.

### Alternative Tools

If Google PageSpeed Insights is unavailable, you can use:
- GTmetrix — Free performance tool
- WebPageTest — Free performance tool
- Browser performance tools — Built-in browser dev tools

---

## Submission Instructions

### Step 1: Download Submission Template

Download and use the Submission Template for this lab:
- **Template:** [Day_10_Lab_1_Submission_Format.md](Day_10_Lab_1_Submission_Format.md)
- **Location:** Available in your course materials or LMS

### Step 2: Complete Submission Template

As you complete this lab, fill out the Submission Template. The template includes:
- Sections for Core Web Vitals measurements
- Performance issue identification
- Lab vs field data comparison
- Self-assessment components

### Step 3: Submit Your Work

- **Submission Method:** Submit via your LMS or as instructed by your instructor
- **Deadline:** As specified by your instructor
- **Format:** Markdown file or PDF export of your completed Submission Template

**Important:** Your submission must include all evidence specified in the Submission Template. Incomplete submissions will not be accepted.

---

## Lab Steps

### Step 1: Select Pages to Analyze

**What to Do:**
Select 3-5 pages from your WordPress blog to analyze for Core Web Vitals. Choose pages that:
- Represent different content types (blog posts, pages, category pages if available)
- Are publicly accessible
- May have varying performance (some may be faster, others slower)
- Cover different sections of your site

If you don't have enough pages, select available pages or use provided examples.

**Tool to Use:**
WordPress Blog Editor, Browser

**What to Record:**
Record your selections in the Submission Template, Section 1:
- List of pages selected (titles, URLs, content types)
- Why you selected these pages
- Initial observations about pages

**Checkpoint:**
You've completed this step when:
- [ ] You have selected 3-5 pages to analyze
- [ ] You have recorded selections in the Submission Template
- [ ] You have noted initial observations

---

### Step 2: Measure Core Web Vitals with PageSpeed Insights

**What to Do:**
For each selected page, measure Core Web Vitals using Google PageSpeed Insights:

1. **Access PageSpeed Insights:**
   - Go to: pagespeed.web.dev
   - Enter page URL
   - Click "Analyze"

2. **Review Core Web Vitals:**
   - **LCP (Largest Contentful Paint):** Measures loading performance
   - **INP (Interaction to Next Paint):** Measures interactivity
   - **CLS (Cumulative Layout Shift):** Measures visual stability
   - Note scores for each metric
   - Note whether metrics are "Good", "Needs Improvement", or "Poor"

3. **Document measurements:**
   - Record LCP, INP, CLS scores for each page
   - Note performance category for each metric
   - Screenshot PageSpeed Insights results

**Tool to Use:**
Google PageSpeed Insights

**What to Record:**
Record measurements in the Submission Template, Section 2, Evidence Item 1:
- For each page: LCP score, INP score, CLS score
- Performance category for each metric (Good/Needs Improvement/Poor)
- Screenshots of PageSpeed Insights results
- Summary of Core Web Vitals status

**Checkpoint:**
You've completed this step when:
- [ ] You have measured Core Web Vitals for all selected pages
- [ ] You have documented scores and categories
- [ ] You have recorded measurements in the Submission Template

---

### Step 3: Identify Performance Issues

**What to Do:**
For each page analyzed, identify specific performance issues:

1. **Review PageSpeed Insights recommendations:**
   - Check "Opportunities" section for optimization suggestions
   - Check "Diagnostics" section for additional information
   - Note specific issues affecting Core Web Vitals

2. **Identify issues by Core Web Vitals:**
   - **LCP issues:** Slow server response, render-blocking resources, slow resource load times
   - **INP issues:** Long JavaScript execution, heavy event handlers, layout thrashing
   - **CLS issues:** Images without dimensions, dynamically injected content, web fonts causing shifts

3. **Document issues:**
   - List specific issues found for each page
   - Note which Core Web Vitals each issue affects
   - Assess issue severity

**Tool to Use:**
Google PageSpeed Insights, Browser Developer Tools (optional)

**What to Record:**
Record issue identification in the Submission Template, Section 2, Evidence Item 2:
- For each page: list of performance issues found
- Issue categorization (LCP, INP, CLS related)
- Severity assessment for each issue
- Screenshots showing specific issues

**Checkpoint:**
You've completed this step when:
- [ ] You have identified performance issues for all pages
- [ ] You have categorized issues by Core Web Vitals
- [ ] You have recorded findings in the Submission Template

---

### Step 4: Compare Lab vs Field Data (If Available)

**What to Do:**
If Google Search Console is available, compare lab data (PageSpeed Insights) with field data (GSC):

1. **Access GSC Core Web Vitals report:**
   - Log into Google Search Console
   - Navigate to "Core Web Vitals" report
   - Review field data for your website

2. **Compare lab vs field data:**
   - Compare PageSpeed Insights lab scores with GSC field data
   - Note differences between lab and field measurements
   - Understand why differences exist

3. **Interpret data:**
   - Lab data: Simulated conditions, consistent testing
   - Field data: Real user conditions, variable
   - Which data is more relevant for SEO?

**Tool to Use:**
Google Search Console (if available), Google PageSpeed Insights

**What to Record:**
Record comparison in the Submission Template, Section 3:
- Lab data scores (from PageSpeed Insights)
- Field data scores (from GSC, if available)
- Comparison of lab vs field data
- Interpretation of differences
- Assessment of which data is more relevant

**Checkpoint:**
You've completed this step when:
- [ ] You have compared lab vs field data (if GSC available)
- [ ] You have interpreted differences
- [ ] You have recorded comparison in the Submission Template

---

### Step 5: Assess SEO Impact of Performance Issues

**What to Do:**
Assess how performance issues affect SEO:

1. **Connect issues to Core Web Vitals:**
   - How do LCP issues affect loading performance?
   - How do INP issues affect interactivity?
   - How do CLS issues affect visual stability?

2. **Assess SEO impact:**
   - How do poor Core Web Vitals affect rankings?
   - How do performance issues affect user behavior?
   - What's the SEO impact of each issue type?

3. **Prioritize by SEO impact:**
   - Which issues have greatest SEO impact?
   - Which Core Web Vitals are most critical?
   - What should be fixed first?

**Tool to Use:**
Documentation from previous steps, Day 10 Chapter 1 knowledge

**What to Record:**
Record SEO impact assessment in the Submission Template, Section 3:
- Assessment of how each issue type affects SEO
- Connection between Core Web Vitals and rankings
- Prioritization of issues by SEO impact
- Recommendations for addressing high-impact issues

**Checkpoint:**
You've completed this step when:
- [ ] You have assessed SEO impact of performance issues
- [ ] You have prioritized issues by SEO impact
- [ ] You have recorded assessment in the Submission Template

---

## Checkpoints

### Checkpoint 1: After Step 2 (Core Web Vitals Measurement)

Before proceeding, verify:
- [ ] You have measured Core Web Vitals for all selected pages
- [ ] You understand what LCP, INP, and CLS measure
- [ ] You have documented scores and categories
- [ ] Measurements are recorded in Submission Template

**Self-Validation:**
- Can you explain what each Core Web Vitals metric measures?
- Do you understand what "Good", "Needs Improvement", and "Poor" mean?
- Have you identified pages with performance issues?

---

### Checkpoint 2: After Step 4 (Data Comparison)

Before proceeding, verify:
- [ ] You have compared lab vs field data (if available)
- [ ] You understand differences between lab and field data
- [ ] You have interpreted data appropriately
- [ ] Comparison is recorded in Submission Template

**Self-Validation:**
- Can you explain the difference between lab and field data?
- Do you understand which data is more relevant for SEO?
- Have you identified patterns in performance data?

---

### Checkpoint 3: After Step 5 (Final Review)

Before submitting, verify:
- [ ] All analysis steps are complete
- [ ] Performance issues are identified
- [ ] SEO impact is assessed
- [ ] All evidence is captured in Submission Template
- [ ] Self-assessment is completed

**Self-Validation:**
- Do you understand how Core Web Vitals affect SEO?
- Can you identify performance issues?
- Do you understand how to diagnose performance problems?

---

## Completion Guidelines

### You're Done When:

- [ ] All lab steps have been completed
- [ ] Core Web Vitals have been measured for 3-5 pages
- [ ] Performance issues have been identified
- [ ] Lab vs field data has been compared (if GSC available)
- [ ] SEO impact has been assessed
- [ ] All evidence has been captured and recorded in Submission Template
- [ ] Performance analysis documentation is complete
- [ ] Self-assessment has been completed
- [ ] Submission Template has been saved/exported

### Before Submitting:

1. Review your Submission Template to ensure all sections are complete
2. Verify Core Web Vitals measurements are documented
3. Check that performance issues are identified
4. Ensure SEO impact assessment is complete
5. Complete the self-assessment honestly
6. Verify that your submission meets all requirements

### Submit Your Work:

Follow the Submission Instructions (Section 5) to submit your completed Submission Template.

---

## Troubleshooting

### Issue: PageSpeed Insights shows different scores each time

**Symptoms:**
You run PageSpeed Insights multiple times and get different scores.

**Solution:**
1. This is normal—lab data can vary based on network conditions
2. Run analysis 2-3 times and use average scores
3. Focus on identifying issues rather than exact scores
4. Field data (from GSC) is more stable if available

**If This Doesn't Work:**
Focus on understanding performance issues rather than exact scores. The learning objective is understanding Core Web Vitals, not perfect measurement.

---

### Issue: I don't have Google Search Console access

**Symptoms:**
You can't access GSC for field data comparison.

**Solution:**
1. Complete the lab using PageSpeed Insights alone
2. Focus on understanding lab data
3. Note that field data would provide additional insights
4. Document that GSC was not available

**If This Doesn't Work:**
The lab can be completed entirely with PageSpeed Insights. Field data is helpful but not required—lab data is sufficient for learning Core Web Vitals.

---

### Issue: I don't understand what the Core Web Vitals scores mean

**Symptoms:**
You're uncertain about what LCP, INP, and CLS scores indicate.

**Solution:**
1. Review Day 10 Chapter 1 for Core Web Vitals explanations
2. LCP measures loading (lower is better, <2.5s is good)
3. INP measures interactivity (lower is better, <200ms is good)
4. CLS measures visual stability (lower is better, <0.1 is good)
5. Focus on understanding what each metric measures conceptually

**If This Doesn't Work:**
Focus on identifying performance issues from PageSpeed Insights recommendations. The learning is in understanding performance problems, not perfect metric interpretation.

---

**END — Day 10, Lab 1: Core Web Vitals Diagnosis**

