
import express from 'express'
import cors from 'cors';
import './database.js';

import seasonRoute from './src/route/season.js';
import userRoute from './src/route/user.js';
import submissionRoute from './src/route/submission.js'

const app = express();

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

const port = 3000;

app.use('/season', seasonRoute);
app.use('/user', userRoute);
app.use('/submission', submissionRoute);


app.get('/', (req, res) => {
    return res.json({
        status: 'OK'
    })
});


    function errorHandler(err, req, res, next) {
      console.error(err.stack); // Log the error for debugging

      const statusCode = err.statusCode || 500;
      const message = err.message || 'Internal Server Error';

      res.status(statusCode).json({
        success: false,
        message: message,
      });
    }

     app.use(errorHandler); 


app.listen(port, () => console.log(`App running on port: ${ port }`));