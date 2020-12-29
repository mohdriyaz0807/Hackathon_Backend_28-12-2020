const jwt = require('jsonwebtoken')


let auth = (req, res, next) => {
if(req.headers.authorization!==undefined){
    jwt.verify(req.headers.authorization, process.env.TOKEN_PASS, (err, decoded) => {
        if (err) throw (res.status(404).json({
            message:'session ended',icon:'error'
        }))
        console.log(decoded)
    })
    next()
    }
else{
    res.status(404).json({
        message:"token not authorized",icon:'warning'
    })
    swal({
        title:'INVALID TOKEN',
        icon:'error'
    })
}
}

module.exports = auth