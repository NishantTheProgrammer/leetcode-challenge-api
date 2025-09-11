import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const historicalDataDir = path.join(__dirname, '../../data/historical');
const outputFile = path.join(__dirname, 'output.json');

// Date conversion function
function convertDateFormat(dateStr, season) {
    // Parse the input date (format: M/D or MM/DD)
    const [month, day] = dateStr.split('/').map(num => parseInt(num));
    
    // Determine year based on season
    let year;
    if (season.toLowerCase() === 'season 1') {
        // Season 1: 12/7/2023 to 3/15/2024
        // December dates are in 2023, January-March dates are in 2024
        year = month === 12 ? 2023 : 2024;
    } else {
        // Season 2: 3/16/2025 to 6/23/2025 (all in 2025)
        year = 2025;
    }
    
    // Format as dd-mm-yyyy
    const paddedDay = day.toString().padStart(2, '0');
    const paddedMonth = month.toString().padStart(2, '0');
    
    return `${paddedDay}-${paddedMonth}-${year}`;
}

async function processHistoricalData() {
    const results = [];
    
    try {
        // Get all CSV files from the historical directory
        const files = fs.readdirSync(historicalDataDir).filter(file => file.endsWith('.csv'));
        
        for (const file of files) {
            console.log(`Processing ${file}...`);
            
            // Extract name and season from filename
            const fileName = path.basename(file, '.csv');
            const parts = fileName.split(' - ');
            const season = parts[1]; // "Season 1" or "Season 2"
            const name = parts[2]; // User name
            
            const filePath = path.join(historicalDataDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            
            let headerRowIndex = -1;
            let dayColIndex = -1;
            let dateColIndex = -1;
            let linksColIndex = -1;
            
            // Find the header row that contains "Day", "Date", and "Links"
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.includes('Day') && line.includes('Date') && line.includes('Link')) {
                    headerRowIndex = i;
                    const headers = line.split(',').map(h => h.trim().replace(/"/g, ''));
                    
                    // Find column indices
                    dayColIndex = headers.findIndex(h => h.toLowerCase().includes('day'));
                    dateColIndex = headers.findIndex(h => h.toLowerCase().includes('date'));
                    linksColIndex = headers.findIndex(h => h.toLowerCase().includes('link'));
                    
                    // console.log(`Found header at line ${i}: Day=${dayColIndex}, Date=${dateColIndex}, Links=${linksColIndex}`);
                    break;
                }
            }
            
            if (headerRowIndex === -1) {
                console.log(`No valid header found in ${file}, skipping...`);
                continue;
            }
            
            // Process data rows after the header
            for (let i = headerRowIndex + 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                // Split by comma but handle quoted fields
                const columns = [];
                let current = '';
                let inQuotes = false;
                
                for (let j = 0; j < line.length; j++) {
                    const char = line[j];
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        columns.push(current.trim().replace(/"/g, ''));
                        current = '';
                    } else {
                        current += char;
                    }
                }
                columns.push(current.trim().replace(/"/g, ''));
                
                // Check if we have valid data
                if (columns.length > Math.max(dayColIndex, dateColIndex, linksColIndex) && 
                    columns[dayColIndex] && 
                    columns[dateColIndex] && 
                    columns[linksColIndex] &&
                    columns[dayColIndex] !== 'Day' &&
                    columns[linksColIndex].includes('http')) {
                    
                    const date = columns[dateColIndex].trim();
                    const links = columns[linksColIndex].trim();
                    
                    // Handle different link separators and extract multiple links
                    let linkArray = [];
                    
                    // First, try to split by comma
                    if (links.includes(',')) {
                        linkArray = links.split(',');
                    } 
                    // Then try to split by space + http pattern
                    else if (links.includes(' http')) {
                        // Use regex to split on space followed by http
                        linkArray = links.split(/\s+(?=https?:\/\/)/);
                    }
                    // Handle cases where links are concatenated without space
                    else if ((links.match(/https?:\/\//g) || []).length > 1) {
                        // Split on https:// or http:// but keep the protocol
                        linkArray = links.split(/(https?:\/\/)/).filter(part => part.trim() && part !== 'https://' && part !== 'http://');
                        // Reconstruct the links
                        const reconstructed = [];
                        for (let i = 0; i < linkArray.length; i += 2) {
                            if (linkArray[i] && linkArray[i+1]) {
                                reconstructed.push(linkArray[i] + linkArray[i+1]);
                            }
                        }
                        linkArray = reconstructed;
                    }
                    // Handle newline separated links
                    else if (links.includes('\n')) {
                        linkArray = links.split('\n');
                    }
                    // Single link
                    else {
                        linkArray = [links];
                    }
                    
                    // Clean and filter links
                    linkArray = linkArray
                        .map(link => link.trim())
                        .filter(link => link && link.startsWith('http'))
                        .map(link => {
                            // Remove any trailing non-URL characters
                            return link.replace(/[^\/\w\-\.\?\&\=\%\:]+$/, '');
                        });
                    
                    // Convert date to dd-mm-yyyy format based on season
                    const formattedDate = convertDateFormat(date, season);
                    
                    // Unwind links - create separate entry for each link
                    linkArray.forEach(link => {
                        results.push({
                            date: formattedDate,
                            link: link, // Single link instead of array
                            name: name,
                            season: season.toLowerCase() // "season 1" or "season 2"
                        });
                    });
                }
            }
        }
        
        // Sort results by season, name, and date
        results.sort((a, b) => {
            if (a.season !== b.season) {
                return a.season.localeCompare(b.season);
            }
            if (a.name !== b.name) {
                return a.name.localeCompare(b.name);
            }
            return new Date(a.date) - new Date(b.date);
        });
        
        // Write to output.json
        fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
        
        console.log(`Successfully processed ${files.length} files and wrote ${results.length} entries to output.json`);
        
    } catch (error) {
        console.error('Error processing historical data:', error);
    }
}

// Run the script
processHistoricalData();