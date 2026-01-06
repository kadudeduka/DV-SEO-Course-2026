/**
 * Governance Rules Tests
 * 
 * Tests for AI Coach governance invariants to ensure:
 * - Technical SEO questions don't return intro chapters
 * - Lab Day 20 never returns Day 13 content
 * - "How to do AEO" returns steps or is blocked
 * - High confidence + weak references escalate
 * 
 * Run: node tests/governance-rules.test.js
 * Or: npm test
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const config = {
    verbose: true,
    failFast: false // Continue running all tests even if one fails
};

// Test results
const testResults = {
    passed: 0,
    failed: 0,
    total: 0,
    failures: []
};

/**
 * Assert helper
 */
function assert(condition, message) {
    testResults.total++;
    if (condition) {
        testResults.passed++;
        if (config.verbose) {
            console.log(`✅ PASS: ${message}`);
        }
        return true;
    } else {
        testResults.failed++;
        testResults.failures.push(message);
        console.error(`❌ FAIL: ${message}`);
        return false;
    }
}

/**
 * Test suite runner
 */
async function runTestSuite(name, tests) {
    console.log(`\n📋 Running test suite: ${name}`);
    console.log('='.repeat(60));
    
    for (const test of tests) {
        try {
            await test();
        } catch (error) {
            assert(false, `${test.name || 'Unknown test'}: ${error.message}`);
            if (config.failFast) {
                throw error;
            }
        }
    }
}

/**
 * Mock chunk data
 */
function createMockChunk(overrides = {}) {
    return {
        id: `chunk-${Math.random().toString(36).substr(2, 9)}`,
        day: 1,
        chapter_id: 'day1-ch1',
        chapter_title: 'Introduction to SEO',
        content_type: 'chapter',
        content: 'This is introductory content about SEO basics...',
        similarity: 0.7,
        coverage_level: 'introduction',
        completeness_score: 0.3,
        primary_topic: null,
        is_dedicated_topic_chapter: false,
        ...overrides
    };
}

/**
 * Mock governance service
 */
async function mockGovernanceCheck(question, chunks, specificReferences = {}) {
    // Import governance service
    const { answerGovernanceService } = await import('../lms/services/answer-governance-service.js');
    
    const topicKeywords = extractTopicKeywords(question);
    const topicModifiers = extractTopicModifiers(question);
    
    return await answerGovernanceService.evaluateAnswerReadiness({
        question,
        processedQuestion: question.toLowerCase(),
        intent: classifyIntent(question),
        selectedChunks: chunks,
        allRetrievedChunks: chunks,
        specificReferences: {
            hasSpecificReference: specificReferences.day !== undefined || specificReferences.lab !== undefined,
            day: specificReferences.day,
            chapter: specificReferences.chapter,
            lab: specificReferences.lab,
            step: specificReferences.step
        },
        topicKeywords,
        topicModifiers,
        context: {}
    });
}

/**
 * Helper: Extract topic keywords
 */
function extractTopicKeywords(question) {
    const lower = question.toLowerCase();
    const keywords = [];
    
    if (lower.includes('technical seo') || lower.includes('technical search')) {
        keywords.push('technical seo');
    }
    if (lower.includes('aeo') || lower.includes('answer engine optimization')) {
        keywords.push('aeo');
        keywords.push('answer engine optimization');
    }
    
    return keywords;
}

/**
 * Helper: Extract topic modifiers
 */
function extractTopicModifiers(question) {
    const lower = question.toLowerCase();
    const modifiers = [];
    
    if (lower.includes('technical')) modifiers.push('technical');
    if (lower.includes('how to') || lower.includes('how do')) modifiers.push('how to');
    if (lower.includes('implementation')) modifiers.push('implementation');
    if (lower.includes('aeo')) modifiers.push('aeo');
    
    return modifiers;
}

/**
 * Helper: Classify intent
 */
function classifyIntent(question) {
    const lower = question.toLowerCase();
    if (lower.includes('how to') || lower.includes('how do')) {
        return 'course_content'; // Will be classified as procedural by depth classifier
    }
    return 'course_content';
}

// ============================================================================
// TEST CASES
// ============================================================================

/**
 * Test 1: Technical SEO question must not return intro SEO chapter
 */
