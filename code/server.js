const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const User = require("./model/user.js");
const Message = require("./model/message.js");
require("dotenv").config();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const dbURI = process.env.dbURI;
mongoose
  .connect(dbURI)
  .then((result) => {
    console.log("Connected to db-1");
    app.listen(3000, () => console.log("listening on port 3000"));
  })
  .catch((err) => console.log(err));

let signupMessage = String("");
let loginMessage = String("");

app.get("/", (req, res) => {
  res.render("login", { loginMessage });
});

app.post("/", async (req, res) => {
  let verification = false;
  const user = await User.findOne({ Email: req.body.Email });
  if (user !== null)
    verification = await bcrypt.compare(req.body.Password, user.Password);
  if (verification) {
    loginMessage = "";
    const token = createToken(user.Email);
    res.cookie("jwt", token, {
      httpOnly: true,
      maxAge: 60 * 60 * 1000,
      sameSite: "strict",
    });
    res.redirect("/chatroom");
  } else {
    loginMessage = "Can't Login - Check Your Email And Password !";
    res.redirect("/");
  }
});

app.get("/signup", (req, res) => {
  res.render("signup", { signupMessage });
});

app.post("/signup", async (req, res) => {
  req.body.Password = await hash(req.body.Password);
  console.log(req.body);
  const user = new User(req.body);
  user
    .save()
    .then(() => {
      console.log("user stored in db-1");
      signupMessage = "Account Successfully Created";
      res.redirect("/signup");
    })
    .catch((error) => {
      console.error(`Error Code - ${error.code}`);
      if (error.code == 11000) {
        signupMessage = "The Email Used Already Exists !";
        res.redirect("/signup");
      }
    });
});

app.get("/chatroom", userAuth, async (req, res) => {
  const all = await Message.find({});
  res.render("chatroom", { all });
});

app.post("/chatroom", userAuth, async (req, res) => {
  await Message.create({
    text: req.body.Snippet,
    email: jwt.decode(req.cookies.jwt).Email,
  });
  res.redirect("/chatroom");
});

app.get("/logout", (req, res) => {
  res.cookie("jwt", "", { maxAge: 1 });
  console.log("user logged out");
  res.redirect("/");
});

async function hash(password) {
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  } catch (error) {
    console.log(error);
  }
}

function createToken(Email) {
  return jwt.sign({ Email }, process.env.jwtSECRET, {
    expiresIn: 60 * 60,
  });
}

function userAuth(req, res, next) {
  const token = req.cookies.jwt;
  if (token) {
    jwt.verify(token, process.env.jwtSECRET, (err, decodedToken) => {
      if (err) {
        console.log(err.message);
        res.redirect("/");
      } else {
        console.log("User Verified");
        next();
      }
    });
  } else {
    res.redirect("/");
  }
}
