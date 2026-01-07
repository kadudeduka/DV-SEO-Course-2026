/**
 * Test Alias Generator
 * 
 * Demonstrates alias generation for sample concepts
 * 
 * Usage:
 *   node scripts/test-alias-generator.js
 */

import { aliasGeneratorService } from '../lms/services/alias-generator-service.js';

async function testAliasGeneration() {
    console.log('Testing Alias Generator Service\n');
    console.log('=' .repeat(60));
    
    const testCases = [
        {
            primaryTopic: "Technical SEO",
            definition: "SEO focused on site infrastructure, crawlability, and performance",
            nodeType: "concept"
        },
        {
            primaryTopic: "Keyword Research",
            definition: "The process of finding and analyzing search terms that users enter into search engines",
            nodeType: "concept"
        },
        {
            primaryTopic: "Answer Engine Optimization",
            definition: "Optimizing content for featured snippets and zero-click searches",
            nodeType: "concept"
        },
        {
            primaryTopic: "Link Building",
            definition: "The process of acquiring hyperlinks from other websites to your own",
            nodeType: "concept"
        },
        {
            primaryTopic: "Core Web Vitals",
            definition: "Metrics that measure user experience on a webpage including loading, interactivity, and visual stability",
            nodeType: "concept"
        }
    ];
    
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`\nTest Case ${i + 1}:`);
        console.log(`  Primary Topic: "${testCase.primaryTopic}"`);
        console.log(`  Definition: "${testCase.definition}"`);
        console.log(`  Node Type: ${testCase.nodeType}`);
        console.log('\n  Generating aliases...');
        
        try {
            const aliases = await aliasGeneratorService.generateAliases(
                testCase.primaryTopic,
                testCase.definition,
                testCase.nodeType
            );
            
            console.log(`\n  ✅ Generated ${aliases.length} aliases:`);
            aliases.forEach((alias, idx) => {
                console.log(`    ${idx + 1}. "${alias}"`);
            });
            
            // Validate aliases
            console.log('\n  Validation:');
            const hasLowercase = aliases.every(a => a === a.toLowerCase());
            const hasNoPunctuation = aliases.every(a => !/[^\w\s-]/.test(a));
            const hasNoDuplicates = new Set(aliases).size === aliases.length;
            const hasPrimaryTopic = aliases.includes(testCase.primaryTopic.toLowerCase());
            
            console.log(`    ✓ All lowercase: ${hasLowercase ? '✅' : '❌'}`);
            console.log(`    ✓ No punctuation: ${hasNoPunctuation ? '✅' : '❌'}`);
            console.log(`    ✓ No duplicates: ${hasNoDuplicates ? '✅' : '❌'}`);
            console.log(`    ✓ Includes primary topic: ${hasPrimaryTopic ? '✅' : '❌'}`);
            console.log(`    ✓ Count (2-8): ${aliases.length >= 2 && aliases.length <= 8 ? '✅' : '❌'}`);
            
        } catch (error) {
            console.error(`  ❌ Error: ${error.message}`);
        }
        
        console.log('\n' + '-'.repeat(60));
    }
    
    // Test cache
    console.log('\n\nTesting Cache:');
    console.log('='.repeat(60));
    
    const testTopic = "Technical SEO";
    const testDef = "SEO focused on site infrastructure";
    
    console.log(`\nFirst call (should hit LLM):`);
    const start1 = Date.now();
    const aliases1 = await aliasGeneratorService.generateAliases(testTopic, testDef, "concept");
    const time1 = Date.now() - start1;
    console.log(`  Generated ${aliases1.length} aliases in ${time1}ms`);
    
    console.log(`\nSecond call (should hit cache):`);
    const start2 = Date.now();
    const aliases2 = await aliasGeneratorService.generateAliases(testTopic, testDef, "concept");
    const time2 = Date.now() - start2;
    console.log(`  Generated ${aliases2.length} aliases in ${time2}ms`);
    console.log(`  Cache speedup: ${time1 > 0 ? Math.round((time1 / time2) * 100) / 100 : 'N/A'}x faster`);
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Test Complete!');
}

// Run tests
testAliasGeneration().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});

