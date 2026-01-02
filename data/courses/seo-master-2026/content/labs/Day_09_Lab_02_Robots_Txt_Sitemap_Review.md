# Day 9, Lab 2 — Robots.txt & Sitemap Review

**Day:** Day 9 — Technical SEO Foundations: Crawlability & Indexability  
**Lab Number:** Lab 2  
**Estimated Time:** 2-3 hours  
**Learning Outcomes Reinforced:**
- Use robots.txt and sitemaps correctly
- Identify crawlability and indexability issues confidently
- Avoid technical SEO mistakes that block growth

---

## Learning Objective

By completing this lab, you will review robots.txt files and XML sitemaps for your WordPress blog (or a provided website), identify misconfigurations and errors, and recommend corrections based on SEO best practices, demonstrating ability to use robots.txt and sitemaps correctly.

---

## Prerequisites

Before starting this lab, ensure you have:

- [ ] Read all Day 9 chapters:
  - Chapter 1: Technical SEO Foundations: Crawlability and Indexability
  - Chapter 2: Common Technical SEO Blockers and Diagnostics
- [ ] Access to required tools:
  - Browser Tools — Built into all modern browsers
  - Online XML Validator — Free online tools (optional but helpful)
  - WordPress Blog Editor — Access to your WordPress blog (required per course setup)
- [ ] Downloaded the Submission Template:
  - **Template:** [Day_9_Lab_2_Submission_Format.md](Day_9_Lab_2_Submission_Format.md)
  - **Location:** Available in your course materials or LMS

---

## Tools & Resources

### Primary Tools

**Browser Tools**
- **Purpose:** Browser tools enable you to access robots.txt and sitemap files, view their content, and inspect their structure. By reviewing these files, you'll understand how they control search engine access and identify configuration issues.
- **Access:** Built into all modern browsers
- **Note:** Basic browser usage for accessing files is sufficient.

**Online XML Validator (Optional)**
- **Purpose:** XML validators enable you to check if sitemap XML is well-formed and valid. By validating sitemaps, you'll identify syntax errors and structural problems.
- **Access:** Free online tools (search for "XML validator")
- **Note:** Optional but helpful for validating sitemap structure.

**WordPress Blog Editor**
- **Purpose:** WordPress enables you to access your blog's robots.txt and sitemap files. By reviewing your actual files, you'll understand how they're configured and identify issues.
- **Access:** Your WordPress blog (required per course setup)
- **Note:** If you can't access these files, you can review provided examples.

### Alternative Tools

If WordPress is unavailable, you can use:
- Any website — For reviewing robots.txt and sitemaps
- Provided website examples — If your own site is not available
- Manual file review — For understanding file structure

---

## Submission Instructions

### Step 1: Download Submission Template

Download and use the Submission Template for this lab:
- **Template:** [Day_9_Lab_2_Submission_Format.md](Day_9_Lab_2_Submission_Format.md)
- **Location:** Available in your course materials or LMS

### Step 2: Complete Submission Template

As you complete this lab, fill out the Submission Template. The template includes:
- Sections for robots.txt review
- Sitemap review
- Misconfiguration identification
- Correction recommendations
- Self-assessment components

### Step 3: Submit Your Work

- **Submission Method:** Submit via your LMS or as instructed by your instructor
- **Deadline:** As specified by your instructor
- **Format:** Markdown file or PDF export of your completed Submission Template

**Important:** Your submission must include all evidence specified in the Submission Template. Incomplete submissions will not be accepted.

---

## Lab Steps

### Step 1: Access and Review Robots.txt File

**What to Do:**
Access and review your website's robots.txt file:

1. **Access robots.txt:**
   - Navigate to: `yourdomain.com/robots.txt`
   - View robots.txt file in browser
   - Copy or screenshot the file content

2. **Review robots.txt structure:**
   - Check file format and syntax
   - Identify User-agent directives
   - Identify Disallow/Allow directives
   - Check for Sitemap reference
   - Verify file is properly formatted