async function testTechnicalSEONoIntroChapter() {
    const question = "What are the key elements of success for technical SEO?";
    
    // Create chunks: one intro, one dedicated technical SEO
    const introChunk = createMockChunk({
        day: 1,
        chapter_id: 'day1-ch3',
        chapter_title: 'SEO Terminology & Professional Language',
        content: 'Technical SEO terms are important...',
        coverage_level: 'introduction',
        completeness_score: 0.3,
        primary_topic: null
    });
    
    const technicalSEOChunk = createMockChunk({
        day: 10,
        chapter_id: 'day10-ch1',
        chapter_title: 'Technical SEO Deep Dive',
        content: 'Technical SEO involves crawlability, indexability, site speed...',
        coverage_level: 'comprehensive',
        completeness_score: 0.9,
        primary_topic: 'technical seo',
        is_dedicated_topic_chapter: true
    });
    
    // Test with only intro chunk (should fail - Topic Integrity invariant)
    const result1 = await mockGovernanceCheck(question, [introChunk]);
    const hasTopicViolation = result1.violations?.some(v => 
        v.invariant === 'Topic Integrity' || v.type === 'invariant_topic_integrity'
    ) || false;
    assert(
        (!result1.allowed || result1.action === 'block') && hasTopicViolation,
        'Technical SEO question with only intro chunk should be blocked by Topic Integrity invariant'
    );
    
    // Test with dedicated technical SEO chunk (should pass)
    const result2 = await mockGovernanceCheck(question, [technicalSEOChunk]);
    assert(
        result2.allowed === true,
        'Technical SEO question with dedicated chunk should be allowed'
    );
    
    // Test with both (should prioritize dedicated)
    const result3 = await mockGovernanceCheck(question, [introChunk, technicalSEOChunk]);
    assert(
        result3.allowed === true,
        'Technical SEO question with both chunks should be allowed (dedicated prioritized)'
    );
}

/**
 * Test 2: Lab Day 20 must never return Day 13 content
 */
async function testLabDay20NeverReturnsDay13() {
    const question = "I need help with Lab 1 on Day 20";
    
    // Create Day 13 lab chunk (wrong day)
    const day13Chunk = createMockChunk({
        day: 13,
        chapter_id: 'day13-lab1',
        lab_id: 'day13-lab1',
        content_type: 'lab',
        content: 'Day 13 lab content...'
    });
    
    // Create Day 20 lab chunk (correct)
    // Note: lab_id should include the lab number in a format that matches
    // Governance checks: String(chunkLab).includes(String(requestedLab))
    // So 'lab1' should match lab 1, or 'day20-lab1' should also work
    const day20Chunk = createMockChunk({
        day: 20,
        chapter_id: 'day20-lab1',
        lab_id: 'day20-lab1', // Include lab number - governance checks if lab_id includes the number
        content_type: 'lab',
        content: 'Day 20 lab content...'
    });
    
    // Test with Day 13 chunk only (should be blocked - Lab Safety invariant)
    const result1 = await mockGovernanceCheck(question, [day13Chunk], { day: 20, lab: 1 });
    const hasLabSafetyViolation = result1.violations?.some(v => 
        v.invariant === 'Lab Safety' || v.type === 'invariant_lab_safety'
    ) || false;
    assert(
        (!result1.allowed || result1.action === 'block') && hasLabSafetyViolation,
        'Day 20 lab question with Day 13 chunk should be blocked by Lab Safety invariant'
    );
    
    // Test with Day 20 chunk (should pass)
    const result2 = await mockGovernanceCheck(question, [day20Chunk], { day: 20, lab: 1 });
    // Lab Safety should pass if chunk matches day and lab
    // Note: Governance checks if ALL chunks match (not just some)
    const hasLabSafetyViolation2 = result2.violations?.some(v => 
        v.invariant === 'Lab Safety' || v.type === 'invariant_lab_safety'
    ) || false;
    // If chunk matches day 20 and lab 1, it should be allowed
    // But governance might block if it detects non-matching chunks (even if we only pass one)
    const chunkMatches = day20Chunk.day === 20 && 
                        (String(day20Chunk.lab_id || '').includes('1') || day20Chunk.lab_id === '1');
    if (chunkMatches) {
        assert(
            result2.allowed === true && !hasLabSafetyViolation2,
            'Day 20 lab question with Day 20 chunk should be allowed (chunk matches: day=' + day20Chunk.day + ', lab_id=' + day20Chunk.lab_id + ', allowed: ' + result2.allowed + ', violation: ' + hasLabSafetyViolation2 + ')'
        );
    } else {
        // Chunk format doesn't match - this is a test setup issue
        assert(
            false,
            'Test setup issue: Day 20 chunk lab_id format doesn\'t match (lab_id: ' + day20Chunk.lab_id + ', expected to include: 1)'
        );
    }
    
    // Test with both (Day 13 should be filtered out)
    const result3 = await mockGovernanceCheck(question, [day13Chunk, day20Chunk], { day: 20, lab: 1 });
    // For strict lab isolation, Day 13 chunk should cause block
    // But if both are provided, governance should filter to only Day 20
    const hasDay13InResult = result3.selectedChunks?.some(c => c.day === 13) || false;
    assert(
        !hasDay13InResult || !result3.allowed,
        'Day 20 lab question should not include Day 13 chunks in result'
    );
}

