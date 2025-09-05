import Submission from "../model/submission.js";


const getSubmissionList = async (req, res) => {
    const submission = await Submission.aggregate([
        {
            $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user'
            }
        },
        {
            $lookup: {
                from: 'seasons',
                localField: 'seasonId',
                foreignField: '_id',
                as: 'season'
            }
        }
    ]);

    return res.status(200).json({
        data: submission
    })
}


export {
    getSubmissionList
}