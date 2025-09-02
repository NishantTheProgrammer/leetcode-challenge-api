import mongoose from "mongoose";

import User from "./user.js";
import Season from "./season.js";
import Participant from "./participant.js";

const SubmissionSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, // ✅ Proper ObjectId validation
        ref: "User",                          // ✅ Use model name as string
        required: true
    },
    seasonId: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: "Season",
        required: true
    },
    participantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Participant",
        required: true
    },
    title: {
        type: String,
        required: true
    },
    titleSlug: {
        type: String,
        required: true
    },
    submittedAt: {
        type: Date,
        required: true
    },
    language: {
        type: String,
    },
    difficulty: {
        type: String
    }
}, {
    timestamps: true
});


SubmissionSchema.pre("save", async function (next) {
    const [user, season, participant] = await Promise.all([
        User.findById(this.userId),
        Season.findById(this.seasonId),
        Participant.findById(this.participantId)
    ]);

    if (!user) return next(new Error("Invalid userId: User does not exist"));
    if (!season) return next(new Error("Invalid seasonId: Season does not exist"));
    if (!participant) return next(new Error("Invalid participantId: Participant does not exist"));

    next();
});

const Submission = mongoose.model("Submission", SubmissionSchema);
export default Submission;