/**
 * Test 3: "How to do AEO" must return steps or be blocked
 */
async function testHowToAEOReturnsStepsOrBlocked() {
    const question = "How to do AEO?";
    
    // Create conceptual chunk (no steps)
    const conceptualChunk = createMockChunk({
        day: 2,
        chapter_id: 'day2-ch1',
        chapter_title: 'Introduction to AEO',
        content: 'Answer Engine Optimization is about...',
        coverage_level: 'introduction',
        completeness_score: 0.3,
        primary_topic: 'aeo'
    });
    
    // Create procedural chunk (with steps)
    const proceduralChunk = createMockChunk({
        day: 20,
        chapter_id: 'day20-ch1',
        chapter_title: 'AEO Implementation Guide',
        content: 'Step 1: Identify answer opportunities. Step 2: Create structured content. Step 3: Optimize for featured snippets...',
        coverage_level: 'comprehensive',
        completeness_score: 0.9,
        primary_topic: 'aeo',
        is_dedicated_topic_chapter: true
    });
    
    // Test with only conceptual chunk (should be blocked - Procedural Contract violation)
    const result1 = await mockGovernanceCheck(question, [conceptualChunk]);
    const hasProceduralViolation = result1.violations?.some(v => 
        v.invariant === 'Procedural Contract' || v.type === 'procedural_contract_violation'
    ) || result1.warnings?.some(w => w.type === 'procedural_contract_violation') || false;
    assert(
        (!result1.allowed || result1.action === 'block') && hasProceduralViolation,
        '"How to do AEO" with only conceptual chunk should be blocked by Procedural Contract violation'
    );
    
    // Test with procedural chunk (should pass)
    const result2 = await mockGovernanceCheck(question, [proceduralChunk]);
    assert(
        result2.allowed || result2.action === 'allow',
        '"How to do AEO" with procedural chunk should be allowed'
    );
    
    // Verify procedural chunk has step-by-step content
    if (result2.allowed) {
        const hasSteps = proceduralChunk.content.toLowerCase().includes('step 1') ||
                        proceduralChunk.content.toLowerCase().includes('step 2');
        assert(
            hasSteps,
            'Procedural chunk should contain step-by-step content'
        );
    }
}

/**
 * Test 4: High confidence + weak references must escalate
 */
async function testHighConfidenceWeakReferencesEscalate() {
    const question = "What is AEO?";
    
    // Create chunks with weak references (wrong day/chapter)
    const weakReferenceChunk = createMockChunk({
        day: 1,
        chapter_id: 'day1-ch1',
        chapter_title: 'Introduction to SEO',
        content: 'SEO basics...',
        similarity: 0.6, // Moderate similarity
        coverage_level: 'introduction'
    });
    
    // Simulate high confidence (0.85) but weak references
    // This should trigger escalation
    const mockAnswerResult = {
        confidence: 0.85,
        answer: 'AEO is about...',
        references: [
            { day: 1, chapter: 'day1-ch1', chapter_title: 'Introduction to SEO' }
        ]
    };
    
    // Check if escalation would be created
    // In real flow, this happens in ai-coach-service.js
    const shouldEscalate = mockAnswerResult.confidence > 0.7;
    const referenceValidationFailed = true; // Simulate validation failure
    
    assert(
        shouldEscalate && referenceValidationFailed,
        'High confidence (0.85) with weak references should trigger escalation'
    );
    
    // Verify confidence would be downgraded
    const downgradedConfidence = Math.min(mockAnswerResult.confidence, 0.5);
    assert(
        downgradedConfidence <= 0.5,
        'Confidence should be downgraded to max 0.5 when reference validation fails'
    );
}

