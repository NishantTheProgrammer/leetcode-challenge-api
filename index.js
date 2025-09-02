
import express from 'express'
import './database.js';

import seasonRoute from './src/route/season.js';
import userRoute from './src/route/user.js';
import submissionRoute from './src/route/submission.js'



const app = express();

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