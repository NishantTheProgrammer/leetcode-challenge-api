import Submission from "../model/submission.js";



const getSubmissionList = async (req, res) => {
    const submission = await Submission.find();

    return res.status(200).json({
        data: submission
    })
}

export {
    getSubmissionList
}