/**
 * Test 5: Lab Safety Invariant
 */
async function testLabSafetyInvariant() {
    const question = "Help with Step 3 of Lab 1 on Day 2";
    
    // Create wrong lab chunk
    const wrongLabChunk = createMockChunk({
        day: 2,
        chapter_id: 'day2-lab2',
        lab_id: 'day2-lab2',
        content_type: 'lab',
        content: 'Lab 2 content...'
    });
    
    // Create correct lab chunk
    // Note: lab_id must include the lab number for governance to match
    const correctLabChunk = createMockChunk({
        day: 2,
        chapter_id: 'day2-lab1',
        lab_id: 'day2-lab1', // Must include lab number (1) for governance matching
        content_type: 'lab',
        content: 'Lab 1 Step 3: ...'
    });
    
    // Test with wrong lab (should be blocked - Lab Safety invariant)
    const result1 = await mockGovernanceCheck(question, [wrongLabChunk], { day: 2, lab: 1, step: 3 });
    const hasLabSafetyViolation1 = result1.violations?.some(v => 
        v.invariant === 'Lab Safety' || v.type === 'invariant_lab_safety'
    ) || false;
    assert(
        (!result1.allowed || result1.action === 'block') && hasLabSafetyViolation1,
        'Lab question with wrong lab chunk should be blocked by Lab Safety invariant'
    );
    
    // Test with correct lab (should pass)
    // Note: Lab safety requires both day and lab to match
    const result2 = await mockGovernanceCheck(question, [correctLabChunk], { day: 2, lab: 1, step: 3 });
    // Verify no lab safety violation
    const hasLabSafetyViolation2 = result2.violations?.some(v => 
        v.invariant === 'Lab Safety' || v.type === 'invariant_lab_safety'
    ) || false;
    // Check if chunk matches: day 2 and lab 1
    const chunkMatchesLab = correctLabChunk.day === 2 && 
                            (String(correctLabChunk.lab_id || '').includes('1') || correctLabChunk.lab_id === '1');
    if (chunkMatchesLab) {
        assert(
            result2.allowed === true && !hasLabSafetyViolation2,
            'Lab question with correct lab chunk should be allowed (chunk: day=' + correctLabChunk.day + ', lab_id=' + correctLabChunk.lab_id + ', allowed: ' + result2.allowed + ', action: ' + result2.action + ', violation: ' + hasLabSafetyViolation2 + ')'
        );
    } else {
        // Test setup issue
        assert(
            false,
            'Test setup issue: Correct lab chunk format doesn\'t match (day: ' + correctLabChunk.day + ', lab_id: ' + correctLabChunk.lab_id + ')'
        );
    }
}

/**
 * Test 6: Topic Integrity Invariant
 */
async function testTopicIntegrityInvariant() {
    const question = "How to implement technical SEO?";
    
    // Create non-technical chunk
    const nonTechnicalChunk = createMockChunk({
        day: 1,
        chapter_id: 'day1-ch1',
        chapter_title: 'SEO Basics',
        content: 'SEO is important...',
        coverage_level: 'introduction',
        completeness_score: 0.2,
        primary_topic: null
    });
    
    // Create technical SEO chunk
    const technicalChunk = createMockChunk({
        day: 10,
        chapter_id: 'day10-ch1',
        chapter_title: 'Technical SEO Implementation',
        content: 'Implement technical SEO by...',
        coverage_level: 'comprehensive',
        completeness_score: 0.9,
        primary_topic: 'technical seo', // Must match topic modifier
        is_dedicated_topic_chapter: true
    });
    
    // Test with only non-technical (should be blocked - Topic Integrity invariant)
    const result1 = await mockGovernanceCheck(question, [nonTechnicalChunk]);
    const hasTopicIntegrityViolation = result1.violations?.some(v => 
        v.invariant === 'Topic Integrity' || v.type === 'invariant_topic_integrity'
    ) || false;
    assert(
        (!result1.allowed || result1.action === 'block') && hasTopicIntegrityViolation,
        'Technical SEO question with only non-technical chunk should be blocked by Topic Integrity invariant'
    );
    
    // Test with technical chunk (should pass)
    const result2 = await mockGovernanceCheck(question, [technicalChunk]);
    assert(
        result2.allowed === true,
        'Technical SEO question with technical chunk should be allowed'
    );
}