3. **Document robots.txt content:**
   - List all directives found
   - Note what's being blocked/allowed
   - Identify any syntax issues

**Tool to Use:**
Browser (navigate to robots.txt URL)

**What to Record:**
Record robots.txt review in the Submission Template, Section 2, Evidence Item 1:
- Screenshot or copy of robots.txt file content
- List of all directives found
- Assessment of robots.txt structure
- Initial observations about configuration

**Checkpoint:**
You've completed this step when:
- [ ] You have accessed robots.txt file
- [ ] You have reviewed file structure
- [ ] You have documented content in the Submission Template

---

### Step 2: Validate Robots.txt Syntax and Directives

**What to Do:**
Validate robots.txt syntax and assess directive correctness:

1. **Check syntax:**
   - Verify proper User-agent format
   - Verify proper Disallow/Allow format
   - Check for syntax errors
   - Verify file structure is correct

2. **Assess directive correctness:**
   - Are Disallow directives appropriate?
   - Are important pages accidentally blocked?
   - Are directives too restrictive or too permissive?
   - Do directives align with SEO best practices?

3. **Identify syntax errors:**
   - Incorrect User-agent format
   - Incorrect Disallow/Allow format
   - Missing or incorrect syntax
   - File structure issues

**Tool to Use:**
Browser, Manual Review

**What to Record:**
Record validation in the Submission Template, Section 2, Evidence Item 2:
- Syntax validation results
- Directive correctness assessment
- List of syntax errors found (if any)
- Assessment of whether directives are appropriate
- Screenshots or notes showing specific issues

**Checkpoint:**
You've completed this step when:
- [ ] You have validated robots.txt syntax
- [ ] You have assessed directive correctness
- [ ] You have identified any errors
- [ ] You have recorded findings in the Submission Template

---

### Step 3: Review Robots.txt Best Practices

**What to Do:**
Assess robots.txt against SEO best practices from Day 9 Chapter 1:

1. **Check best practices compliance:**
   - Is robots.txt blocking appropriately?
   - Are important pages accessible?
   - Is robots.txt too restrictive?
   - Are directives following best practices?

2. **Identify best practice violations:**
   - Blocking important pages unnecessarily
   - Using `Disallow: /` incorrectly
   - Missing sitemap reference
   - Incorrect directive usage

3. **Assess impact:**
   - How do violations affect crawling?
   - Which violations are most critical?
   - What fixes are needed?

**Tool to Use:**
Documentation from Day 9 Chapter 1, Manual Review

**What to Record:**
Record best practices assessment in the Submission Template, Section 3:
- Best practices compliance assessment
- List of violations found
- Impact assessment for each violation
- Recommendations for addressing violations

**Checkpoint:**
You've completed this step when:
- [ ] You have assessed best practices compliance
- [ ] You have identified violations
- [ ] You have recorded findings in the Submission Template

---

### Step 4: Access and Review XML Sitemap

**What to Do:**
Access and review your website's XML sitemap:

1. **Find sitemap:**
   - Check robots.txt for sitemap reference
   - Try common sitemap URLs: `yourdomain.com/sitemap.xml`, `yourdomain.com/sitemap_index.xml`
   - Check WordPress sitemap plugin if applicable

2. **Review sitemap structure:**
   - Check XML format and syntax
   - Identify sitemap type (single sitemap vs sitemap index)
   - Review sitemap entries (URLs included)
   - Check sitemap size and limits

3. **Document sitemap content:**
   - List sitemap URL
   - Note sitemap type
   - Count URLs included (if small enough)
   - Identify sitemap structure

**Tool to Use:**
Browser (navigate to sitemap URL), Online XML Validator (optional)

**What to Record:**
Record sitemap review in the Submission Template, Section 2, Evidence Item 3:
- Screenshot or copy of sitemap (or portion if large)
- Sitemap URL
- Sitemap type (single vs index)
- Number of URLs included (if applicable)
- Assessment of sitemap structure

