import mongoose from 'mongoose';

import '../../database.js';

import Submission from '../model/submission.js';

const sync = async () => {
    await Submission.create({
        "userId": "68b6c5f0fc8f6f1cd04a1386",
        "seasonId": "68b1975f29ff283da961b5dd",
        "participantId": "68b6ccc31dddfb024713f643",
        "title": "Dynamic Programming Challenge",
        "titleSlug": "dynamic-programming-challenge",
        "submittedAt": "2025-09-02T10:30:00.000Z",
        "language": "JavaScript",
        "difficulty": "Hard"
    });
    console.log('Data inserted ✅');
    mongoose.connection.close();
}


console.log('loading data');
try {
    await sync();
} catch (e) {
    console.log('Error: ', e);
}