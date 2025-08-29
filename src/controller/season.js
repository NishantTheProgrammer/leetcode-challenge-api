import Season from "../model/season.js";


const createSeason = async (req, res) => {
    const body = req.body;

    const season = await Season.create(body);

    console.log(body);

    return res.status(201).json({
        data: season
    })

    
}

const getSeasonList = async (req, res) => {
    const seasons = await Season.find();

    return res.status(200).json({
        data: seasons
    })
}

export {
    createSeason,
    getSeasonList
}