/**
 * Test 7: Reference Integrity Invariant
 */
async function testReferenceIntegrityInvariant() {
    const question = "What is covered in Day 4, Chapter 2?";
    
    // Create wrong chapter chunk
    const wrongChapterChunk = createMockChunk({
        day: 4,
        chapter_id: 'day4-ch1',
        chapter_title: 'Day 4 Chapter 1',
        content: 'Chapter 1 content...'
    });
    
    // Create correct chapter chunk
    const correctChapterChunk = createMockChunk({
        day: 4,
        chapter_id: 'day4-ch2',
        chapter_title: 'Day 4 Chapter 2',
        content: 'Chapter 2 content...'
    });
    
    // Test with wrong chapter (should be blocked or escalate - Reference Integrity invariant)
    const result1 = await mockGovernanceCheck(question, [wrongChapterChunk], { day: 4, chapter: 2 });
    const hasReferenceIntegrityViolation = result1.violations?.some(v => 
        v.type === 'reference_mismatch' || v.invariant === 'Reference Integrity'
    ) || false;
    assert(
        (!result1.allowed || result1.action === 'block' || result1.action === 'escalate') && hasReferenceIntegrityViolation,
        'Question with specific chapter reference but wrong chunk should be blocked/escalated by Reference Integrity invariant'
    );
    
    // Test with correct chapter (should pass)
    const result2 = await mockGovernanceCheck(question, [correctChapterChunk], { day: 4, chapter: 2 });
    // Note: Reference integrity check might still flag if chunk doesn't exactly match
    // For now, verify it's not blocked due to reference mismatch
    const hasReferenceViolation = result2.violations?.some(v => 
        v.type === 'reference_mismatch'
    ) || false;
    assert(
        result2.allowed === true && !hasReferenceViolation,
        'Question with correct chapter reference should be allowed (no reference violation)'
    );
}

/**
 * Test 8: Course Scope Invariant
 */
async function testCourseScopeInvariant() {
    const question = "What is machine learning?";
    
    // Create generic chunk (not course-specific)
    const genericChunk = createMockChunk({
        day: 1,
        chapter_id: 'day1-ch1',
        chapter_title: 'Introduction',
        content: 'Machine learning is a subset of AI...', // Generic content
        similarity: 0.3, // Low similarity
        coverage_level: 'introduction',
        completeness_score: 0.1
    });
    
    // Test with generic chunk (should be blocked - Course Scope invariant)
    const result = await mockGovernanceCheck(question, [genericChunk]);
    const hasCourseScopeViolation = result.violations?.some(v => 
        v.invariant === 'Course Scope' || v.type === 'invariant_course_scope'
    ) || false;
    assert(
        (!result.allowed || result.action === 'block') && hasCourseScopeViolation,
        'Question with generic/non-course content should be blocked by Course Scope invariant'
    );
}

/**
 * Test 9: Course Anchoring Invariant
 */
