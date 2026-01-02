# Reports Feature - Testing Guide

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Manual Testing Phase

---

## Overview

This guide provides a comprehensive testing checklist for the Reports feature. Use this to verify all functionality before production deployment.

---

## Pre-Testing Setup

### Prerequisites
- [ ] Database migration executed (`backend/migration-reports-tables.sql`)
- [ ] At least 2-3 test users with different roles (Learner, Trainer, Admin)
- [ ] Test courses with chapters and labs
- [ ] Test data: course allocations, lab submissions, progress records
- [ ] Browser: Chrome, Firefox, Safari (latest versions)

---

## Manual Testing Checklist

### Phase 1: Learner Reports

#### Learner Dashboard (`/reports/learner`)
- [ ] Page loads without errors
- [ ] Statistics cards display correct data:
  - [ ] Total Courses
  - [ ] Overall Progress (with 75% labs / 25% chapters weighting)
  - [ ] Labs Submitted
  - [ ] Average Lab Score
- [ ] Progress Summary section shows:
  - [ ] Overall Progress percentage
  - [ ] Chapters Completed count
  - [ ] Labs Submitted count
  - [ ] Note about 75% labs / 25% chapters weighting
- [ ] Course Breakdown table displays:
  - [ ] All assigned courses
  - [ ] Progress for each course
  - [ ] Status (Not Started, In Progress, Completed)
  - [ ] "View Details" link works
- [ ] No filters visible (as per requirements)
- [ ] Export options work (CSV, Print)

#### Learner Course Report (`/reports/learner/course/:courseId`)
- [ ] Page loads with correct course data
- [ ] Overview tab shows:
  - [ ] Course statistics
  - [ ] Progress percentage
  - [ ] Time spent
  - [ ] Chapters completed
  - [ ] Labs submitted
- [ ] Chapters tab shows:
  - [ ] All chapters from course structure
  - [ ] Completion status
  - [ ] Time spent per chapter
- [ ] Labs tab shows:
  - [ ] All labs
  - [ ] Submission status
  - [ ] Scores (0-10 scale)
  - [ ] Review status
- [ ] Activity Timeline tab shows:
  - [ ] Chronological events
  - [ ] Correct dates
  - [ ] Event types (chapter completion, lab submission, etc.)
- [ ] Back button navigates correctly
- [ ] Export options work

---

### Phase 2: Trainer Reports

#### Trainer Dashboard (`/reports/trainer`)
- [ ] Page loads without errors
- [ ] Summary statistics display:
  - [ ] Total Learners
  - [ ] Active Learners
  - [ ] Average Progress
  - [ ] Average Lab Score
- [ ] Learner table shows:
  - [ ] All assigned learners
  - [ ] Progress for each learner
  - [ ] Status (On Track, Needs Attention, At Risk)
  - [ ] Status reason displayed for At Risk/Needs Attention
  - [ ] "View Details" link works
- [ ] Filters work (if implemented):
  - [ ] Learner type filter
  - [ ] Status filter
  - [ ] Search
- [ ] Export options work

#### Individual Learner Report (`/reports/trainer/learner/:learnerId`)
- [ ] Page loads with correct learner data
- [ ] Learner Profile section shows:
  - [ ] Email
  - [ ] Learner Type
  - [ ] Days Since Registration
  - [ ] Status with reason (if At Risk/Needs Attention)
- [ ] Overview Statistics show:
  - [ ] Total Courses
  - [ ] Overall Progress
  - [ ] Courses Completed
  - [ ] Labs Submitted
  - [ ] Avg Lab Score
- [ ] Course Performance table shows:
  - [ ] All courses
  - [ ] Progress (formatted with one decimal place)
  - [ ] Status
  - [ ] Time Spent
  - [ ] Labs submitted/total
  - [ ] Average Score
- [ ] Lab Evaluation section shows:
  - [ ] Lab statistics
  - [ ] Evaluation breakdown
- [ ] Activity Timeline shows:
  - [ ] Recent activity
  - [ ] Correct dates
- [ ] Back button navigates correctly
- [ ] Export options work

#### Course Performance Report (`/reports/trainer/course/:courseId`)
- [ ] Page loads with correct course data
- [ ] Course overview shows:
  - [ ] Total Learners
  - [ ] Average Progress
  - [ ] Average Lab Score
