import mongoose from 'mongoose';
import axios from 'axios';

import '../../database.js';
import Season from '../model/season.js';

const sync = async () => {
    const now = new Date();
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
            $unwind: {
                path: "$participants",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'users', // users collection
                localField: 'participants.userId', 
                foreignField: '_id',
                as: 'participants.user'
            }
        },
        {
            $unwind: {
                path: "$participants.user",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $group: {
                _id: "$_id",
                startDate: { $first: "$startDate" },
                endDate: { $first: "$endDate" },
                name: { $first: "$name" }, // if you have season name or other fields
                participants: { $push: "$participants" }
            }
        }
    ]);

    for (const seasonData of seasonsData) {
        await processSesionData(seasonData);
    }

    mongoose.connection.close();
};

const processSesionData = async (seasonData) => {
    const { name, startDate, endDate, participants } = seasonData;

    console.log(`Fetching data (${name}): ${startDate.toLocaleString().split(',')[0]} to ${endDate.toLocaleString().split(',')[0]}`);
    console.log('participants', participants[0]);
    let payload = {
        "query": `
            query getMultipleACSubmissions { 

                ${
                    participants.map(({ user }) => `
                        ${user.username}: recentAcSubmissionList(username: "${user.username}", limit: 2) { 
                            id
                            title 
                            titleSlug 
                            timestamp 
                            statusDisplay 
                            lang 
                        } 
                    `).join('\n')
                } 
            }`
    };
    const {data} = await axios.post('https://leetcode.com/graphql', payload);
    console.log(JSON.stringify(data, 3, 3));
}


console.log('loading data');
try {
    await sync();
} catch (e) {
    console.log('Error: ', e);
}