
import mongoose from 'mongoose';


console.log(process.env.MONGO_URL);
await mongoose.connect(process.env.MONGO_URL).catch(e => console.log(e.message))