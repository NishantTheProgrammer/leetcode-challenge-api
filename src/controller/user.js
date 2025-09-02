import User from "../model/user.js";


const createUser = async (req, res) => {
    const body = req.body;

    const user = await User.create(body);

    console.log(body);

    return res.status(201).json({
        data: user
    })

    
}


export {
    createUser,
}