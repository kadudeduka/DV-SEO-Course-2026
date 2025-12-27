// Course Structure Data
// This file contains the complete course structure with all days, chapters, and labs

const courseData = {
    title: "SEO Master Course 2025",
    subtitle: "Comprehensive SEO Training Program",
    totalDays: 20,
    totalChapters: 36,
    totalLabs: 22,
    
    days: [
        {
            day: 1,
            title: "SEO Fundamentals & the Modern Search Landscape",
            chapters: [
                {
                    id: "day1-ch1",
                    title: "SEO Fundamentals & the Modern Search Landscape",
                    file: "books/Day_01_Chapter_01_Seo_Fundamentals_And_The_Modern_Search_Landscape.md",
                    type: "book"
                },
                {
                    id: "day1-ch2",
                    title: "How Search Engines Work & Search Intent Fundamentals",
                    file: "books/Day_01_Chapter_02_How_Search_Engines_Work_And_Search_Intent_Fundamentals.md",
                    type: "book"
                },
                {
                    id: "day1-ch3",
                    title: "SEO Terminology & Professional Language",
                    file: "books/Day_01_Chapter_03_Seo_Terminology_And_Professional_Language.md",
                    type: "book"
                },
                {
                    id: "day1-ch4",
                    title: "Search Intent Analysis, SERP Validation & Keyword Mapping",
                    file: "books/Day_01_Chapter_04_Search_Intent_Analysis_Serp_Validation_And_Keyword_Mapping.md",
                    type: "book"
                }
            ],
            labs: [
                {
                    id: "day1-lab1",
                    title: "Exploring the Real Search Landscape",
                    file: "labs/Day_01_Lab_01_Exploring_Real_Search_Landscape.md",
                    type: "lab"
                },
                {
                    id: "day1-lab2",
                    title: "SEO Terminology in Action",
                    file: "labs/Day_01_Lab_02_Seo_Terminology_In_Action.md",
                    type: "lab"
                }
            ]
        },
        {
            day: 2,
            title: "How Search Engines Work & Search Intent Fundamentals",
            chapters: [
                {
                    id: "day2-ch1",
                    title: "How Search Engines Work & Search Intent Fundamentals",
                    file: "books/Day_02_Chapter_01_How_Search_Engines_Work_And_Search_Intent_Fundamentals.md",
                    type: "book"
                },
                {
                    id: "day2-ch2",
                    title: "SERP Analysis and Zero-Click Searches",
                    file: "books/Day_02_Chapter_02_Serp_Analysis_And_Zero_Click_Searches.md",
                    type: "book"
                },
                {
                    id: "day2-ch3",
                    title: "Search Intent Categories Deep Dive",
                    file: "books/Day_02_Chapter_03_Search_Intent_Categories_Deep_Dive.md",
                    type: "book"
                }
            ],
            labs: [
                {
                    id: "day2-lab1",
                    title: "Crawl, Index & Rank Observation",
                    file: "labs/Day_02_Lab_01_Crawl_Index_Rank_Observation.md",
                    type: "lab"
                },
                {
                    id: "day2-lab2",
                    title: "Search Intent & SERP Decoding",
                    file: "labs/Day_02_Lab_02_Search_Intent_Serp_Decoding.md",
                    type: "lab"
                }
            ]
        },
        {
            day: 3,
            title: "Keyword Research Foundations & Opportunity Discovery",
            chapters: [
                {
                    id: "day3-ch1",
                    title: "Keyword Research Foundations & Opportunity Discovery",
                    file: "books/Day_03_Chapter_01_Keyword_Research_Foundations_And_Opportunity_Discovery.md",
                    type: "book"
                },
                {
                    id: "day3-ch2",
                    title: "Keyword Expansion & Tools",
                    file: "books/Day_03_Chapter_02_Keyword_Expansion_And_Tools.md",
                    type: "book"
                },
                {
                    id: "day3-ch3",
                    title: "Keyword Opportunity Evaluation & Prioritization",
                    file: "books/Day_03_Chapter_03_Keyword_Opportunity_Evaluation_And_Prioritization.md",
                    type: "book"
                }
            ],
            labs: [
                {
                    id: "day3-lab1",
                    title: "Seed Keyword Discovery for a Real Niche",
                    file: "labs/Day_03_Lab_01_Seed_Keyword_Discovery.md",
                    type: "lab"
                },
                {
                    id: "day3-lab2",
                    title: "Keyword Expansion Using Free & Limited Tools",
                    file: "labs/Day_03_Lab_02_Keyword_Expansion.md",
                    type: "lab"
                }
            ]
        },
        {
            day: 4,
            title: "Search Intent Analysis, SERP Validation & Keyword Mapping",
            chapters: [
                {
                    id: "day4-ch1",
                    title: "Search Intent Analysis & SERP Validation",
                    file: "books/Day_04_Chapter_01_Search_Intent_Analysis_And_Serp_Validation.md",
                    type: "book"
                },
                {
                    id: "day4-ch2",
                    title: "Keyword-to-Page Mapping and Cannibalization Prevention",
                    file: "books/Day_04_Chapter_02_Keyword_To_Page_Mapping_And_Cannibalization_Prevention.md",
                    type: "book"
                }
            ],
            labs: [
                {
                    id: "day4-lab1",
                    title: "SERP Dissection & Intent Validation",
                    file: "labs/Day_04_Lab_01_Serp_Dissection_Intent_Validation.md",
                    type: "lab"
                },
                {
                    id: "day4-lab2",
                    title: "Keyword-to-Page Mapping Exercise",
                    file: "labs/Day_04_Lab_02_Keyword_To_Page_Mapping.md",
                    type: "lab"
                }
            ]
        },
        {
            day: 5,
            title: "Content Optimization, Freshness & SERP Features",
            chapters: [
                {
                    id: "day5-ch1",
                    title: "Content Optimization, Freshness & SERP Features",
                    file: "books/Day_05_Chapter_01_Content_Optimization_Freshness_And_Serp_Features.md",
                    type: "book"
                },
                {
                    id: "day5-ch2",
                    title: "Content Freshness, Updates, and Decay",
                    file: "books/Day_05_Chapter_02_Content_Freshness_Updates_And_Decay.md",
                    type: "book"
                },
                {
                    id: "day5-ch3",
                    title: "Featured Snippets and SERP Features Optimization",
                    file: "books/Day_05_Chapter_03_Featured_Snippets_And_Serp_Features_Optimization.md",
                    type: "book"
                }
            ],
            labs: [
                {
                    id: "day5-lab1",
                    title: "Optimizing Existing Content for SEO",
                    file: "labs/Day_05_Lab_01_Optimizing_Existing_Content_for_SEO.md",
                    type: "lab"
                },
                {
                    id: "day5-lab2",
                    title: "Content Refresh & Update Planning",
                    file: "labs/Day_05_Lab_02_Content_Refresh_Update_Planning.md",
                    type: "lab"
                }
            ]
        },
        {
            day: 6,
            title: "On-Page SEO Fundamentals & Page-Level Optimization",
            chapters: [
                {
                    id: "day6-ch1",
                    title: "On-Page SEO Fundamentals",
                    file: "books/Day_06_Chapter_01_On_Page_Seo_Fundamentals.md",
                    type: "book"
                },
                {
                    id: "day6-ch2",
                    title: "Accessibility, Usability, and Common On-Page Mistakes",
                    file: "books/Day_06_Chapter_02_Accessibility_Usability_And_Common_On_Page_Mistakes.md",
                    type: "book"
                }
            ],
            labs: [
                {
                    id: "day6-lab1",
                    title: "Page-Level On-Page SEO Optimization",
                    file: "labs/Day_06_Lab_01_Page_Level_On_Page_SEO_Optimization.md",
                    type: "lab"
                },
                {
                    id: "day6-lab2",
                    title: "On-Page SEO Audit Checklist",
                    file: "labs/Day_06_Lab_02_On_Page_SEO_Audit_Checklist.md",
                    type: "lab"
                }
            ]
        },
        {
            day: 7,
            title: "Internal Linking Strategy & Site Architecture Design",
            chapters: [
                {
                    id: "day7-ch1",
                    title: "Internal Linking Fundamentals and Link Equity",
                    file: "books/Day_07_Chapter_01_Internal_Linking_Fundamentals_And_Link_Equity.md",
                    type: "book"
                },
                {
                    id: "day7-ch2",
                    title: "Site Architecture Design and Internal Linking Strategy",
                    file: "books/Day_07_Chapter_02_Site_Architecture_Design_And_Internal_Linking_Strategy.md",
                    type: "book"
                }
            ],
            labs: [
                {
                    id: "day7-lab1",
                    title: "Internal Link Mapping",
                    file: "labs/Day_07_Lab_01_Internal_Link_Mapping.md",
                    type: "lab"
                },
                {
                    id: "day7-lab2",
                    title: "Designing SEO-Friendly Site Architecture",
                    file: "labs/Day_07_Lab_02_Designing_SEO_Friendly_Site_Architecture.md",
                    type: "lab"
                }
            ]
        },
        {
            day: 8,
            title: "Indexation Control, Canonicalization & Duplication Management",
            chapters: [
                {
                    id: "day8-ch1",
                    title: "Technical SEO Audits and Crawlability",
                    file: "books/Day_08_Chapter_01_Technical_Seo_Audits_And_Crawlability.md",
                    type: "book"
                },
                {
                    id: "day8-ch2",
                    title: "Indexation Control and Index Bloat Prevention",
                    file: "books/Day_08_Chapter_02_Indexation_Control_And_Index_Bloat_Prevention.md",
                    type: "book"
                }
            ],
            labs: [
                {
                    id: "day8-lab1",
                    title: "Index Coverage Analysis",
                    file: "labs/Day_08_Lab_01_Index_Coverage_Analysis.md",
                    type: "lab"
                },
                {
                    id: "day8-lab2",
                    title: "Canonical & Duplication Audit",
                    file: "labs/Day_08_Lab_02_Canonical_Duplication_Audit.md",
                    type: "lab"
                }
            ]
        },
        {
            day: 9,
            title: "Technical SEO Foundations: Crawlability & Indexability",
            chapters: [
                {
                    id: "day9-ch1",
                    title: "Technical SEO Foundations: Crawlability and Indexability",
                    file: "books/Day_09_Chapter_01_Technical_Seo_Foundations_Crawlability_And_Indexability.md",
                    type: "book"
                },
                {
                    id: "day9-ch2",
                    title: "Common Technical SEO Blockers and Diagnostics",
                    file: "books/Day_09_Chapter_02_Common_Technical_Seo_Blockers_And_Diagnostics.md",
                    type: "book"
                }
            ],
            labs: [
                {
                    id: "day9-lab1",
                    title: "Crawl & Index Diagnostics",
                    file: "labs/Day_09_Lab_01_Crawl_Index_Diagnostics.md",
                    type: "lab"
                },
                {
                    id: "day9-lab2",
                    title: "Robots.txt & Sitemap Review",
                    file: "labs/Day_09_Lab_02_Robots_Txt_Sitemap_Review.md",
                    type: "lab"
                }
            ]
        },
        {
            day: 10,
            title: "Core Web Vitals, Page Experience & Performance Optimization",
            chapters: [
                {
                    id: "day10-ch1",
                    title: "Core Web Vitals and Page Experience Signals",
                    file: "books/Day_10_Chapter_01_Core_Web_Vitals_And_Page_Experience_Signals.md",
                    type: "book"
                },
                {
                    id: "day10-ch2",
                    title: "SEO-Friendly Performance Prioritization",
                    file: "books/Day_10_Chapter_02_Seo_Friendly_Performance_Prioritization.md",
                    type: "book"
                }
            ],
            labs: [
                {
                    id: "day10-lab1",
                    title: "Core Web Vitals Diagnosis",
                    file: "labs/Day_10_Lab_01_Core_Web_Vitals_Diagnosis.md",
                    type: "lab"
                },
                {
                    id: "day10-lab2",
                    title: "Performance Issue Prioritization",
                    file: "labs/Day_10_Lab_02_Performance_Issue_Prioritization.md",
                    type: "lab"
                }
            ]
        },
        {
            day: 11,
            title: "Advanced Technical SEO, Crawl Budget & JavaScript SEO Basics",
            chapters: [
                {
                    id: "day11-ch1",
                    title: "Advanced Technical SEO: Crawl Budget Optimization",
                    file: "books/Day_11_Chapter_01_Advanced_Technical_Seo_Crawl_Budget_Optimization.md",
                    type: "book"
                },
                {
                    id: "day11-ch2",
                    title: "JavaScript SEO and Rendering Considerations",
                    file: "books/Day_11_Chapter_02_JavaScript_Seo_And_Rendering_Considerations.md",
                    type: "book"
                }
            ],
            labs: [
                {
                    id: "day11-lab1",
                    title: "Crawl Budget Analysis",
                    file: "labs/Day_11_Lab_01_Crawl_Budget_Analysis.md",
                    type: "lab"
                },
                {
                    id: "day11-lab2",
                    title: "JavaScript SEO Risk Assessment",
                    file: "labs/Day_11_Lab_02_JavaScript_SEO_Risk_Assessment.md",
                    type: "lab"
                }
            ]
        },
        {
            day: 12,
            title: "Link Building & Authority Development",
            chapters: [
                {
                    id: "day12-ch1",
                    title: "Link Building Fundamentals & Authority Development",
                    file: "books/Day_12_Chapter_01_Link_Building_Fundamentals_And_Authority_Development.md",
                    type: "book"
                }
            ],
            labs: []
        },
        {
            day: 13,
            title: "E-E-A-T & Trust Optimization",
            chapters: [
                {
                    id: "day13-ch1",
                    title: "E-E-A-T, Helpful Content & Trust Optimization",
                    file: "books/Day_13_Chapter_01_E_E_A_T_Helpful_Content_And_Trust_Optimization.md",
                    type: "book"
                }
            ],
            labs: []
        },
        {
            day: 14,
            title: "Full SEO Audit Framework",
            chapters: [
                {
                    id: "day14-ch1",
                    title: "Full SEO Audit Framework & Execution",
                    file: "books/Day_14_Chapter_01_Full_Seo_Audit_Framework_And_Execution.md",
                    type: "book"
                }
            ],
            labs: []
        },
        {
            day: 15,
            title: "SEO Troubleshooting",
            chapters: [
                {
                    id: "day15-ch1",
                    title: "SEO Troubleshooting: Traffic, Ranking & Conversion Drops",
                    file: "books/Day_15_Chapter_01_Seo_Troubleshooting_Traffic_Ranking_And_Conversion_Drops.md",
                    type: "book"
                }
            ],
            labs: []
        },
        {
            day: 16,
            title: "Algorithm Updates & Recovery",
            chapters: [
                {
                    id: "day16-ch1",
                    title: "Google Algorithm Updates, Penalties & Recovery Frameworks",
                    file: "books/Day_16_Chapter_01_Google_Algorithm_Updates_Penalties_And_Recovery_Frameworks.md",
                    type: "book"
                }
            ],
            labs: []
        },
        {
            day: 17,
            title: "Corporate & Content Website SEO",
            chapters: [
                {
                    id: "day17-ch1",
                    title: "SEO for Corporate and Content Websites",
                    file: "books/Day_17_Chapter_01_Seo_For_Corporate_And_Content_Websites.md",
                    type: "book"
                }
            ],
            labs: []
        },
        {
            day: 18,
            title: "Ecommerce SEO Fundamentals",
            chapters: [
                {
                    id: "day18-ch1",
                    title: "Ecommerce SEO Fundamentals & Scalable Strategies",
                    file: "books/Day_18_Chapter_01_Ecommerce_Seo_Fundamentals_And_Scalable_Strategies.md",
                    type: "book"
                }
            ],
            labs: []
        },
        {
            day: 19,
            title: "AI & Automation in SEO",
            chapters: [
                {
                    id: "day19-ch1",
                    title: "AI, Automation & Responsible SEO Practices",
                    file: "books/Day_19_Chapter_01_Ai_Automation_And_Responsible_Seo_Practices.md",
                    type: "book"
                }
            ],
            labs: []
        },
        {
            day: 20,
            title: "Answer Engine Optimization & Future SEO",
            chapters: [
                {
                    id: "day20-ch1",
                    title: "Answer Engine Optimization & Future SEO Strategies",
                    file: "books/Day_20_Chapter_01_Answer_Engine_Optimization_And_Future_Seo_Strategies.md",
                    type: "book"
                }
            ],
            labs: []
        }
    ]
};

// Helper function to get all content items in sequence
function getAllContentItems() {
    const items = [];
    courseData.days.forEach(day => {
        day.chapters.forEach(chapter => {
            items.push({ ...chapter, day: day.day, dayTitle: day.title });
        });
        day.labs.forEach(lab => {
            items.push({ ...lab, day: day.day, dayTitle: day.title });
        });
    });
    return items;
}

// Helper function to get content by ID
function getContentById(id) {
    const allItems = getAllContentItems();
    return allItems.find(item => item.id === id);
}

// Helper function to get next and previous content
function getNavigationItems(currentId) {
    const allItems = getAllContentItems();
    const currentIndex = allItems.findIndex(item => item.id === currentId);
    
    return {
        previous: currentIndex > 0 ? allItems[currentIndex - 1] : null,
        current: allItems[currentIndex],
        next: currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null
    };
}