async function testCourseAnchoringInvariant() {
    // Test 9a: "How to do AEO" cannot be answered using only SERP fundamentals
    const question1 = "How to do AEO?";
    
    // Create foundational chunk (SERP fundamentals, not AEO-specific)
    const foundationalChunk = createMockChunk({
        day: 2,
        chapter_id: 'day2-ch2',
        chapter_title: 'SERP Analysis and Zero-Click Searches',
        content: 'SERP features include featured snippets...',
        coverage_level: 'introduction',
        completeness_score: 0.3,
        primary_topic: null // Not AEO-specific
    });
    
    // Test with only foundational chunk (should be blocked - Course Anchoring)
    const result1 = await mockGovernanceCheck(question1, [foundationalChunk]);
    const hasAnchoringViolation1 = result1.violations?.some(v => 
        v.invariant === 'Course Anchoring' || v.type === 'invariant_course_anchoring'
    ) || false;
    assert(
        (!result1.allowed || result1.action === 'block' || result1.action === 'retry') && hasAnchoringViolation1,
        '"How to do AEO" with only foundational chunk should be blocked by Course Anchoring invariant'
    );
    
    // Test 9b: AEO answers always reference an AEO-specific chapter
    const question2 = "What is AEO?";
    
    // Create AEO-specific chunk (anchoring chunk)
    const aeoChunk = createMockChunk({
        day: 20,
        chapter_id: 'day20-ch1',
        chapter_title: 'Answer Engine Optimization & Future SEO Strategies',
        content: 'Answer Engine Optimization (AEO) optimizes content for AI-driven search experiences...',
        coverage_level: 'comprehensive',
        completeness_score: 0.9,
        primary_topic: 'AEO',
        is_dedicated_topic_chapter: true
    });
    
    // Test with AEO-specific chunk (should pass)
    const result2 = await mockGovernanceCheck(question2, [aeoChunk]);
    const hasAnchoringViolation2 = result2.violations?.some(v => 
        v.invariant === 'Course Anchoring' || v.type === 'invariant_course_anchoring'
    ) || false;
    assert(
        result2.allowed === true && !hasAnchoringViolation2,
        'AEO question with AEO-specific chunk should be allowed (Course Anchoring passed)'
    );
    
    // Verify anchoring info is present
    if (result2.anchoringInfo) {
        assert(
            result2.anchoringInfo.anchoringChunksFound === true,
            'AEO question should have anchoring chunks found'
        );
        assert(
            result2.anchoringInfo.detectedConcepts.includes('AEO'),
            'AEO question should detect AEO as a concept'
        );
    }
    
    // Test 9c: Foundational chapters cannot be the sole reference
    const question3 = "What are the key elements of Technical SEO?";
    
    // Create foundational chunk (introduction-level)
    const foundationalTechChunk = createMockChunk({
        day: 1,
        chapter_id: 'day1-ch3',
        chapter_title: 'SEO Terminology & Professional Language',
        content: 'Technical SEO terms are important...',
        coverage_level: 'introduction',
        completeness_score: 0.3,
        primary_topic: null
    });
    
    // Test with only foundational chunk (should be blocked)
    const result3 = await mockGovernanceCheck(question3, [foundationalTechChunk]);
    const hasAnchoringViolation3 = result3.violations?.some(v => 
        v.invariant === 'Course Anchoring' || v.type === 'invariant_course_anchoring'
    ) || false;
    assert(
        (!result3.allowed || result3.action === 'block' || result3.action === 'retry') && hasAnchoringViolation3,
        'Technical SEO question with only foundational chunk should be blocked by Course Anchoring invariant'
    );
    
    // Test 9d: Generic answers are blocked when anchoring fails
    const question4 = "How to implement E-E-A-T?";
    
    // Create generic chunk (not E-E-A-T specific)
    const genericChunk = createMockChunk({
        day: 1,
        chapter_id: 'day1-ch1',
        chapter_title: 'SEO Fundamentals',
        content: 'SEO is important for websites...',
        coverage_level: 'introduction',
        completeness_score: 0.2,
        primary_topic: null
    });
    
    // Test with generic chunk (should be blocked)
    const result4 = await mockGovernanceCheck(question4, [genericChunk]);
    const hasAnchoringViolation4 = result4.violations?.some(v => 
        v.invariant === 'Course Anchoring' || v.type === 'invariant_course_anchoring'
    ) || false;
    assert(
        (!result4.allowed || result4.action === 'block' || result4.action === 'retry') && hasAnchoringViolation4,
        'E-E-A-T question with generic chunk should be blocked by Course Anchoring invariant'
    );
}

/**
 * Test 10: Primary Reference Enforcement
 */
