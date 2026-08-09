const express = require("express"); //For Router()
const bcrypt = require("bcrypt"); //For ; bcrypt.hash()--during signup  ,  bcrypt.compare()--during login

const { User } = require("../models"); // Signup needs User.create()  ,  Login needs User.findOne()
const {
  setSession, //  setSession   → signup and login
  clearSession, //  clearSession → logout
  requireAuth, //  requireAuth  → current-user route
} = require("../middlewares/auth");

const router = express.Router();

//signup route
router.post("/signup", async (req, res, next) => {
  const { name, email, password } = req.body; //req.body.name , req.body.email , req.body.password

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: "Name, email, and password are required" });
  }

  if (typeof password !== "string" || password.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must contain at least 8 characters" });
  }

  if (typeof name !== "string" || typeof email !== "string") {
    return res.status(400).json({ error: "Name and Email must be text" });
  }

  const cleanedName = name.trim(); //removes whitespaces
  const normalizedEmail = email.trim().toLowerCase(); //removes whitespaces and converts to lowercase

  if (!cleanedName || !normalizedEmail) {
    return res.status(400).json({ error: "Name and Email cannot be empty" });
  }

  try {
    const existingUser = await User.findOne({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      return res.status(409).json({ error: "Email is already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12); //bcrypt.hash() transforms the password into a value resembling
    //arguments=1.Password recieve from request.body , 2.bcrypt cost factor

    const user = await User.create({
      name: cleanedName,
      email: normalizedEmail,
      passwordHash,
    });

    setSession(res, user.id);

    return res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    });
  } catch (error) {
    return next(error);
  }
});

//login rout
router.post("/login", async (req, res, next) => {
  const { email, password } = req.body;

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email and Password must be text" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return res
      .status(400)
      .json({ error: "Email and Password cannot be empty" });
  }

  try {
    const user = await User.findOne({
      where: {
        email: normalizedEmail,
      },
    });

    let passwordMatches = false;

    if (user) {
      passwordMatches = await bcrypt.compare(password, user.passwordHash); //first argument : submitted plain password     Second argument : stored password hash
    }

    if (!passwordMatches) {
      return res.status(401).json({ error: "Email or Password is incorrect" });
    }

    setSession(res, user.id);

    return res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    });
  } catch (error) {
    return next(error);
  }
});

//Current user route
router.get("/me", requireAuth, (req, res) => {
  return res.status(200).json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    createdAt: req.user.createdAt,
  });
});

//logout route
router.post("/logout", (_req, res) => {
  clearSession(res); //clear cookies

  return res.status(200).json({ message: "Logged out" });
});

module.exports = router;
