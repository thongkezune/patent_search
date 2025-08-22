const express = require('express');
const cors = require('cors');
const axios = require('axios');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Logging configuration
const util = require('util');
const LOG_STEPS = true;

function logStep(source, step, details = '') {
    if (LOG_STEPS) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${source}] ${step} ${details}`);
    }
}

// Add after logging configuration
function logVisualStep(source, step, details = '') {
    if (LOG_STEPS) {
        const timestamp = new Date().toISOString();
        const icon = {
            'start': '🟢',
            'page': '📄',
            'navigate': '🌐',
            'wait': '⏳',
            'type': '⌨️',
            'click': '🖱️',
            'extract': '📝',
            'complete': '✅',
            'error': '❌',
            'close': '🔚'
        }[step.toLowerCase()] || '➡️';
        
        console.log(`${icon} [${timestamp}] [${source}]`);
        console.log(`   └─ ${step}`);
        if (details) {
            console.log(`      └─ ${details}`);
        }
        console.log(); // Empty line for readability
    }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        services: {
            'google-patents': 'available',
            'wipo': 'available'
        }
    });
});

// Patent search endpoint
app.post('/api/search', async (req, res) => {
    try {
        const { keywords, maxResults = 10, source = 'all' } = req.body;
        
        if (!keywords) {
            return res.status(400).json({ error: 'Keywords are required' });
        }

        console.log(`Searching for patents with keywords: ${keywords}`);
        
        let patents = [];
        
        if (source === 'all' || source === 'google') {
            const googlePatents = await searchGooglePatents(keywords, maxResults);
            patents = patents.concat(googlePatents);
        }
        
        // if (source === 'all' || source === 'wipo') {
        //     const wipoPatents = await searchWIPO(keywords, maxResults);
        //     patents = patents.concat(wipoPatents);
        // }
        
        res.json({
            patents: patents,
            total: patents.length,
            keywords: keywords,
            timestamp: new Date().toISOString(),
            sources: source === 'all' ? ['google', 'wipo'] : [source]
        });
        
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ 
            error: 'Patent search failed',
            details: error.message 
        });
    }
});

// Patent PDF download endpoint
app.post('/api/download', async (req, res) => {
    try {
        const { patentId, pdfUrl } = req.body;
        
        if (!patentId) {
            return res.status(400).json({ error: 'Patent ID is required' });
        }

        console.log(`Downloading PDF for patent: ${patentId}`);
        console.log(`Downloading PDF for patent: ${pdfUrl}`);
        // Download PDF from Google Patents
        const pdfBuffer = await downloadPatentPDF(patentId, pdfUrl);
        
        res.setHeader('Content-Type', 'application/pdf');
        // res.setHeader('Content-Disposition', `attachment; filename="patent_${patentId}.pdf"`);
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ 
            error: 'PDF download failed',
            details: error.message 
        });
    }
});
function printPatentsSimple(patents, source = "Patents") {
    console.log(`\n========== ${source.toUpperCase()} SEARCH RESULTS ==========`);
    console.log(`Total Patents Found: ${patents.length}`);
    console.log("=" * 50);
    
    patents.forEach((patent, index) => {
        console.log(`\n--- Patent ${index + 1} ---`);
        console.log(`ID: ${patent.id}`);
        console.log(`Title: ${patent.title}`);
        console.log(`Date: ${patent.date}`);
        
        // Handle different data structures
        if (patent.inventors) {
            console.log(`Inventors: ${Array.isArray(patent.inventors) ? patent.inventors.join(', ') : patent.inventors}`);
        }
        if (patent.assignee) {
            console.log(`Assignee: ${patent.assignee}`);
        }
        if (patent.abstract) {
            console.log(`Abstract: ${patent.abstract}`);
        }
        if (patent.pdfUrl) {
            console.log(`PDF URL: ${patent.pdfUrl}`);
        }
        if (patent.detailUrl) {
            console.log(`Detail URL: ${patent.detailUrl}`);
        }
        if (patent.googlePatentUrl) {
            console.log(`Google Patent URL: ${patent.googlePatentUrl}`);
        }
        if (patent.source) {
            console.log(`Source: ${patent.source}`);
        }
        if (patent.status) {
            console.log(`Status: ${patent.status}`);
        }
        if (patent.rank) {
            console.log(`Rank: ${patent.rank}`);
        }
        console.log("─".repeat(40));
    });
}
// Search Google Patents using web scraping
async function searchGooglePatents(keywords, maxResults) {
    logStep('Google', '🚀 Starting search', `keywords: ${keywords}, max: ${maxResults}`);

    function buildGooglePatentUrl(keywords) {
    const base = "https://patents.google.com/";
    const query = keywords
      .map(kw => `q=CL%3d(${encodeURIComponent(kw)})`)
      .join("&");
    return `${base}?${query}`;
    }

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        logStep('Google', '🌐 Creating new page');
        const page = await browser.newPage();
        
        logStep('Google', '👤 Setting user agent');
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/91.0.4472.124 Safari/537.36'
        );
        
        // const searchUrl = `https://patents.google.com/?q=${encodeURIComponent(keywords)}`;
        // Nhận keywords
        const keywordArray = Array.isArray(keywords) ? keywords : [keywords];
        const searchUrl = buildGooglePatentUrl(keywordArray);

        logStep('Google', '🔍 Navigating to', searchUrl);
        await page.goto(searchUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        
        logStep('Google', '⏳ Waiting for search results');
        await page.waitForSelector('search-result-item', { timeout: 10000 });
        
        logStep('Google', '📝 Extracting patent information');
        const patents = await page.evaluate(async (maxResults) => {
            const results = [];

            // Wait for content dynamically
            const waitForContent = () => {
                return new Promise((resolve) => {
                    let attempts = 0;
                    const checkContent = () => {
                        const items = document.querySelectorAll(
                            'search-result-item, .search-result-item, article, .result'
                        );
                        if (items.length > 0 || attempts > 50) { // max ~5s
                            resolve();
                        } else {
                            attempts++;
                            setTimeout(checkContent, 100);
                        }
                    };
                    checkContent();
                });
            };

            await waitForContent();

            // Try multiple selectors for Google Patents results
            let items = document.querySelectorAll('search-result-item');
            if (items.length === 0) items = document.querySelectorAll('.search-result-item');
            if (items.length === 0) items = document.querySelectorAll('article');
            if (items.length === 0) items = document.querySelectorAll('.result');
            if (items.length === 0) items = document.querySelectorAll('[data-result]');
            if (items.length === 0) items = document.querySelectorAll('.gs_r');

            console.log(`Found ${items.length} potential Google Patents items`);

            for (let i = 0; i < Math.min(items.length, maxResults); i++) {
                const item = items[i];
                try {
                    // ----- Extract Patent URL & ID -----
                    const titleLink = item.querySelector('a[href*="patents.google.com"]') ||
                                      item.querySelector('a[href*="patent"]') ||
                                      item.querySelector('h3 a') ||
                                      item.querySelector('h4 a');
                    
                    let patentId = '';
                    let patentUrl = '';
                    if (titleLink && titleLink.href) {
                        patentUrl = titleLink.href;
                        const urlMatch = patentUrl.match(/patent\/([^\/\?&#]+)/) ||
                                         patentUrl.match(/\/([A-Z]{2}\d+[A-Z]?\d*)/) ||
                                         patentUrl.match(/patent=([^&]+)/);
                        if (urlMatch) patentId = urlMatch[1];
                    }

                    // ----- Extract Title -----
                    let title = '';
                    if (titleLink) {
                        title = titleLink.textContent.trim();
                        if (title === patentId || title.match(/^[A-Z]{2}\d+[A-Z]?\d*$/)) {
                            const altTitleSelectors = [
                                'h3', 'h4', '.title', '.patent-title',
                                '[data-result="title"]', '.result-title'
                            ];
                            for (const sel of altTitleSelectors) {
                                const altTitle = item.querySelector(sel);
                                if (altTitle && altTitle.textContent.trim() !== title) {
                                    const altText = altTitle.textContent.trim();
                                    if (altText.length > patentId.length + 5) {
                                        title = altText;
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    // ----- Extract Inventors -----
                    const inventorSelectors = [
                        '[data-result="inventor"] span',
                        '.inventor span',
                        '[data-inventor]',
                        '.metadata .inventor',
                        '.author',
                        '.inventors span'
                    ];
                    let inventors = [];
                    for (const sel of inventorSelectors) {
                        const els = item.querySelectorAll(sel);
                        if (els.length > 0) {
                            inventors = Array.from(els)
                                .map(el => el.textContent.trim())
                                .filter(text => text && text.length > 1 && !text.match(/^\d+$/))
                                .slice(0, 5);
                            if (inventors.length > 0) break;
                        }
                    }
                    if (inventors.length === 0) inventors = ['Unknown Inventor'];

                    // ----- Extract Date -----
                    let date = new Date().toISOString().split('T')[0];
                    const dateSelectors = [
                        '[data-result="publication_date"]',
                        '.publication-date',
                        '.pub-date',
                        '.date',
                        '[data-date]'
                    ];
                    for (const sel of dateSelectors) {
                        const el = item.querySelector(sel);
                        if (el) {
                            const txt = el.textContent.trim();
                            const match = txt.match(/(\d{4})-(\d{1,2})-(\d{1,2})/) ||
                                          txt.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/) ||
                                          txt.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/) ||
                                          txt.match(/(\d{4})/);
                            if (match) {
                                if (match[0].includes('-')) {
                                    date = match[0];
                                } else if (match[0].includes('/')) {
                                    const parts = match[0].split('/');
                                    if (parts[2] && parts[2].length === 4) {
                                        date = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
                                    } else if (parts[0] && parts[0].length === 4) {
                                        date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                                    }
                                } else if (match[1] && match[1].length === 4) {
                                    date = `${match[1]}-01-01`;
                                }
                            }
                            break;
                        }
                    }

                    // ----- Extract Abstract -----
                    let abstract = 'No abstract available';
                    const abstractSelectors = [
                        // '[data-result="snippet"]',
                        // '.snippet',
                        '.abstract'
                        // '.description',
                        // '.summary',
                        // 'p:not(:empty)'
                    ];
                    for (const sel of abstractSelectors) {
                        const el = item.querySelector(sel);
                        console.log(`❌ Patent ${el}: Missing ID or Title`);
                        if (el) {
                            abstract = el.textContent.trim();
                            if (abstract.length > 300) abstract = abstract.substring(0, 300) + '...';
                            if (abstract.length > 20) break;
                        }
                    }

                    // ----- Finalize -----
                    const pdfUrl = patentUrl ? 
                        `${patentUrl}${patentUrl.includes('?') ? '&' : '?'}oq=${patentId}` : '';
                    
                    if (patentId && title) {
                        results.push({
                            id: patentId,
                            title,
                            date,
                            inventors,
                            abstract,
                            googlePatentUrl: patentUrl,
                            pdfUrl,
                            status: 'available'
                        });
                        console.log(`✅ Patent ${i+1}: ${patentId} - ${title.substring(0,50)}...`);
                    } else {
                        console.log(`❌ Patent ${i+1}: Missing ID or Title`);
                    }
                } catch (err) {
                    console.log(`❌ Error parsing item ${i+1}:`, err.message);
                }
            }

            return results;
        }, maxResults);

        logStep('Google', '✅ Search completed', `Found ${patents.length} patents`);
        printPatentsSimple(patents, "google");
        return patents;
    } catch (error) {
        logStep('Google', '❌ Search failed', error.message);
        throw error;
    } finally {
        logStep('Google', '🔚 Closing browser');
        await browser.close();
    }
}

// Fixed WIPO results extraction function
function extractWIPOResults(page, maxResults) {
    return page.evaluate((maxRes) => {
        const results = [];
        
        // Try different selectors for WIPO results
        const containerSelectors = [
            'tbody tr',
            '.ps-patent-result',
            '.search-result',
            '[class*="result"]'
        ];
        
        let containers = [];
        for (const selector of containerSelectors) {
            containers = Array.from(document.querySelectorAll(selector));
            if (containers.length > 0) {
                // Filter to only include rows that have patent data
                containers = containers.filter(el => {
                    const text = el.textContent.toLowerCase();
                    return text.includes('patent') || text.includes('application') || 
                           el.querySelector('a[href*="detail"]') || 
                           el.querySelector('a[href*="patent"]');
                });
                if (containers.length > 0) break;
            }
        }
        
        console.log(`Found ${containers.length} potential WIPO result containers`);
        
        for (let i = 0; i < Math.min(containers.length, maxRes); i++) {
            const container = containers[i];
            
            try {
                // Extract patent ID - look for patent number patterns
                let patentId = '';
                const idPatterns = [
                    /\b([A-Z]{2}\d{8,}[A-Z]?\d*)\b/,  // US20170364492, EP1234567B1
                    /\b(WO\d{4}\/\d+)\b/,              // WO2021/123456
                    /\b(\d{4}\/\d+)\b/,                // 2021/123456
                    /\b([A-Z]{2}\s?\d{6,})\b/          // US 123456
                ];
                
                const containerText = container.textContent;
                for (const pattern of idPatterns) {
                    const match = containerText.match(pattern);
                    if (match) {
                        patentId = match[1].replace(/\s+/g, '');
                        break;
                    }
                }
                
                // If no pattern match, look in specific elements
                if (!patentId) {
                    const idSelectors = [
                        '.patent-number',
                        '.publication-number', 
                        'td:first-child',
                        'strong:first-of-type'
                    ];
                    
                    for (const sel of idSelectors) {
                        const el = container.querySelector(sel);
                        if (el) {
                            const text = el.textContent.trim();
                            const match = text.match(/\b([A-Z]{2}?\d{6,}[A-Z]?\d*)\b/);
                            if (match) {
                                patentId = match[1];
                                break;
                            }
                        }
                    }
                }
                
                // Extract title - look for clickable links or title elements
                let title = '';
                const titleSelectors = [
                    'a[href*="detail"]',
                    '.patent-title a',
                    '.title a',
                    'td:nth-child(2) a',
                    '.title',
                    'h3',
                    'h4'
                ];
                
                for (const sel of titleSelectors) {
                    const el = container.querySelector(sel);
                    if (el && el.textContent.trim() && !el.textContent.match(/^\d+$/)) {
                        title = el.textContent.trim();
                        // Clean up title - remove patent numbers from title
                        title = title.replace(/^[A-Z]{2}\d+[A-Z]?\d*\s*[-:]?\s*/, '');
                        if (title.length > 10) break; // Only use substantial titles
                    }
                }
                
                // Extract date
                let date = '';
                const dateSelectors = [
                    '.publication-date',
                    '.date',
                    'td:nth-child(3)',
                    '[class*="date"]'
                ];
                
                for (const sel of dateSelectors) {
                    const el = container.querySelector(sel);
                    if (el) {
                        const text = el.textContent.trim();
                        // Look for date patterns
                        const dateMatch = text.match(/(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{4})|(\d{4}[\.\/\-]\d{1,2}[\.\/\-]\d{1,2})/);
                        if (dateMatch) {
                            date = dateMatch[0];
                            break;
                        }
                    }
                }
                
                // Extract assignee/applicant
                let assignee = '';
                const assigneeSelectors = [
                    '.assignee',
                    '.applicant',
                    'td:nth-child(4)',
                    '[class*="applicant"]'
                ];
                
                for (const sel of assigneeSelectors) {
                    const el = container.querySelector(sel);
                    if (el && el.textContent.trim() && el.textContent.trim() !== '-') {
                        assignee = el.textContent.trim();
                        break;
                    }
                }
                
                // Extract URLs
                let detailUrl = '';
                let pdfUrl = '';
                
                const detailLink = container.querySelector('a[href*="detail"]');
                if (detailLink) {
                    detailUrl = detailLink.href;
                }
                
                const pdfLink = container.querySelector('a[href*=".pdf"]') || 
                               container.querySelector('a[title*="PDF" i]');
                if (pdfLink) {
                    pdfUrl = pdfLink.href;
                }
                
                // Only add if we have essential data
                if (patentId || title) {
                    results.push({
                        id: patentId || `WIPO-${i+1}`,
                        title: title || 'Title not available',
                        date: date || 'Date not available',
                        assignee: assignee || 'Not specified',
                        pdfUrl: pdfUrl,
                        detailUrl: detailUrl,
                        source: 'WIPO',
                        rank: i + 1
                    });
                    
                    console.log(`✅ WIPO Patent ${i+1}: ${patentId} - ${title.substring(0, 50)}...`);
                } else {
                    console.log(`❌ WIPO Patent ${i+1}: Insufficient data found`);
                }
                
            } catch (e) {
                console.log(`❌ Error parsing WIPO patent ${i+1}:`, e.message);
                continue;
            }
        }
        
        return results;
    }, maxResults);
}

// Fixed Google Patents results extraction function
function extractGoogleResults(page, maxResults) {
    return page.evaluate((maxRes) => {
        const results = [];
        
        // Wait for content to be fully loaded
        const waitForContent = () => {
            return new Promise((resolve) => {
                let attempts = 0;
                const checkContent = () => {
                    const items = document.querySelectorAll('search-result-item, .search-result-item, article, .result');
                    if (items.length > 0 || attempts > 50) {
                        resolve();
                    } else {
                        attempts++;
                        setTimeout(checkContent, 100);
                    }
                };
                checkContent();
            });
        };
        
        waitForContent();
        
        // Try multiple selectors for Google Patents results
        let items = document.querySelectorAll('search-result-item');
        if (items.length === 0) items = document.querySelectorAll('.search-result-item');
        if (items.length === 0) items = document.querySelectorAll('article');
        if (items.length === 0) items = document.querySelectorAll('.result');
        
        console.log(`Found ${items.length} potential Google Patents items`);
        
        for (let i = 0; i < Math.min(items.length, maxRes); i++) {
            const item = items[i];
            
            try {
                // Extract patent ID from URL first (most reliable)
                let patentId = '';
                let patentUrl = '';
                
                const titleLink = item.querySelector('a[href*="patents.google.com"]') ||
                                 item.querySelector('a[href*="patent"]') ||
                                 item.querySelector('h3 a') ||
                                 item.querySelector('h4 a');
                
                if (titleLink && titleLink.href) {
                    patentUrl = titleLink.href;
                    // Extract patent ID from URL
                    const urlMatch = patentUrl.match(/patent\/([^\/\?&#]+)/);
                    if (urlMatch) {
                        patentId = urlMatch[1];
                    }
                }
                
                // Extract title (not just the patent ID)
                let title = '';
                const titleElement = titleLink;
                if (titleElement) {
                    title = titleElement.textContent.trim();
                    // If title is just the patent ID, look for a better title
                    if (title === patentId || title.match(/^[A-Z]{2}\d+[A-Z]?\d*$/)) {
                        // Look for a descriptive title nearby
                        const altTitleSelectors = [
                            'h3', 'h4', '.title', '.patent-title', 
                            '[data-result="title"]', '.result-title'
                        ];
                        
                        for (const sel of altTitleSelectors) {
                            const altTitle = item.querySelector(sel);
                            if (altTitle && altTitle.textContent.trim() !== title) {
                                const altText = altTitle.textContent.trim();
                                if (altText.length > patentId.length + 5) { // Ensure it's not just the ID
                                    title = altText;
                                    break;
                                }
                            }
                        }
                    }
                }
                
                // Extract inventors
                const inventorSelectors = [
                    '[data-result="inventor"] span',
                    '.inventor span',
                    '[data-inventor]',
                    '.metadata .inventor',
                    '.author',
                    '.inventors span'
                ];
                
                let inventors = [];
                for (const sel of inventorSelectors) {
                    const inventorElements = item.querySelectorAll(sel);
                    if (inventorElements.length > 0) {
                        inventors = Array.from(inventorElements)
                            .map(el => el.textContent.trim())
                            .filter(text => text && text.length > 1 && !text.match(/^\d+$/))
                            .slice(0, 5);
                        if (inventors.length > 0) break;
                    }
                }
                
                if (inventors.length === 0) {
                    inventors = ['Unknown Inventor'];
                }
                
                // Extract date
                let date = new Date().toISOString().split('T')[0]; // Default to today
                const dateSelectors = [
                    '[data-result="publication_date"]',
                    '.publication-date',
                    '.pub-date',
                    '.date',
                    '[data-date]'
                ];
                
                for (const sel of dateSelectors) {
                    const dateElement = item.querySelector(sel);
                    if (dateElement) {
                        const dateText = dateElement.textContent.trim();
                        const dateMatch = dateText.match(/(\d{4})-(\d{1,2})-(\d{1,2})/) ||
                                        dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/) ||
                                        dateText.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/) ||
                                        dateText.match(/(\d{4})/);
                        
                        if (dateMatch) {
                            if (dateMatch[0].includes('-')) {
                                date = dateMatch[0];
                            } else if (dateMatch[0].includes('/')) {
                                const parts = dateMatch[0].split('/');
                                if (parts[2] && parts[2].length === 4) {
                                    date = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
                                } else if (parts[0] && parts[0].length === 4) {
                                    date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                                }
                            } else if (dateMatch[1] && dateMatch[1].length === 4) {
                                date = `${dateMatch[1]}-01-01`;
                            }
                        }
                        break;
                    }
                }
                
                // Extract abstract
                let abstract = 'No abstract available';
                const abstractSelectors = [
                    '[data-result="snippet"]',
                    '.snippet',
                    '.abstract',
                    '.description',
                    '.summary',
                    'p:not(:empty)'
                ];
                
                for (const sel of abstractSelectors) {
                    const abstractElement = item.querySelector(sel);
                    if (abstractElement) {
                        abstract = abstractElement.textContent.trim();
                        if (abstract.length > 300) {
                            abstract = abstract.substring(0, 300) + '...';
                        }
                        if (abstract.length > 20) break; // Only use substantial abstracts
                    }
                }
                
                // Generate PDF URL
                const pdfUrl = patentUrl ? `${patentUrl}${patentUrl.includes('?') ? '&' : '?'}oq=${patentId}` : '';
                
                if (patentId && title) {
                    const patent = {
                        id: patentId,
                        title: title,
                        date: date,
                        inventors: inventors,
                        abstract: abstract,
                        googlePatentUrl: patentUrl,
                        pdfUrl: pdfUrl,
                        status: 'available'
                    };
                    
                    results.push(patent);
                    console.log(`✅ Google Patent ${i+1}: ${patentId} - ${title.substring(0, 50)}...`);
                } else {
                    console.log(`❌ Google Patent ${i+1}: Missing essential data - ID: ${patentId}, Title: ${title}`);
                }
                
            } catch (error) {
                console.log(`❌ Error parsing Google patent ${i+1}:`, error.message);
            }
        }
        
        return results;
    }, maxResults);
}

// Improved print function that handles both formats properly
function printPatentInfo(patents, source = "Patents") {
    console.log(`\n🔍 ${source.toUpperCase()} SEARCH RESULTS`);
    console.log("═".repeat(80));
    console.log(`📊 Total Patents Found: ${patents.length}\n`);
    
    patents.forEach((patent, index) => {
        console.log(`📄 Patent ${index + 1}`);
        console.log("─".repeat(50));
        console.log(`🔢 ID: ${patent.id}`);
        console.log(`📝 Title: ${patent.title}`);
        console.log(`📅 Date: ${patent.date}`);
        
        // Handle different data structures
        if (patent.inventors && Array.isArray(patent.inventors)) {
            console.log(`👨‍🔬 Inventors: ${patent.inventors.join(', ')}`);
        } else if (patent.inventors) {
            console.log(`👨‍🔬 Inventors: ${patent.inventors}`);
        }
        
        if (patent.assignee && patent.assignee !== 'Not specified') {
            console.log(`🏢 Assignee: ${patent.assignee}`);
        }
        
        if (patent.abstract && patent.abstract !== 'No abstract available') {
            console.log(`📋 Abstract: ${patent.abstract.substring(0, 200)}${patent.abstract.length > 200 ? '...' : ''}`);
        }
        
        // URLs
        if (patent.detailUrl) {
            console.log(`🔗 Detail URL: ${patent.detailUrl}`);
        }
        if (patent.googlePatentUrl) {
            console.log(`🔗 Google Patent URL: ${patent.googlePatentUrl}`);
        }
        if (patent.pdfUrl) {
            console.log(`📄 PDF URL: ${patent.pdfUrl}`);
        }
        
        // Additional info
        if (patent.source) {
            console.log(`📡 Source: ${patent.source}`);
        }
        if (patent.rank) {
            console.log(`🏆 Rank: ${patent.rank}`);
        }
        if (patent.status) {
            console.log(`✅ Status: ${patent.status}`);
        }
        
        console.log(""); // Empty line between patents
    });
    
    console.log("═".repeat(80));
}

// Usage example:
async function improvedPatentSearch(keywords, maxResults = 10) {
    try {
        console.log(`🚀 Starting improved patent search for: "${keywords}"`);
        
        // Search WIPO
        console.log("\n🔍 Searching WIPO...");
        const wipoResults = await searchWIPO(keywords, maxResults);
        printPatentInfo(wipoResults, "WIPO");
        
        // Search Google Patents
        console.log("\n🔍 Searching Google Patents...");
        const googleResults = await searchGooglePatents(keywords, maxResults);
        printPatentInfo(googleResults, "Google Patents");
        
        // Combined results
        const allResults = [...wipoResults, ...googleResults];
        console.log("\n🔍 Combined Results Summary:");
        console.log(`Total from WIPO: ${wipoResults.length}`);
        console.log(`Total from Google Patents: ${googleResults.length}`);
        console.log(`Combined Total: ${allResults.length}`);
        
        return {
            wipo: wipoResults,
            google: googleResults,
            combined: allResults
        };
        
    } catch (error) {
        console.error("❌ Patent search failed:", error.message);
        throw error;
    }
}
const { fetch } = require("undici"); 
// Download PDF from Google Patents
async function downloadPatentPDF(patentId, pdfUrl) {
    try {
        console.log(`⬇️ Downloading PDF for patent: ${patentId}`);

        const response = await fetch(pdfUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/pdf,*/*',
                'Referer': `https://patents.google.com/patent/${patentId}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Validate PDF
        if (buffer.slice(0, 4).toString() !== '%PDF') {
            throw new Error('Downloaded file is not a valid PDF');
        }

        // Create downloads folder and save file
        const folder = path.join(process.cwd(), "downloads");
        await fs.mkdir(folder, { recursive: true });

        const filePath = path.join(folder, `${patentId}.pdf`);
        await fs.writeFile(filePath, buffer);

        console.log(`✅ Downloaded: ${filePath} (${Math.round(buffer.length / 1024)} KB)`);
        return filePath;
        
    } catch (err) {
        console.error(`❌ Error downloading ${patentId}:`, err);
        throw err;
    }
}

// Replace the existing searchWIPO function with this implementation
async function searchWIPO(keywords, maxResults) {
    let browser = null;
    let page = null;
    
    try {
        logVisualStep('WIPO', 'start', `Searching for: ${keywords}`);
        
        // Fast headless browser configuration
        browser = await puppeteer.launch({
            headless: "new", // Use new headless mode
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=VizDisplayCompositor',
                '--disable-web-security',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-default-apps',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-sync',
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
                '--disable-client-side-phishing-detection',
                '--disable-component-update'
            ],
            defaultViewport: { width: 1280, height: 800 }
        });
        
        page = await browser.newPage();
        
        // Minimal anti-detection
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Navigate quickly
        const response = await page.goto('https://patentscope.wipo.int/search/en/advancedSearch.jsf', {
            waitUntil: 'domcontentloaded',
            timeout: 25000
        });
        
        if (!response || response.status() !== 200) {
            throw new Error(`Failed to load WIPO page. Status: ${response ? response.status() : 'No response'}`);
        }
        
        // Quick wait for form
        await page.waitForSelector('textarea', { timeout: 50000 });
        await page.waitForTimeout(500); // Minimal wait
        
        // Find search box quickly
        const searchBox = await page.$('textarea[placeholder*="search" i]') ||
                         await page.$('textarea[name*="search"]') ||
                         await page.$('textarea[id*="fpSearch"]') ||
                         await page.$('textarea');
        
        if (!searchBox) {
            throw new Error('Could not find search textarea');
        }
        
        // Fast typing - no delays
        await searchBox.evaluate(el => {
            el.focus();
            el.value = '';
        });
        
        await searchBox.type(keywords, { delay: 10 }); // Minimal typing delay
        
        // Multi-strategy search trigger
        let searchTriggered = false;
        const startUrl = page.url();
        
        // Strategy 1: Try Enter key
        try {
            await searchBox.press('Enter');
            await page.waitForTimeout(1000);
            
            // Check if URL changed or results appeared
            const urlChanged = page.url() !== startUrl;
            const hasResults = await page.$('.search-results, .results, tbody tr, [class*="result"]');
            
            if (urlChanged || hasResults) {
                searchTriggered = true;
                logVisualStep('WIPO', 'success', 'Enter key triggered search');
            }
        } catch (e) {
            // Continue to next strategy
        }
        
        // Fast wait for results
        try {
            await Promise.race([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
                page.waitForSelector('.search-results, .results, tbody tr', { timeout: 15000 })
            ]);
            await page.waitForTimeout(1000); // Minimal wait for content
        } catch (waitError) {
            // Continue even if timeout - might have results
        }
        
        // Fast results extraction - Modified to match Google Patents format
        const patents = await page.evaluate((maxRes) => {
            const results = [];
            
            // Quick container selection
            const containerSelectors = [
                'tbody tr:has(a)',
                '.ps-patent-result',
                '.search-result',
                'tr:has(a[href*="detail"])',
                '[class*="result"]:has(a)'
            ];
            
            let containers = [];
            for (const selector of containerSelectors) {
                try {
                    containers = Array.from(document.querySelectorAll(selector.replace(':has(a)', '')));
                    if (selector.includes(':has(')) {
                        containers = containers.filter(el => el.querySelector('a'));
                    }
                    if (containers.length > 0) break;
                } catch (e) {
                    continue;
                }
            }
            
            // Process results quickly - Updated to match Google Patents format
            for (let i = 0; i < Math.min(containers.length, maxRes); i++) {
                const container = containers[i];
                
                try {
                    const getText = (selectors) => {
                        for (const sel of selectors) {
                            const el = container.querySelector(sel);
                            if (el && el.textContent.trim()) return el.textContent.trim();
                        }
                        return '';
                    };
                    
                    const getUrl = (selectors) => {
                        for (const sel of selectors) {
                            const el = container.querySelector(sel);
                            if (el && el.href) return el.href;
                        }
                        return '';
                    };
                    
                    // Extract patent ID
                    const patentId = getText([
                        // '.patent-number', '.publication-number', 
                        // 'td:first-child',
                        'a[href*="detail"]',
                        // 'td:nth-child(3)'
                        // 'strong:first-of-type'
                    ]);
                    
                    // Extract title
                    const title = getText([
                        'a[href*="detail"]', '.patent-title a', '.title a', 'td:nth-child(2) a', '.title'
                    ]) || 'Title not available';
                    
                    // Extract and format date to match Google Patents format (YYYY-MM-DD)
                    let date = new Date().toISOString().split('T')[0]; // Default to today
                    const dateText = getText([
                        '.publication-date', '.date', 'td:nth-child(3)', '[class*="date"]'
                    ]);
                    
                    if (dateText) {
                        // Try to parse various date formats and convert to YYYY-MM-DD
                        const dateMatch = dateText.match(/(\d{4})-(\d{1,2})-(\d{1,2})/) ||
                                         dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/) ||
                                         dateText.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/) ||
                                         dateText.match(/(\d{4})/);
                        
                        if (dateMatch) {
                            if (dateMatch[0].includes('-')) {
                                date = dateMatch[0];
                            } else if (dateMatch[0].includes('/')) {
                                const parts = dateMatch[0].split('/');
                                if (parts[2] && parts[2].length === 4) {
                                    // MM/DD/YYYY format
                                    date = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
                                } else if (parts[0] && parts[0].length === 4) {
                                    // YYYY/MM/DD format
                                    date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                                }
                            } else if (dateMatch[1] && dateMatch[1].length === 4) {
                                // Just year
                                date = `${dateMatch[1]}-01-01`;
                            }
                        }
                    }
                    
                    // Extract inventors/assignee info and format as array like Google Patents
                    const assigneeText = getText([
                        '.assignee', '.applicant', '.inventor', 'td:nth-child(4)'
                    ]);
                    
                    let inventors = ['Unknown Inventor'];
                    if (assigneeText) {
                        // Split by common separators and clean up
                        inventors = assigneeText.split(/[,;]/)
                            .map(name => name.trim())
                            .filter(name => name && name.length > 1)
                            .slice(0, 5); // Limit to 5 like Google Patents
                        
                        if (inventors.length === 0) {
                            inventors = [assigneeText];
                        }
                    }
                    
                    // Extract abstract/description
                    let abstract = 'No abstract available';
                    const abstractText = getText([
                        // '.abstract', '.description', '.summary', 
                        'td:last-child'
                        // 'td[class*="abstract"]'
                    ]);
                    // Extract the title (everything between the ID number and "US")
                    const titleMatch = abstractText.match(/\d+\.(?:\d+)?\s*(.*?)\s*US/);
                    const title1 = titleMatch ? titleMatch[1].trim() : "";

                    // Extract "US" (with or without date)
                    const usMatch = abstractText.match(/US\s*(?:-\s*\d{2}\.\d{2}\.\d{4})?/);
                    const countryDateMatch = abstractText.match(/\b(US)\b\s*-\s*(\d{2}\.\d{2}\.\d{4})?/);

                    const country = countryDateMatch ? countryDateMatch[1] : "";
                    const date1 = countryDateMatch && countryDateMatch[2] ? countryDateMatch[2] : "";
                    const fullID = country + patentId;

                    console.log("Title:", title1);
                    console.log("Country:", country);
                    console.log(`My Abstract text: ${abstractText}`);
                    
                    if (abstractText && abstractText.length > 20) {
                        abstract = abstractText.length > 300 ? 
                            abstractText.substring(0, 300) + '...' : 
                            abstractText;
                    }
                    
                    // Get URLs
                    const detailUrl = getUrl([
                        'a[href*="detail"]', '.patent-title a', '.title a'
                    ]);
                    
                    const pdfUrl = getUrl([
                        'a[href*=".pdf"]', 'a[title*="PDF" i]'
                    ]) || (detailUrl ? `${detailUrl}&format=pdf` : '');
                    
                    // Only add if we have essential data
                    if (patentId || title) {
                        results.push({
                            id: fullID || `WIPO-${i + 1}`,
                            title: title1,
                            date: date1,
                            inventors: patentId,
                            abstract: country,
                            googlePatentUrl: detailUrl, // Keep same field name for consistency
                            pdfUrl: pdfUrl,
                            status: 'available' // Match Google Patents status field
                        });
                    }
                } catch (e) {
                    continue;
                }
            }
            
            return results;
        }, maxResults);
        
        await browser.close();
        logVisualStep('WIPO', 'complete', `Found ${patents.length} patents`);
        // console.log(normalizePatent(patents));
        printPatentsSimple(patents, "wipo");
        return patents;
        
    } catch (error) {
        logVisualStep('WIPO', 'error', `Search failed: ${error.message}`);
        
        if (browser) {
            try {
                await browser.close();
            } catch (e) {}
        }
        
        throw error;
    }
}
function normalizePatent(raw) {
    // Utility: clean text
    const clean = (txt) => (txt || "")
        .replace(/\s+/g, " ")
        .replace(/\u00A0/g, " ")
        .trim();

    // Extract ID
    let id = "";
    if (raw.id) {
        id = clean(raw.id).toUpperCase();
        // Fix cases like "1.20170364492WEB CONTENT..."
        const match = id.match(/US\d+[A-Z]?\d*/i);
        if (match) id = match[0].toUpperCase();
    } else {
        const idMatch = (raw.title || "").match(/US\d+[A-Z]?\d*/i);
        if (idMatch) id = idMatch[0].toUpperCase();
    }

    // Extract Title
    let title = clean(raw.title || "");
    if (id && title.toUpperCase().startsWith(id)) {
        title = title.replace(id, "").trim();
    }

    // Extract Date
    let date = "";
    if (raw.date) {
        const d = clean(raw.date);
        const isoMatch = d.match(/\d{4}-\d{2}-\d{2}/);
        const euMatch = d.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
        if (isoMatch) {
            date = isoMatch[0];
        } else if (euMatch) {
            date = `${euMatch[3]}-${euMatch[2]}-${euMatch[1]}`;
        } else if (/^\d{4}$/.test(d)) {
            date = `${d}-01-01`;
        }
    }

    // Inventors
    let inventors = [];
    if (Array.isArray(raw.inventors) && raw.inventors.length) {
        inventors = raw.inventors.map(clean).filter(Boolean);
    } else if (raw.inventor) {
        inventors = [clean(raw.inventor)];
    }
    if (!inventors.length) inventors = ["Unknown Inventor"];

    // Applicant
    let applicant = clean(raw.applicant || "");

    // Abstract
    let abstract = clean(raw.abstract || "");
    if (abstract.length > 600) abstract = abstract.substring(0, 600) + "...";

    // URLs
    const googlePatentUrl = raw.googlePatentUrl || (id ? `https://patents.google.com/patent/${id}/en` : "");
    const pdfUrl = raw.pdfUrl || (googlePatentUrl ? `${googlePatentUrl}?oq=${id}` : "");

    return {
        id,
        title,
        date,
        inventors,
        applicant,
        abstract,
        googlePatentUrl,
        pdfUrl,
        status: "available"
    };
}

function normalizeAll(raws) {
    if (!Array.isArray(raws)) return [];
    return raws.map(r => normalizePatent(r));
}

// Batch download endpoint
app.post('/api/batch-download', async (req, res) => {
    try {
        const { patentIds } = req.body;
        
        if (!Array.isArray(patentIds) || patentIds.length === 0) {
            return res.status(400).json({ error: 'Patent IDs array is required' });
        }
        
        console.log(`Batch downloading ${patentIds.length} patents`);
        
        const downloadResults = [];
        
        for (const patentId of patentIds) {
            try {
                const pdfBuffer = await downloadPatentPDF(patentId, `https://patents.google.com/patent/${patentId}`);
                console.log(`Downloaded PDF for patent https://patents.google.com/patent/${patentId}`);
                // Save to temp directory
                const filename = `patent_${patentId}.pdf`;
                const filepath = path.join(__dirname, 'temp', filename);
                await fs.writeFile(filepath, pdfBuffer);
                
                downloadResults.push({
                    patentId: patentId,
                    status: 'success',
                    filename: filename,
                    size: pdfBuffer.length
                });
                
            } catch (error) {
                downloadResults.push({
                    patentId: patentId,
                    status: 'failed',
                    error: error.message
                });
            }
        }
        
        res.json({
            results: downloadResults,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Batch download error:', error);
        res.status(500).json({ 
            error: 'Batch download failed',
            details: error.message 
        });
    }
});

// Create temp directory for downloads
async function initializeDirectories() {
    const tempDir = path.join(__dirname, 'temp');
    try {
        await fs.access(tempDir);
    } catch {
        await fs.mkdir(tempDir, { recursive: true });
        console.log('Created temp directory for downloads');
    }
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
});

// Logs endpoint
app.get('/api/logs', (req, res) => {
    const logFile = path.join(__dirname, 'search.log');
    fs.readFile(logFile, 'utf8')
        .then(data => res.send(data))
        .catch(() => res.json({ message: 'No logs available' }));
});

// Start server
async function startServer() {
    try {
        await initializeDirectories();
        
        app.listen(PORT, () => {
            console.log(`🚀 Patent Search Server running on http://localhost:${PORT}`);
            console.log(`📁 Downloads will be saved to: ${path.join(__dirname, 'temp')}`);
            console.log('🔍 Ready to search and download patents!');
        });
        
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();