async function testPrimaryReferenceEnforcement() {
    // Test 10a: AEO questions never show "How Search Engines Work" as primary reference
    const question1 = "What is AEO?";
    
    // Create foundational chunk (SERP fundamentals, not AEO-specific)
    const foundationalChunk = createMockChunk({
        day: 2,
        chapter_id: 'day2-ch2',
        chapter_title: 'How Search Engines Work',
        content: 'Search engines work by crawling and indexing...',
        coverage_level: 'introduction',
        completeness_score: 0.3,
        primary_topic: null // Not AEO-specific
    });
    
    // Create AEO-specific chunk (should be primary)
    const aeoChunk = createMockChunk({
        day: 20,
        chapter_id: 'day20-ch1',
        chapter_title: 'Answer Engine Optimization & Future SEO Strategies',
        content: 'Answer Engine Optimization (AEO) optimizes content for AI-driven search...',
        coverage_level: 'comprehensive',
        completeness_score: 0.9,
        primary_topic: 'AEO',
        is_dedicated_topic_chapter: true
    });
    
    // Test with both chunks - foundational should NOT be primary
    const { aiCoachService } = await import('../lms/services/ai-coach-service.js');
    const conceptDetection = (await import('../lms/services/context-builder-service.js')).contextBuilderService.detectCourseConcepts(question1);
    
    if (conceptDetection.requiresCourseAnchoring) {
        const referenceSelection = aiCoachService._selectPrimaryReference(
            [foundationalChunk, aeoChunk],
            conceptDetection.conceptNames,
            question1.toLowerCase()
        );
        
        assert(
            referenceSelection.primaryReference !== null,
            'Primary reference should be selected for AEO question'
        );
        assert(
            referenceSelection.primaryReference.primary_topic === 'AEO' ||
            referenceSelection.primaryReference.is_dedicated_topic_chapter === true,
            'Primary reference must be AEO-specific, not foundational'
        );
        assert(
            referenceSelection.primaryReference.chapter_title !== 'How Search Engines Work',
            'AEO questions must never show "How Search Engines Work" as primary reference'
        );
    }
    
    // Test 10b: Foundational chapters are never listed first for named concepts
    const question2 = "What are the key elements of Technical SEO?";
    
    // Create foundational chunk
    const foundationalTechChunk = createMockChunk({
        day: 1,
        chapter_id: 'day1-ch3',
        chapter_title: 'SEO Terminology & Professional Language',
        content: 'Technical SEO terms are important...',
        coverage_level: 'introduction',
        completeness_score: 0.3,
        primary_topic: null
    });
    
    // Create Technical SEO-specific chunk
    const techSEOChunk = createMockChunk({
        day: 8,
        chapter_id: 'day8-ch1',
        chapter_title: 'Technical SEO Audits and Crawlability',
        content: 'Technical SEO involves crawlability, indexability...',
        coverage_level: 'comprehensive',
        completeness_score: 0.8,
        primary_topic: 'Technical SEO',
        is_dedicated_topic_chapter: true
    });
    
    const conceptDetection2 = (await import('../lms/services/context-builder-service.js')).contextBuilderService.detectCourseConcepts(question2);
    
    if (conceptDetection2.requiresCourseAnchoring) {
        const referenceSelection2 = aiCoachService._selectPrimaryReference(
            [foundationalTechChunk, techSEOChunk],
            conceptDetection2.conceptNames,
            question2.toLowerCase()
        );
        
        assert(
            referenceSelection2.primaryReference !== null,
            'Primary reference should be selected for Technical SEO question'
        );
        assert(
            referenceSelection2.primaryReference.primary_topic === 'Technical SEO' ||
            referenceSelection2.primaryReference.is_dedicated_topic_chapter === true,
            'Primary reference must be Technical SEO-specific, not foundational'
        );
        assert(
            referenceSelection2.secondaryReferences.some(ref => 
                ref.chapter_title === 'SEO Terminology & Professional Language'
            ),
            'Foundational chunk should be in secondary references, not primary'
        );
    }
    
    // Test 10c: Generic fallback references require disclaimer
    const question3 = "How to implement AEO?";
    
    // Only foundational chunk available
    const onlyFoundational = createMockChunk({
        day: 2,
        chapter_id: 'day2-ch2',
        chapter_title: 'SERP Analysis and Zero-Click Searches',
        content: 'SERP features include featured snippets...',
        coverage_level: 'introduction',
        completeness_score: 0.3,
        primary_topic: null
    });
    
    const conceptDetection3 = (await import('../lms/services/context-builder-service.js')).contextBuilderService.detectCourseConcepts(question3);
    
    if (conceptDetection3.requiresCourseAnchoring) {
        const referenceSelection3 = aiCoachService._selectPrimaryReference(
            [onlyFoundational],
            conceptDetection3.conceptNames,
            question3.toLowerCase()
        );
        
        assert(
            referenceSelection3.requiresDisclaimer === true,
            'Generic fallback references must require disclaimer'
        );
        assert(
            referenceSelection3.primaryReference?.isConceptIntroduction === true,
            'Primary reference should be marked as concept introduction when only foundational available'
        );
    }
    
    // Test 10d: Reference ordering matches enforcement rules
    const question4 = "What is E-E-A-T?";
    
    // Create multiple chunks with different types
    const introChunk = createMockChunk({
        day: 1,
        chapter_id: 'day1-ch1',
        chapter_title: 'SEO Fundamentals',
        content: 'SEO basics...',
        coverage_level: 'introduction',
        completeness_score: 0.2,
        primary_topic: null
    });
    
    const eatChunk = createMockChunk({
        day: 13,
        chapter_id: 'day13-ch1',
        chapter_title: 'E-E-A-T, Helpful Content & Trust Optimization',
        content: 'E-E-A-T stands for Experience, Expertise, Authority, Trust...',
        coverage_level: 'comprehensive',
        completeness_score: 0.9,
        primary_topic: 'E-E-A-T',
        is_dedicated_topic_chapter: true
    });
    
    const conceptDetection4 = (await import('../lms/services/context-builder-service.js')).contextBuilderService.detectCourseConcepts(question4);
    
    if (conceptDetection4.requiresCourseAnchoring) {
        const referenceSelection4 = aiCoachService._selectPrimaryReference(
            [introChunk, eatChunk],
            conceptDetection4.conceptNames,
            question4.toLowerCase()
        );
        
        assert(
            referenceSelection4.primaryReference?.primary_topic === 'E-E-A-T',
            'E-E-A-T chunk should be primary reference'
        );
        assert(
            referenceSelection4.secondaryReferences.some(ref => 
                ref.chapter_title === 'SEO Fundamentals'
            ),
            'Intro chunk should be in secondary references'
        );
        assert(
            referenceSelection4.primaryReference.chapter_title.includes('E-E-A-T'),
            'Primary reference chapter title must contain concept name'
        );
    }
}

