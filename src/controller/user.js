import User from "../model/user.js";
import Submission from "../model/submission.js";
import Participant from "../model/participant.js";


const createUser = async (req, res) => {
    const body = req.body;

    const user = await User.create(body);

    console.log(body);

    return res.status(201).json({
        data: user
    })

    
}

const getUserList = async (req, res) => {
    try {
        const users = await User.aggregate([
            {
                $lookup: {
                    from: 'participants',
                    localField: '_id',
                    foreignField: 'userId',
                    as: 'participations'
                }
            },
            {
                $lookup: {
                    from: 'seasons',
                    localField: 'participations.seasonId',
                    foreignField: '_id',
                    as: 'seasons'
                }
            },
            {
                $lookup: {
                    from: 'submissions',
                    localField: '_id',
                    foreignField: 'userId',
                    as: 'submissions'
                }
            },
            {
                $addFields: {
                    // Calculate unique problems solved
                    uniqueProblems: {
                        $setUnion: ['$submissions.titleSlug', []]
                    },
                    // Filter submissions by difficulty
                    easySubmissions: {
                        $filter: {
                            input: '$submissions',
                            cond: { $eq: ['$$this.difficulty', 'Easy'] }
                        }
                    },
                    mediumSubmissions: {
                        $filter: {
                            input: '$submissions',
                            cond: { $eq: ['$$this.difficulty', 'Medium'] }
                        }
                    },
                    hardSubmissions: {
                        $filter: {
                            input: '$submissions',
                            cond: { $eq: ['$$this.difficulty', 'Hard'] }
                        }
                    },
                    // Get recent submissions for status
                    recentSubmissions: {
                        $filter: {
                            input: '$submissions',
                            cond: {
                                $and: [
                                    { $ne: ['$$this.submittedAt', null] },
                                    {
                                        $gte: [
                                            '$$this.submittedAt',
                                            { $subtract: [new Date(), 30 * 24 * 60 * 60 * 1000] }
                                        ]
                                    }
                                ]
                            }
                        }
                    },
                    // Get unique languages
                    languages: {
                        $setUnion: ['$submissions.language', []]
                    }
                }
            },
            {
                $addFields: {
                    problemsSolved: {
                        total: { $size: '$uniqueProblems' },
                        easy: { $size: { $setUnion: ['$easySubmissions.titleSlug', []] } },
                        medium: { $size: { $setUnion: ['$mediumSubmissions.titleSlug', []] } },
                        hard: { $size: { $setUnion: ['$hardSubmissions.titleSlug', []] } }
                    },
                    streak: { $size: '$uniqueProblems' }, // Simplified streak as total problems
                    status: {
                        $cond: {
                            if: { $gt: [{ $size: '$recentSubmissions' }, 0] },
                            then: 'Active',
                            else: 'Away'
                        }
                    },
                    participations: {
                        $reduce: {
                            input: '$seasons.name',
                            initialValue: '',
                            in: {
                                $cond: {
                                    if: { $eq: ['$$value', ''] },
                                    then: '$$this',
                                    else: { $concat: ['$$value', ', ', '$$this'] }
                                }
                            }
                        }
                    },
                    languages: {
                        $reduce: {
                            input: '$languages',
                            initialValue: '',
                            in: {
                                $cond: {
                                    if: { $eq: ['$$value', ''] },
                                    then: '$$this',
                                    else: { $concat: ['$$value', ', ', '$$this'] }
                                }
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    user: '$name',
                    username: '$username',
                    problemsSolved: '$problemsSolved',
                    streak: '$streak',
                    status: '$status',
                    participations: '$participations',
                    languages: '$languages',
                    joinDate: {
                        $dateToString: {
                            format: '%m/%d/%Y',
                            date: '$createdAt'
                        }
                    }
                }
            },
            {
                $addFields: {
                    points: {
                        $add: [
                            { $multiply: ['$problemsSolved.hard', 5] },
                            { $multiply: ['$problemsSolved.medium', 2] },
                            '$problemsSolved.easy'
                        ]
                    }
                }
            },
            {
                $sort: { 'points': -1 }
            }
        ]);

        // Add rank to each user
        const usersWithRank = users.map((user, index) => ({
            _id: user._id,
            user: user.user,
            username: `@${user.username}`,
            rank: getRankBadge(user.points),
            problemsSolved: user.problemsSolved.total,
            easy: user.problemsSolved.easy,
            medium: user.problemsSolved.medium,
            hard: user.problemsSolved.hard,
            points: user.points,
            streak: `${user.streak} days`,
            status: user.status,
            participations: user.participations || 'No seasons',
            languages: user.languages || 'JavaScript',
            joinDate: user.joinDate,
            position: index + 1
        }));

        return res.status(200).json({
            data: usersWithRank
        });

    } catch (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({
            error: 'Failed to fetch users',
            message: error.message
        });
    }
}

// Helper function to determine rank badge based on points
const getRankBadge = (points) => {
    if (points >= 300) return 'Platinum';
    if (points >= 150) return 'Gold';
    if (points >= 50) return 'Bronze';
    return 'Beginner';
}


export {
    createUser,
    getUserList
}