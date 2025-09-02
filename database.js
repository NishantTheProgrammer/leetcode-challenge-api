
import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('connected to mongodb'))
    .catch(e => console.log(e.message))