- [ ] Learner Performance table shows:
  - [ ] All learners in course
  - [ ] Individual progress
  - [ ] Lab scores
- [ ] Chapter Analysis shows:
  - [ ] All chapters
  - [ ] Completion rates (not 0% if chapters are completed)
  - [ ] Average time to complete
- [ ] Lab Analysis shows:
  - [ ] All labs
  - [ ] Submission rates
  - [ ] Average scores
  - [ ] Resubmission rates
- [ ] Export options work

---

### Phase 3: Admin Reports

#### Admin Dashboard (`/reports/admin`)
- [ ] Page loads without errors
- [ ] System Overview shows:
  - [ ] Total Users (correct count)
  - [ ] Total Learners (correct count)
  - [ ] Total Trainers (correct count)
  - [ ] Total Courses (correct count, not 0)
  - [ ] Published Courses (correct count)
  - [ ] Active Users Last 30 days (correct count)
  - [ ] Average Completion Rate
  - [ ] Average Lab Score
- [ ] Quick Access cards work:
  - [ ] Course Performance
  - [ ] Trainer Performance
  - [ ] Learner Performance
- [ ] Layout is responsive (no text wrapping)
- [ ] Export options work

#### Course Performance Report (`/reports/admin/course/:courseId`)
- [ ] Page loads with correct course data
- [ ] Course overview shows:
  - [ ] Total Enrollments
  - [ ] Active Learners
  - [ ] Completion Rate
  - [ ] Average Progress
  - [ ] Average Lab Score
- [ ] Learner Performance table shows:
  - [ ] All learners enrolled
  - [ ] Individual progress
  - [ ] Lab scores
- [ ] Chapter Analysis shows:
  - [ ] All chapters
  - [ ] Completion rates (not 0% if chapters are completed)
  - [ ] Average time to complete
- [ ] Lab Analysis shows:
  - [ ] All labs
  - [ ] Submission rates
  - [ ] Average scores
- [ ] Export options work

#### Learner Performance Report (`/reports/admin/learners`)
- [ ] Page loads with learner list
- [ ] Table shows:
  - [ ] All learners
  - [ ] Progress
  - [ ] Status
  - [ ] Courses count
  - [ ] Lab scores
- [ ] "View Detailed Report" link works
- [ ] Individual learner report loads correctly
- [ ] Course "View Details" link works
- [ ] Export options work

#### Tag Management (`/reports/admin/tags`)
- [ ] Page loads
- [ ] Tag list displays
- [ ] Create tag works
- [ ] Edit tag works
- [ ] Delete tag works (with confirmation)
- [ ] Tag assignment works (single and bulk)
- [ ] Tag usage statistics display

#### Tag-Based Reports (`/reports/admin/tag-reports`)
- [ ] Tag selection works (multi-select)
- [ ] "Load Report" button works
- [ ] Report displays after loading
- [ ] Statistics are correct
- [ ] Learner breakdown shows tagged learners
- [ ] Export options work

---

### Phase 4: Cross-Feature Testing

#### Progress Calculation Consistency
- [ ] Learner interface shows same progress as reports
- [ ] Admin interface shows same progress as trainer interface
- [ ] Progress uses 75% labs / 25% chapters weighting consistently
- [ ] Progress displayed with one decimal place everywhere

#### Chapter Completion
- [ ] Chapters show as completed in reports when marked complete
- [ ] Chapter completion rates are not 0% when chapters are completed
- [ ] Chapter counts match between interfaces

#### Lab Scoring
- [ ] Lab scores display correctly (0-10 scale)
- [ ] Scores convert to percentages (0-100) in reports
- [ ] Average lab scores calculate correctly
- [ ] Score input is required in lab review

#### Navigation
- [ ] All "View Details" links work
- [ ] Back buttons navigate correctly
- [ ] Breadcrumbs work (if present)
- [ ] Menu links point to correct routes

#### Export Functionality
- [ ] CSV export works for all report types
- [ ] CSV files open correctly in Excel/Google Sheets
- [ ] Print functionality works (Ctrl/Cmd + P)
- [ ] Print styles are applied correctly
- [ ] PDF export shows "coming soon" message (if not implemented)

