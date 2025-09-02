import mongoose from "mongoose";


const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },
}, {
    timestamps: true
})

const User = mongoose.model('user', UserSchema);
export default User;