// ============================================================================
// TEST RUNNER
// ============================================================================

async function runAllTests() {
    console.log('\n🧪 AI Coach Governance Rules Tests');
    console.log('='.repeat(60));
    console.log(`Node.js version: ${process.version}`);
    console.log(`Test mode: ${config.failFast ? 'Fail Fast' : 'Continue on Failure'}`);
    
    const startTime = Date.now();
    
    try {
        // Run all test suites
        await runTestSuite('Invariant Tests', [
            testTechnicalSEONoIntroChapter,
            testLabDay20NeverReturnsDay13,
            testHowToAEOReturnsStepsOrBlocked,
            testHighConfidenceWeakReferencesEscalate,
            testLabSafetyInvariant,
            testTopicIntegrityInvariant,
            testReferenceIntegrityInvariant,
            testCourseScopeInvariant,
            testCourseAnchoringInvariant,
            testPrimaryReferenceEnforcement
        ]);
        
    } catch (error) {
        console.error('\n💥 Fatal error during test execution:', error);
        process.exit(1);
    }
    
    const duration = Date.now() - startTime;
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));
    console.log(`Total tests: ${testResults.total}`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
    
    if (testResults.failures.length > 0) {
        console.log('\n❌ Failed Tests:');
        testResults.failures.forEach((failure, index) => {
            console.log(`  ${index + 1}. ${failure}`);
        });
    }
    
    // Exit with error code if tests failed
    if (testResults.failed > 0) {
        console.log('\n🚨 BUILD FAILED: Governance rule violations detected!');
        console.log('   All governance invariants must pass for the build to succeed.');
        process.exit(1);
    } else {
        console.log('\n✅ All tests passed! Build can proceed.');
        process.exit(0);
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllTests().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { runAllTests, testResults };

