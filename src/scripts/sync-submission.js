import mongoose from 'mongoose';
import axios from 'axios';

import '../../database.js';
import Season from '../model/season.js';
import Submission from '../model/submission.js';
import Participant from '../model/participant.js';

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';
const SUBMISSIONS_LIMIT = 200;
const REQUEST_TIMEOUT = 10000;
const MAX_DAYS_OLD = 10;

const sync = async () => {
    try {
        console.log('🚀 Starting LeetCode submissions sync...');
        
        const activeSeasons = await getActiveSeasons();
        
        if (activeSeasons.length === 0) {
            console.log('ℹ️  No active seasons found');
            return;
        }

        console.log(`📊 Found ${activeSeasons.length} active season(s)`);
        
        for (const seasonData of activeSeasons) {
            await processSeasonData(seasonData);
        }
        
        console.log('✅ Sync completed successfully');
    } catch (error) {
        console.error('❌ Sync failed:', error.message);
        throw error;
    } finally {
        await mongoose.connection.close();
    }
};

const getActiveSeasons = async () => {
    const now = new Date();
    
    try {
        const seasonsData = await Season.aggregate([
            {
                $match: {
                    startDate: { $lte: now },
                    endDate: { $gte: now }
                }
            },
            {
                $lookup: {
                    from: 'participants',
                    localField: '_id',
                    foreignField: 'seasonId',
                    as: 'participants'
                }
            },
            {
                $match: {
                    'participants.0': { $exists: true }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'participants.userId',
                    foreignField: '_id',
                    as: 'participantUsers'
                }
            },
            {
                $addFields: {
                    participants: {
                        $map: {
                            input: '$participants',
                            as: 'participant',
                            in: {
                                $mergeObjects: [
                                    '$$participant',
                                    {
                                        user: {
                                            $arrayElemAt: [
                                                {
                                                    $filter: {
                                                        input: '$participantUsers',
                                                        cond: { $eq: ['$$this._id', '$$participant.userId'] }
                                                    }
                                                },
                                                0
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    participantUsers: 0
                }
            }
        ]);
        
        return seasonsData;
    } catch (error) {
        console.error('Error fetching active seasons:', error.message);
        throw new Error(`Failed to fetch active seasons: ${error.message}`);
    }
};

const flattenSubmissionsData = (data) => {
    return Object.entries(data)
        .map(([username, submissions]) => 
            submissions.map(submission => ({
                ...submission,
                username
            }))
        )
        .flat();
};


const buildQuestionDetailsQuery = (submissions) => {
    const uniqueTitleSlugs = [...new Set(submissions.map(s => s.titleSlug))];
    
    const questionQueries = uniqueTitleSlugs.map((titleSlug, index) => {
        const fieldName = `q${index}`;
        return `${fieldName}: question(titleSlug: "${titleSlug}") { 
            titleSlug
            difficulty
            topicTags {
                name
            }
        }`;
    });

    return `query getMultipleQuestionDetails { 
        ${questionQueries.join('\n')}
    }`;
};

const fetchSubmissionsFromLeetCode = async (participants, maxDaysOld = MAX_DAYS_OLD) => {
    // Calculate cutoff timestamp for filtering
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxDaysOld);
    const cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000);
    
    console.log(`   📅 Filtering submissions newer than ${cutoffDate.toLocaleDateString()}`);
    
    const userQueries = participants
        .filter(p => p.user?.username)
        .map(({ user }) => `
            ${user.username}: recentAcSubmissionList(username: "${user.username}", limit: ${SUBMISSIONS_LIMIT}) { 
                id
                title 
                titleSlug 
                timestamp 
                statusDisplay 
                lang 
            }
        `);

    if (userQueries.length === 0) {
        throw new Error('No valid participants with usernames found');
    }

    const payload = {
        query: `query getMultipleACSubmissions { 
            ${userQueries.join('\n')}
        }`
    };

    try {
        const response = await axios.post(LEETCODE_GRAPHQL_URL, payload, {
            timeout: REQUEST_TIMEOUT,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'LeetCode-Challenge-API/1.0'
            }
        });

        if (response.data.errors) {
            throw new Error(`LeetCode API errors: ${JSON.stringify(response.data.errors)}`);
        }

        // Apply date filtering immediately after receiving data
        const filteredData = {};
        Object.entries(response.data.data).forEach(([username, submissions]) => {
            if (submissions && Array.isArray(submissions)) {
                filteredData[username] = submissions.filter(submission => {
                    const submissionTimestamp = parseInt(submission.timestamp);
                    return submissionTimestamp >= cutoffTimestamp;
                });
            } else {
                filteredData[username] = submissions;
            }
        });

        return { data: filteredData };
    } catch (error) {
        if (error.response) {
            throw new Error(`LeetCode API error (${error.response.status}): ${error.response.statusText}`);
        }
        throw new Error(`Network error: ${error.message}`);
    }
};

const fetchQuestionDetails = async (submissions) => {
    if (submissions.length === 0) {
        return { data: {}, titleSlugs: [] };
    }

    const uniqueTitleSlugs = [...new Set(submissions.map(s => s.titleSlug))];
    const query = buildQuestionDetailsQuery(submissions);
    
    try {
        const response = await axios.post(LEETCODE_GRAPHQL_URL, { query });

        if (response.data.errors) {
            console.warn('⚠️  Some question detail queries failed:', response.data.errors);
        }

        return { 
            data: response.data.data || {}, 
            titleSlugs: uniqueTitleSlugs 
        };
    } catch (error) {
        console.warn('⚠️  Failed to fetch question details:', error.message);
        return { data: {}, titleSlugs: uniqueTitleSlugs };
    }
};

const saveSubmissions = async (submissions, seasonData) => {
    if (submissions.length === 0) {
        return 0;
    }

    const participantMap = new Map();
    seasonData.participants.forEach(p => {
        if (p.user?.username) {
            participantMap.set(p.user.username, p);
        }
    });

    const existingSubmissions = await Submission.find({
        seasonId: seasonData._id,
        $or: submissions.map(s => ({
            titleSlug: s.titleSlug,
            submittedAt: new Date(parseInt(s.timestamp) * 1000)
        }))
    }).select('titleSlug submittedAt userId');

    const existingSet = new Set(
        existingSubmissions.map(s => 
            `${s.titleSlug}-${s.submittedAt.getTime()}-${s.userId}`
        )
    );

    const bulkOps = [];
    const skippedSubmissions = [];

    for (const submission of submissions) {
        const participant = participantMap.get(submission.username);
        
        if (!participant) {
            console.warn(`⚠️  Participant not found for username: ${submission.username}`);
            continue;
        }

        const submittedAt = new Date(parseInt(submission.timestamp) * 1000);
        const uniqueKey = `${submission.titleSlug}-${submittedAt.getTime()}-${participant.userId}`;

        if (existingSet.has(uniqueKey)) {
            skippedSubmissions.push(submission.username);
            continue;
        }

        bulkOps.push({
            insertOne: {
                document: {
                    userId: participant.userId,
                    seasonId: seasonData._id,
                    participantId: participant._id,
                    title: submission.title,
                    titleSlug: submission.titleSlug,
                    submittedAt: submittedAt,
                    language: submission.lang,
                    difficulty: submission.difficulty,
                    topicTags: submission.topicTags || []
                }
            }
        });
    }

    if (bulkOps.length === 0) {
        console.log(`   ℹ️  All ${submissions.length} submissions already exist`);
        return 0;
    }

    try {
        const result = await Submission.bulkWrite(bulkOps, { ordered: false });
        
        if (skippedSubmissions.length > 0) {
            console.log(`   ⏭️  Skipped ${skippedSubmissions.length} duplicate submissions`);
        }
        
        return result.insertedCount;
    } catch (error) {
        console.error('❌ Bulk write failed:', error.message);
        
        if (error.writeErrors && error.writeErrors.length > 0) {
            console.error(`   ${error.writeErrors.length} individual write errors occurred`);
            return error.result?.insertedCount || 0;
        }
        
        throw error;
    }
};

const processSeasonData = async (seasonData) => {
    const { name, startDate, endDate, participants } = seasonData;

    try {
        console.log(`\n📅 Processing season: ${name}`);
        console.log(`   Period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
        console.log(`   Participants: ${participants.length}`);

        if (participants.length === 0) {
            console.log('   ⚠️  No participants found, skipping...');
            return;
        }

        console.log('   📥 Fetching submissions from LeetCode...');
        const submissionsResponse = await fetchSubmissionsFromLeetCode(participants, MAX_DAYS_OLD);
        
        const recentSubmissions = flattenSubmissionsData(submissionsResponse.data);
        
        if (recentSubmissions.length === 0) {
            console.log(`   ℹ️  No submissions found within the last ${MAX_DAYS_OLD} days`);
            return;
        }

        console.log(`   📊 Found ${recentSubmissions.length} submissions within the last ${MAX_DAYS_OLD} days`);

        console.log('   📥 Fetching question details (difficulty & topic tags)...');
        const questionDetailsResponse = await fetchQuestionDetails(recentSubmissions);

        const questionDetailsMap = {};
        Object.values(questionDetailsResponse.data).forEach(questionData => {
            if (questionData && questionData.titleSlug) {
                questionDetailsMap[questionData.titleSlug] = {
                    difficulty: questionData.difficulty,
                    topicTags: questionData.topicTags ? questionData.topicTags.map(tag => tag.name) : []
                };
            }
        });

        recentSubmissions.forEach(submission => {
            const details = questionDetailsMap[submission.titleSlug];
            submission.difficulty = details?.difficulty || 'Unknown';
            submission.topicTags = details?.topicTags || [];
        });

        console.log('   💾 Saving submissions to database...');
        const savedCount = await saveSubmissions(recentSubmissions, seasonData);
        
        console.log(`   ✅ Saved ${savedCount} new submissions`);
        
    } catch (error) {
        console.error(`❌ Failed to process season ${name}:`, error.message);
        throw error;
    }
};

console.log('🔄 Starting LeetCode submissions synchronization...');
try {
    await sync();
} catch (error) {
    console.error('💥 Synchronization failed:', error.message);
    process.exit(1);
}