**Checkpoint:**
You've completed this step when:
- [ ] You have accessed sitemap file
- [ ] You have reviewed sitemap structure
- [ ] You have documented content in the Submission Template

---

### Step 5: Validate Sitemap Structure and Content

**What to Do:**
Validate sitemap XML structure and assess content:

1. **Check XML validity:**
   - Use online XML validator (if available)
   - Check for XML syntax errors
   - Verify sitemap follows XML sitemap protocol
   - Identify structural issues

2. **Assess sitemap content:**
   - Are important pages included?
   - Are low-value pages excluded appropriately?
   - Is sitemap complete?
   - Are URLs properly formatted?

3. **Check sitemap limits:**
   - Does sitemap exceed size limits (50,000 URLs, 50MB)?
   - Are there multiple sitemaps if needed?
   - Is sitemap index used if multiple sitemaps exist?

**Tool to Use:**
Online XML Validator (if available), Browser, Manual Review

**What to Record:**
Record validation in the Submission Template, Section 2, Evidence Item 4:
- XML validation results
- Content completeness assessment
- Identification of structural issues
- Assessment of sitemap limits compliance
- Screenshots or notes showing specific issues

**Checkpoint:**
You've completed this step when:
- [ ] You have validated sitemap structure
- [ ] You have assessed content completeness
- [ ] You have identified any issues
- [ ] You have recorded findings in the Submission Template

---

### Step 6: Review Sitemap Best Practices

**What to Do:**
Assess sitemap against SEO best practices from Day 9 Chapter 1:

1. **Check best practices compliance:**
   - Is sitemap properly formatted?
   - Are important pages included?
   - Are low-value pages excluded?
   - Is sitemap submitted to search engines?
   - Does sitemap follow size limits?

2. **Identify best practice violations:**
   - Missing important pages
   - Including low-value pages
   - Exceeding size limits
   - Incorrect XML format
   - Not submitted to search engines

3. **Assess impact:**
   - How do violations affect discovery?
   - Which violations are most critical?
   - What fixes are needed?

**Tool to Use:**
Documentation from Day 9 Chapter 1, Manual Review

**What to Record:**
Record best practices assessment in the Submission Template, Section 3:
- Best practices compliance assessment
- List of violations found
- Impact assessment for each violation
- Recommendations for addressing violations

**Checkpoint:**
You've completed this step when:
- [ ] You have assessed best practices compliance
- [ ] You have identified violations
- [ ] You have recorded findings in the Submission Template

---

### Step 7: Create Correction Recommendations

**What to Do:**
Create specific recommendations for fixing robots.txt and sitemap issues:

1. **Robots.txt corrections:**
   - Fix syntax errors
   - Correct inappropriate directives
   - Add missing sitemap reference
   - Document specific fixes needed

2. **Sitemap corrections:**
   - Fix XML syntax errors
   - Add missing important pages
   - Remove low-value pages if needed
   - Split sitemap if exceeding limits
   - Document specific fixes needed

3. **Prioritize corrections:**
   - High priority: Critical errors blocking access
   - Medium priority: Important improvements
   - Low priority: Minor optimizations

**Tool to Use:**
Documentation Tool

**What to Record:**
Record recommendations in the Submission Template, Section 3:
- Prioritized correction list
- Specific fixes for robots.txt
- Specific fixes for sitemap
- Implementation steps
- Expected impact of corrections

**Checkpoint:**
You've completed this step when:
- [ ] You have created correction recommendations
- [ ] Fixes are prioritized
- [ ] Specific actions are documented
- [ ] You have recorded recommendations in the Submission Template

---

## Checkpoints

### Checkpoint 1: After Step 2 (Robots.txt Validation)

