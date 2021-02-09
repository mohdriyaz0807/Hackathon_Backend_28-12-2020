const cors = require('cors')
const express = require("express");
const mongodb = require("mongodb");
const nodemailer = require("nodemailer")
const bcrypt=require('bcrypt')
const jwt = require('jsonwebtoken')
const auth = require('./middleware/token')
const Razorpay = require('razorpay');


require('dotenv').config() 

const mongoClient = mongodb.MongoClient;
const objectId = mongodb.ObjectID
const newObjectId = mongodb.ObjectID()


const app = express();
const dbURL = process.env.DB_URL ||"mongodb://127.0.0.1:27017";
const port = process.env.PORT || 4000
// app.use(express.json());
app.use(function (req,res,next){
  res.header("Access-Control-Allow-Origin","*");
  res.header("Access-Control-Allow-Headers","Origin,X-Requeted-With,Content-Type,Accept");
  res.header("Access-Control-Allow-Methods","GET,POST,OPTIONS,PUT,DELETE");
  res.header("Access-Control-Allow-Credentials",true)
  next()
})



app.post("/registeruser", async (req, res) => {
    try {
      let clientInfo = await mongoClient.connect(dbURL);
      let db = clientInfo.db("Pizza_Users");
      let result = await db
        .collection("Customer")
        .findOne({ email: req.body.email })
      if (result) {
        res.json({ message: "User already registered" ,icon :'warning'});
        console.log(res);
      } else {
        let salt = await bcrypt.genSalt(15);
        let hash = await bcrypt.hash(req.body.password, salt);
        req.body.password = hash;

        let verifyString = (Math.random() * 1e32).toString(36)
        let transporter = nodemailer.createTransport({
                host: "smtp.gmail.com",
                port: 587,
                secure: false, 
                auth: {
                  user: process.env.MAIL_USERNAME, 
                  pass: process.env.MAIL_PASSWORD, 
                },
            });

        let info = await transporter.sendMail({
                from: `Pizza Corner <${process.env.MAIL_USERNAME}>`, 
                to: `${req.body.email}`, 
                subject: "Verification mail",
                text: "click to Verify your email and activate your account", 
                html: `<b>Click on the link to verify your email <a href="https://pizza-apps-frontend.netlify.app/String/${verifyString}"><button type='button'>Click here</button></a></b>`,
            });

        await db.collection("Customer").insertOne(req.body);
        await db.collection("Customer").updateOne({"email": req.body.email},
        {$set: {verifystring: verifyString}})
        res.status(200).json({ message: "Check your mail for activation link" ,icon :'success' });
        clientInfo.close();
      }
    } catch (error) {
      console.log(error);
    }
  })

  app.get('/confirm/:verifyString', async (req, res) => {
    try {
        let clientInfo = await mongoClient.connect(dbURL)
        let db = clientInfo.db("Pizza_Users")
        let result = await db.collection("Customer").findOne({ verifystring: req.params.verifyString})
        if (result) {
                await db.collection("Customer").updateOne({
                    verifystring: req.params.verifyString
                }, {
                    $set: {
                        status: true,
                        verifystring: ''
                    }
                })
                res.send({message:'Your account is activated ,click below to Login',url:"https://pizza-apps-frontend.netlify.app/login"})
                clientInfo.close()
        } else {
            res.send({message:"Link has expired"})
            clientInfo.close()
        }
    } catch (error) {
        console.log(error)
    }
})
  
  app.post("/login", async (req, res) => {
    try {
      let clientInfo = await mongoClient.connect(dbURL);
      let db = clientInfo.db("Pizza_Users");
      let result = await db
        .collection("Customer")
        .findOne({$and:[{ email: req.body.email },{status:true}]});
      if (result) {
        let isTrue = await bcrypt.compare(req.body.password, result.password);
        if (isTrue) {
          let token = await jwt.sign({"userid":result._id,"username":result.username},process.env.TOKEN_PASS,{expiresIn:'1h'})
          res.status(200).json({ message: "Logged in successfully",result ,token,icon :'success'})
          clientInfo.close();
        } else {
          res.status(200).json({ message: "Incorrect Password" ,icon :'warning' });
        }
      } else {
        res.status(400).json({ message: "User not registered" ,icon :'warning' });
      }
    } catch (error) {
      console.log(error);
    }
  })

  app.post('/forgotpassword',async (req,res)=>{
    try {
      let clientInfo = await mongoClient.connect(dbURL);
      let db = clientInfo.db("Pizza_Users");
      let result = await db.collection("Customer").findOne({ email: req.body.email })

      if (result) {
        let random=(Math.random()*1e32).toString(36)

        let transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 587,
          secure: false, 
          auth: {
            user: process.env.MAIL_USERNAME, 
            pass: process.env.MAIL_PASSWORD, 
          },
        })
        let info = await transporter.sendMail({
          from: `Pizza Corner <${process.env.MAIL_USERNAME}>`, 
          to: `${req.body.email}`, 
          subject: "Password Reset", 
          text: "Reset your password", 
          html: `<b>Click below to reset your password</b><br> <a href='https://pizza-apps-frontend.netlify.app/ResetPassword/${random}'>Reset</a>`
        })
        await db.collection("Customer").updateOne({ email: req.body.email },{$set:{'randomstring':random}});
        res.status(200).json({message: `Thanks! Please check ${req.body.email} for a link to reset your password.`,icon:'success'});
        clientInfo.close()
      }
      else{
        res.status(400).json({message: "User doesn't exists",icon:'warning'});
      }
    }
    catch(err){
      console.log(err);
    }
  })

  app.post('/reset',async(req,res)=>{
    try {
      let clientInfo = await mongoClient.connect(dbURL);
      let db = clientInfo.db("Pizza_Users");
      let result = await db.collection("Customer").findOne({randomstring : req.body.randomstring})
      if(result){
        let salt = await bcrypt.genSalt(15);
        let password = await bcrypt.hash(req.body.password, salt);
        await db.collection("Customer").updateOne({
        randomstring: req.body.randomstring}, {$set: {
                    randomstring: '',
                    password: password
                }})
        res.status(200).json({message: "Password Changed successfully" ,icon :'success'});
        clientInfo.close();
      }else{
        res.status(410).json({message: "some error in page" ,icon :'error'});
      }
  }
  catch(err){
    console.log(err);
  }
  })

  app.post("/registeradmin", async (req, res) => {
    try {
      let clientInfo = await mongoClient.connect(dbURL);
      let db = clientInfo.db("Pizza_Users");
      let result = await db
        .collection("Admin")
        .findOne({ email: req.body.email });
      if (result) {
        res.status(400).json({ message: "User already registered" ,icon :'warning'});
      } else {
        let salt = await bcrypt.genSalt(15);
        let hash = await bcrypt.hash(req.body.password, salt);
        req.body.password = hash;

        let verifyString = (Math.random() * 1e32).toString(36)
        let transporter = nodemailer.createTransport({
                host: "smtp.gmail.com",
                port: 587,
                secure: false, 
                auth: {
                  user: process.env.MAIL_USERNAME, 
                  pass: process.env.MAIL_PASSWORD, 
                },
            });

        let info = await transporter.sendMail({
                from: `Pizza Corner <${process.env.MAIL_USERNAME}>`, 
                to: `${req.body.email}`, 
                subject: "Verification mail",
                text: "click to Verify your email and activate your account", 
                html: `<b>Click on the link to verify your email <a href="https://pizza-apps-frontend.netlify.app/Strings/${verifyString}"><button type='button'>Click here</button></a></b>`,
            });

        await db.collection("Admin").insertOne(req.body);
        await db.collection("Admin").updateOne({"email": req.body.email},
        {$set: {verifystring: verifyString}})
        res.status(200).json({ message: "Check your mail for activation link" ,icon :'success' });
        clientInfo.close();
      }
    } catch (error) {
      console.log(error);
    }
  })

  app.get('/adminconfirm/:verifyString', async (req, res) => {
    try {
        let clientInfo = await mongoClient.connect(dbURL)
        let db = clientInfo.db("Pizza_Users")
        let result = await db.collection("Admin").findOne({ verifystring: req.params.verifyString})
        if (result) {
                await db.collection("Admin").updateOne({
                    verifystring: req.params.verifyString
                }, {
                    $set: {
                        status: true,
                        verifystring: ''
                    }
                })
                res.send({message:'Your account is activated ,click below to Login',url:"https://pizza-apps-frontend.netlify.app/admin"})
                clientInfo.close()
        } else {
          res.send({message:"Link has expired"})
          clientInfo.close()
        }
    } catch (error) {
        console.log(error)
    }
})

  app.post("/adminlogin", async (req, res) => {
    try {
      let clientInfo = await mongoClient.connect(dbURL);
      let db = clientInfo.db("Pizza_Users");
      let result = await db
        .collection("Admin")
        .findOne({$and:[{ email: req.body.email },{status:true}]});
      if (result) {
        let isTrue = await bcrypt.compare(req.body.password, result.password);
        if (isTrue) {
          let token = jwt.sign({"username":result.username},process.env.TOKEN_PASS,{expiresIn:'1h'})
          res.status(200).json({ message: "Logged in successfully",result ,token,icon :'success'})
          clientInfo.close();
        } else {
          res.status(200).json({ message: "Incorrect Password" ,icon :'warning' });
        }
      } else {
        res.status(400).json({ message: "Please Enter Valid Credentials" ,icon :'warning' });
      }
    } catch (error) {
      console.log(error);
    }
  })

  app.post('/admin/forgotpassword',async (req,res)=>{
    try {
      let clientInfo = await mongoClient.connect(dbURL);
      let db = clientInfo.db("Pizza_Users");
      let result = await db.collection("Admin").findOne({ email: req.body.email })

      if (result) {
        let random=(Math.random()*1e32).toString(36)

        let transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 587,
          secure: false, 
          auth: {
            user: process.env.MAIL_USERNAME, 
            pass: process.env.MAIL_PASSWORD, 
          },
        })
        let info = await transporter.sendMail({
          from: `Pizza Corner <${process.env.MAIL_USERNAME}>`, 
          to: `${req.body.email}`, 
          subject: "Password Reset", 
          text: "Reset your password", 
          html: `<b>Click below to reset your password</b><br> <a href='https://pizza-apps-frontend.netlify.app/ResetPassword/admin/${random}'>Reset</a>`
        })
        await db.collection("Admin").updateOne({ email: req.body.email },{$set:{'randomstring':random}});
        res.status(200).json({message: `Thanks! Please check ${req.body.email} for a link to reset your password.`,icon:'success'});
        clientInfo.close()
      }
      else{
        res.status(400).json({message: "User doesn't exists",icon:'warning'});
      }
    }
    catch(err){
      console.log(err);
    }
  })

  app.post('/admin/reset',async(req,res)=>{
    try {
      let clientInfo = await mongoClient.connect(dbURL);
      let db = clientInfo.db("Pizza_Users");
      let result = await db.collection("Admin").findOne({randomstring : req.body.randomstring})
      if(result){
        let salt = await bcrypt.genSalt(15);
        let password = await bcrypt.hash(req.body.password, salt);
        await db.collection("Admin").updateOne({
        randomstring: req.body.randomstring}, {$set: {
                    randomstring: '',
                    password: password
                }})
        res.status(200).json({message: "Password Changed successfully" ,icon :'success'});
        clientInfo.close();
      }else{
        res.status(410).json({message: "some error in page" ,icon :'error'});
      }
  }
  catch(err){
    console.log(err);
  }
  })


