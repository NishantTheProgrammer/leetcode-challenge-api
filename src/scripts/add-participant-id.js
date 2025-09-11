import mongoose from 'mongoose';
import Submission from '../model/submission.js';
import Participant from '../model/participant.js';

// Database connection
const connectDB = async () => {
    try {
        const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/leetcode-challenge';
        await mongoose.connect(mongoUrl);
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

const addParticipantIdToSubmissions = async () => {
    try {
        console.log('🔄 Starting to add participantId to submissions...');
        
        // Get all submissions that don't have participantId
        const submissions = await Submission.find({ 
            participantId: { $exists: false } 
        });
        
        console.log(`📊 Found ${submissions.length} submissions without participantId`);
        
        let updated = 0;
        let failed = 0;
        
        for (const submission of submissions) {
            try {
                // Find the participant record matching userId and seasonId
                const participant = await Participant.findOne({
                    userId: submission.userId,
                    seasonId: submission.seasonId
                });
                
                if (participant) {
                    // Update submission with participantId
                    await Submission.updateOne(
                        { _id: submission._id },
                        { $set: { participantId: participant._id } }
                    );
                    updated++;
                    console.log(`✅ Updated submission ${submission._id} with participantId ${participant._id}`);
                } else {
                    console.log(`⚠️  No participant found for userId: ${submission.userId}, seasonId: ${submission.seasonId}`);
                    failed++;
                }
            } catch (error) {
                console.error(`❌ Error updating submission ${submission._id}:`, error.message);
                failed++;
            }
        }
        
        console.log('\n📈 Summary:');
        console.log(`✅ Successfully updated: ${updated} submissions`);
        console.log(`❌ Failed to update: ${failed} submissions`);
        
        // Verify the updates
        const remainingWithoutParticipantId = await Submission.countDocuments({ 
            participantId: { $exists: false } 
        });
        
        console.log(`📊 Remaining submissions without participantId: ${remainingWithoutParticipantId}`);
        
    } catch (error) {
        console.error('❌ Error in addParticipantIdToSubmissions:', error);
    }
};

const main = async () => {
    await connectDB();
    await addParticipantIdToSubmissions();
    await mongoose.connection.close();
    console.log('🔚 Script completed');
};

main().catch(console.error);
