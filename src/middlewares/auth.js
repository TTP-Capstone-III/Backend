const jwt = require("jsonwebtoken"); //so we can use jwt.sign(), jwt.verify()
const { User } = require("../models");

const COOKIE_NAME = "session";
const ONE_WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

const isProduction = process.env.NODE_ENV === "production";

//Creates JWT
function createToken(userId) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required.");
  }

  //The first argument = custon payload
  //second = private sign in key
  //third = token settings
  return jwt.sign({}, process.env.JWT_SECRET, {
    subject: String(userId),
    expiresIn: "7d",
  });
}

//for logging in
//puts that JWT created above in an HTTP-only cookie
function setSession(response, userId) {
  const token = createToken(userId);

  //1st argument : cookie name = "session"
  //2nd argument : JWT token
  //3rd argument : object which controls how the browser stores and sends the cookies
  response.cookie(COOKIE_NAME, token, {
    httpOnly: true, //prevents FE JS from reading the cookie through document.cookie
    sameSite: isProduction ? "none" : "lax", //limits when the browser sends the cookie during requests originating from other websites.
    secure: isProduction,
    maxAge: ONE_WEEK_IN_MS,
    path: "/",
  });
}

//forlogging out//clear cookie
function clearSession(response) {
  response.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    path: "/",
  });
}

async function requireAuth(request, response, next) {
  const token = request.cookies?.[COOKIE_NAME]; //?. returns undefined instead of crashing if request.cookies is missing.

  if (!token) {
    return response.status(401).json({ error: "Authentication required" });
  }

  let payload;
  // jwt.verify() returns an object resembling called "payload":
  //   {
  //     sub: "5",
  //     iat: 1723000000,
  //     exp: 1723604800
  //   }
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
    //   It checks:
    //   - The JWT was signed with your secret.
    //   - The JWT was not changed.
    //   - The JWT has not expired.
  } catch {
    clearSession(response);

    return response.status(401).json({ error: "Invalid or expired session" });
  }

  let user;

  try {
    user = await User.findByPk(payload.sub, {
      attributes: {
        exclude: ["passwordHash"],
      },
    });
  } catch (error) {
    return next(error);
  }

  if (!user) {
    clearSession(response);

    return response.status(401).json({ error: "Authentication required" });
  }
  request.user = user;
  return next();
}

// Identify a logged-in user when possible, but allow public requests to continue.
async function optionalAuth(request, response, next) {
  const token = request.cookies?.[COOKIE_NAME];

  if (!token) {
    request.user = null;
    return next();
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    request.user = null; // invalid/expired token — treat as logged out, don't error
    return next();
  }

  try {
    const user = await User.findByPk(payload.sub, {
      attributes: { exclude: ["passwordHash"] },
    });
    request.user = user || null;
  } catch (error) {
    return next(error);
  }

  return next();
}

module.exports = {
  setSession,
  clearSession,
  requireAuth,
  optionalAuth,
};