app.get('/yourorders/:id', [auth],async (req, res) => {
  try {
      let clientInfo = await mongoClient.connect(dbURL)
      let db = clientInfo.db('Pizza_Users')
      let result = await db.collection('Customer').findOne({
          _id: objectId(req.params.id)
      })
      if (result) {
          res.status(200).json(result)
          clientInfo.close()
      } else {
        res.status(400).json({message: "No data found",icon:'warning'});
      }
  } catch (error) {
      console.log(error)
  }
})
app.post('/makeorder/:id',[auth],async (req,res)=>{
  try{
    let clientInfo = await mongoClient.connect(dbURL)
      let db = clientInfo.db('Pizza_Users')
      let result = await db.collection('Customer').findOne({
        _id: objectId(req.params.id)
    })
      if(result){
      await db.collection("Customer").updateOne({
        _id: objectId(req.params.id)},
        {$push:{orders:{orderid:newObjectId,orderitems:req.body}}})
      }
      res.status(200).json({message: "Added successfully" ,icon :'success'});
    }
    catch(error){
      console.log(error);
    }
})

app.put('/update/:id/:orderid?',async (req,res)=>{
  try{
    let clientInfo = await mongoClient.connect(dbURL)
      let db = clientInfo.db('Pizza_Users')
      let result = await db.collection('Customer').findOne({
        _id: objectId(req.params.id)
    })
    if(result){
      await db.collection("Customer").updateOne({
        _id: objectId(req.params.id)},
        {$pull:{orders:{orderid:objectId(req.params.orderid),orderitems:req.body}}},
      {multi:true})
      res.status(200).json({message: "Deleted successfully" ,icon :'success'});
}else{
  res.status(400).json({message: "Something went wrong",icon:'warning'});
}
}
catch(error){
  console.log(error);
}
})

