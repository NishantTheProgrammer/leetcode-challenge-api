import mongoose from "mongoose";


const ParticipantSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User"
    },
    seasonId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Season"
    },
}, {
    timestamps: true
})

const Participant = mongoose.model('participant', ParticipantSchema);
export default Participant;
