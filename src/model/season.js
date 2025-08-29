import mongoose from "mongoose";

function validateDates(next) {
    if(this.startDate > this.endDate) throw new Error('Start date should be less than end date');
    next();
}

const SeasonSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
})


SeasonSchema.pre('save', validateDates);
SeasonSchema.pre('updateOne', validateDates);

const Season = mongoose.model('season', SeasonSchema);
export default Season;