Before proceeding, verify:
- [ ] You have validated robots.txt syntax
- [ ] You have assessed directive correctness
- [ ] You understand robots.txt structure
- [ ] Validation is recorded in Submission Template

**Self-Validation:**
- Can you explain what robots.txt does?
- Do you understand robots.txt syntax?
- Have you identified any syntax or directive errors?

---

### Checkpoint 2: After Step 5 (Sitemap Validation)

Before proceeding, verify:
- [ ] You have validated sitemap structure
- [ ] You have assessed content completeness
- [ ] You understand sitemap structure
- [ ] Validation is recorded in Submission Template

**Self-Validation:**
- Can you explain what sitemaps do?
- Do you understand sitemap structure?
- Have you identified any sitemap issues?

---

### Checkpoint 3: After Step 7 (Final Review)

Before submitting, verify:
- [ ] All review steps are complete
- [ ] Robots.txt and sitemap issues are identified
- [ ] Correction recommendations are created and prioritized
- [ ] All evidence is captured in Submission Template
- [ ] Self-assessment is completed

**Self-Validation:**
- Do you understand how to use robots.txt and sitemaps correctly?
- Can you identify misconfigurations?
- Do you have a clear plan for fixing issues?

---

## Completion Guidelines

### You're Done When:

- [ ] All lab steps have been completed
- [ ] Robots.txt file has been reviewed
- [ ] Robots.txt syntax and directives have been validated
- [ ] XML sitemap has been reviewed
- [ ] Sitemap structure has been validated
- [ ] Best practices compliance has been assessed
- [ ] Correction recommendations have been created
- [ ] All evidence has been captured and recorded in Submission Template
- [ ] Review documentation is complete
- [ ] Self-assessment has been completed
- [ ] Submission Template has been saved/exported

### Before Submitting:

1. Review your Submission Template to ensure all sections are complete
2. Verify robots.txt and sitemap reviews are detailed
3. Check that misconfigurations are documented
4. Ensure correction recommendations are actionable
5. Complete the self-assessment honestly
6. Verify that your submission meets all requirements

### Submit Your Work:

Follow the Submission Instructions (Section 5) to submit your completed Submission Template.

---

## Troubleshooting

### Issue: I can't find robots.txt or sitemap files

**Symptoms:**
You navigate to robots.txt or sitemap URLs but get 404 errors.

**Solution:**
1. Robots.txt or sitemap might not exist (which could be an issue)
2. Try different URLs or check WordPress plugins (some plugins create these files)
3. Check if files are in different locations
4. Document that files are missing if you can't find them

**If This Doesn't Work:**
Missing robots.txt or sitemap is itself a finding. Document that they don't exist and note whether this is an issue (robots.txt might be fine if no blocking needed, but sitemap is usually recommended).

---

### Issue: I don't understand robots.txt syntax

**Symptoms:**
You're uncertain about robots.txt format and syntax.

**Solution:**
1. Review Day 9 Chapter 1 for robots.txt syntax
2. Basic format: `User-agent: *` followed by `Disallow: /path`
3. Each directive on its own line
4. `*` means all search engines
5. Document what you observe even if uncertain

**If This Doesn't Work:**
Focus on identifying obvious issues (blocking everything with `Disallow: /`, obvious syntax errors). The learning is in understanding robots.txt conceptually, not perfect syntax mastery.

---

### Issue: I can't validate XML sitemap

**Symptoms:**
You're not sure how to check if sitemap XML is valid.

**Solution:**
1. Use online XML validator (search for "XML validator")
2. Copy sitemap content and paste into validator
3. Check for error messages
4. If sitemap displays in browser, it's likely well-formed
5. Focus on understanding sitemap structure rather than perfect validation

**If This Doesn't Work:**
Focus on reviewing sitemap content (what URLs are included, sitemap structure). The learning is in understanding sitemaps conceptually, not perfect XML validation.

---

**END — Day 9, Lab 2: Robots.txt & Sitemap Review**