#### Mobile Responsiveness
- [ ] Reports display correctly on mobile (< 768px)
- [ ] Tables scroll horizontally on mobile
- [ ] Cards stack vertically on mobile
- [ ] Buttons are touch-friendly
- [ ] Text is readable on mobile

#### Accessibility
- [ ] Keyboard navigation works (Tab, Enter, Space)
- [ ] Focus indicators are visible
- [ ] Screen reader can navigate reports (test with NVDA/JAWS)
- [ ] Color contrast meets WCAG AA standards
- [ ] ARIA labels are present

#### Performance
- [ ] Reports load within 3 seconds
- [ ] Large datasets (100+ learners) load without freezing
- [ ] Caching works (second load is faster)
- [ ] No memory leaks (check browser DevTools)

---

## Known Issues to Verify Fixed

### Progress Calculation
- [x] Progress uses 75% labs / 25% chapters weighting
- [x] Progress displayed with one decimal place
- [x] Consistent across all interfaces

### Chapter Completion
- [x] Chapters counted correctly in reports
- [x] Chapter completion rates not showing 0% when chapters are completed
- [x] Chapter IDs match between course structure and user_progress

### Lab Scoring
- [x] Scores stored as 0-10 in database
- [x] Scores converted to 0-100 in reports
- [x] Score input required in lab review

### Navigation
- [x] "View Details" links work correctly
- [x] Admin can view learner course reports
- [x] Trainer can view individual learner reports

---

## Test Data Scenarios

### Scenario 1: New Learner
- User with 1 course allocated
- 0 chapters completed
- 0 labs submitted
- Expected: 0% progress, "Not Started" status

### Scenario 2: Active Learner
- User with 1 course allocated
- 4 chapters completed (out of 36)
- 3 labs submitted (out of 40)
- Expected: ~9% progress (4/36 * 0.25 + 3/40 * 0.75)
- Status: "On Track" or "Needs Attention" based on activity

### Scenario 3: At Risk Learner
- User with no activity for > 14 days
- Or average lab score < 50%
- Expected: "At Risk" status with reason displayed

### Scenario 4: Completed Course
- User with 1 course
- All chapters completed
- All labs submitted and approved
- Expected: 100% progress, "Completed" status

---

## Browser Compatibility

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Chrome
- [ ] Mobile Safari

---

## Performance Benchmarks

- [ ] Dashboard loads: < 2 seconds
- [ ] Course report loads: < 3 seconds
- [ ] Large table (100+ rows): < 5 seconds
- [ ] CSV export: < 1 second
- [ ] Print preview: < 2 seconds

---

## Security Testing

- [ ] Learners cannot access other learners' reports
- [ ] Trainers cannot access unassigned learners
- [ ] Admins can access all reports
- [ ] RLS policies enforced in database
- [ ] No sensitive data exposed in client-side code

---

## Regression Testing

After fixes, verify:
- [ ] Progress calculation still correct
- [ ] Chapter completion still shows
- [ ] Lab scores still display
- [ ] Navigation still works
- [ ] Export still functions

---

## Sign-Off

**Tester Name:** _________________  
**Date:** _________________  
**Status:** [ ] Pass [ ] Fail [ ] Needs Review  
**Notes:** _________________

---

## Next Steps After Testing

1. **If all tests pass:**
   - Deploy to staging
   - User acceptance testing
   - Production deployment

2. **If issues found:**
   - Document bugs
   - Prioritize fixes
   - Re-test after fixes

3. **For automated testing:**
   - Set up testing framework (Jest, Cypress, etc.)
   - Write unit tests for services
   - Write integration tests for components
   - Set up CI/CD pipeline

---

## Automated Testing (Future)

When ready to implement automated testing:

### Unit Tests
- `analytics-service.js` - Progress calculations
- `report-service.js` - Data aggregation
- `tag-service.js` - CRUD operations

### Integration Tests
- Report components render correctly
- Data flows from service to component
- Export functions work

### E2E Tests
- User can view their reports
- Trainer can view learner reports
- Admin can view all reports
- Export functions work

### Performance Tests
- Load time benchmarks
- Memory usage
- Cache effectiveness

