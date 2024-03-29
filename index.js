const express = require('express')
const bodyParser = require('body-parser')
require("dotenv").config();
const mongodb = require("mongodb");
const cors = require("cors");
const bcrypt = require("bcrypt");
var jwt = require('jsonwebtoken');
const nodemailer = require("nodemailer")
const auth = require('./middleware/token')
const Razorpay = require('razorpay');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const mongoClient = mongodb.MongoClient;
const objectId = mongodb.ObjectID
const newObjectId = mongodb.ObjectID()

const dbURL = process.env.DB_URL ||"mongodb://127.0.0.1:27017";
const port = process.env.PORT || 4000

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


app.get('/orders/:id', [auth],async (req, res) => {
  try {
      let clientInfo = await mongoClient.connect(dbURL)
      let db = clientInfo.db('Pizza_Users')
      let result = await db.collection('Customer').findOne({
          _id: objectId(req.params.id)
      })
      if (result) {
          res.status(200).json({orders:result.orders, status:200})
          clientInfo.close()
      } else {
        res.status(400).json({message: "No data found",icon:'warning'});
      }
  } catch (error) {
      console.log(error)
  }
})

app.post('/orders/:id',[auth],async (req,res)=>{
  try{
    let clientInfo = await mongoClient.connect(dbURL)
      let db = clientInfo.db('Pizza_Users')
      let result = await db.collection('Customer').findOne({
        _id: objectId(req.params.id)
    })
      if(result){
      await db.collection("Customer").updateOne({
        _id: objectId(req.params.id)},
        {$push:{orders:{orderid:newObjectId,...req.body}}})
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



const instance = new Razorpay({
  key_id: process.env.RAZOR_PAY_KEY_ID,
  key_secret: process.env.RAZOR_PAY_KEY_SECRET,
})


app.get("/capture/:paymentId/:amount", (req, res) => {
  const { payment_id, amount } = req.params;
	instance.payments.capture(payment_id, amount).then((data) => {
		res.json(data);
	}).catch((error) => {
		res.json(error);
	});
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