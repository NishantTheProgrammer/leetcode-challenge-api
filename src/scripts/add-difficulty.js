import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to extract problem slug from LeetCode URL
function extractProblemSlug(url) {
  const match = url.match(/leetcode\.com\/problems\/([^\/]+)/);
  return match ? match[1] : null;
}

// Function to fetch problem details from LeetCode GraphQL API
async function fetchProblemDetails(titleSlug) {
  const query = {
    query: `query getQuestionDetails { 
      q: question(titleSlug: "${titleSlug}") { 
        titleSlug 
        difficulty 
        topicTags { 
          name 
        } 
      } 
    }`
  };

  try {
    const response = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify(query)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error(`GraphQL errors for ${titleSlug}:`, data.errors);
      return null;
    }

    return data.data?.q;
  } catch (error) {
    console.error(`Error fetching details for ${titleSlug}:`, error.message);
    return null;
  }
}

// Function to add delay between requests to avoid rate limiting
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  try {
    console.log('Reading output.json...');
    const inputPath = path.join(__dirname, 'output.json');
    const outputPath = path.join(__dirname, 'difficulty-output.json');
    
    const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    console.log(`Found ${inputData.length} submissions`);

    // Extract unique problem slugs
    const uniqueSlugs = new Set();
    const slugToSubmissions = new Map();

    inputData.forEach((submission, index) => {
      const slug = extractProblemSlug(submission.link);
      if (slug) {
        uniqueSlugs.add(slug);
        if (!slugToSubmissions.has(slug)) {
          slugToSubmissions.set(slug, []);
        }
        slugToSubmissions.get(slug).push(index);
      } else {
        console.warn(`Could not extract slug from: ${submission.link}`);
      }
    });

    console.log(`Found ${uniqueSlugs.size} unique problems`);

    // Fetch details for each unique problem
    const problemDetails = new Map();
    let processed = 0;

    for (const slug of uniqueSlugs) {
      console.log(`Processing ${slug} (${++processed}/${uniqueSlugs.size})`);
      
      const details = await fetchProblemDetails(slug);
      if (details) {
        problemDetails.set(slug, {
          difficulty: details.difficulty,
          topicTags: details.topicTags.map(tag => tag.name)
        });
      } else {
        // Set default values if API call fails
        problemDetails.set(slug, {
          difficulty: 'Unknown',
          topicTags: []
        });
      }

      // Add delay to avoid rate limiting (500ms between requests)
      if (processed < uniqueSlugs.size) {
        await delay(500);
      }
    }

    // Enhance original data with difficulty and topic tags
    const enhancedData = inputData.map(submission => {
      const slug = extractProblemSlug(submission.link);
      const details = problemDetails.get(slug);
      
      return {
        ...submission,
        problemSlug: slug,
        difficulty: details?.difficulty || 'Unknown',
        topicTags: details?.topicTags || []
      };
    });

    // Write enhanced data to output file
    fs.writeFileSync(outputPath, JSON.stringify(enhancedData, null, 2));
    console.log(`\nEnhanced data written to ${outputPath}`);
    console.log(`Total submissions: ${enhancedData.length}`);
    console.log(`Unique problems: ${uniqueSlugs.size}`);

    // Print summary statistics
    const difficultyStats = {};
    enhancedData.forEach(submission => {
      const diff = submission.difficulty;
      difficultyStats[diff] = (difficultyStats[diff] || 0) + 1;
    });

    console.log('\nDifficulty distribution:');
    Object.entries(difficultyStats).forEach(([difficulty, count]) => {
      console.log(`  ${difficulty}: ${count} submissions`);
    });

  } catch (error) {
    console.error('Error processing data:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