app.get("/order", (req, res) => {
  try {
    const instance = new Razorpay({
      key_id: process.env.RAZOR_PAY_KEY_ID,
      key_secret: process.env.RAZOR_PAY_KEY_SECRET,
    });
    
    const options = {
      amount: 525 * 100, // amount == Rs 10
      currency: "INR",
      receipt: "receipt#1",
      payment_capture: 0,
 // 1 for automatic capture // 0 for manual capture
    };
  instance.orders.create(options, async function (err, order) {
    if (err) {
      return res.status(500).json({
        message: "Something Went Wrong",
      });
    }
  return res.status(200).json(order);
 });
} catch (err) {
  return res.status(500).json({
    message: "Something Went Wrong",
  });
 }
});

app.post("/capture/:paymentId", (req, res) => {
  try {
    return request(
     {
     method: "POST",
     url: `https://${process.env.RAZOR_PAY_KEY_ID}:${process.env.RAZOR_PAY_KEY_SECRET}@api.razorpay.com/v1/payments/${req.params.paymentId}/capture`,
     form: {
        amount: 525 * 100, // amount == Rs 10 // Same As Order amount
        currency: "INR",
      },
    },
   async function (err, response, body) {
     if (err) {
      return res.status(500).json({
         message: "Something Went Wrong",
       }); 
     }
      console.log("Status:", response.statusCode);
      console.log("Headers:", JSON.stringify(response.headers));
      console.log("Response:", body);
      return res.status(200).json(body);
    });
  } catch (err) {
    return res.status(500).json({
      message: "Something Went Wrong",
   });
  }
});

app.get('/orderpanel', async (req, res) => {
  try {
      let clientInfo = await mongoClient.connect(dbURL)
      let db = clientInfo.db('Pizza_Users')
      let array=[]
      let result = await db.collection('Customer').find().forEach(function(user) {user.orders.forEach((e)=>{array.push(e.orderitems)}) })
      if (array) {
        res.send(array)
        console.log(array);
        clientInfo.close()
      } else {
        res.status(400).json({message: "No data found",icon:'warning'});
      }
  } catch (error) {
      console.log(error)
  }
})


app.listen(port, () => console.log("your app runs with port:",port));