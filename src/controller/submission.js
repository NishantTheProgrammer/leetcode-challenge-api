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
        },
        {
            $addFields: {
                userName: { $arrayElemAt: ['$user.name', 0] },
                seasonName: { $arrayElemAt: ['$season.name', 0] }
            }
        },
        {
            $project: {
                user: 0,
                season: 0
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