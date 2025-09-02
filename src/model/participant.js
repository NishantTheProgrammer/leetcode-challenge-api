import mongoose from "mongoose";
import User from "./user.js";
import Season from "./season.js";


const ParticipantSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.ObjectId, 
        ref: User
    },
    seasonId: { 
        type: mongoose.ObjectId, 
        ref: Season
    },
}, {
    timestamps: true
})

const Participant = mongoose.model('participant', ParticipantSchema);
export default Participant;
