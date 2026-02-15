import express from "express";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import pkg from "pg";
import dotenv from "dotenv";
import session from "express-session";
import passport from "passport";
import axios from "axios";
import { Strategy as LocalStrategy } from "passport-local";
import { fileURLToPath } from "url";
import path from "path";
import flash from "connect-flash"; 

dotenv.config();

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 10;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;



/* -------------------- MIDDLEWARE -------------------- */
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));


app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 }, // 2 seconds for testing
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());



app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));





// Initialize local variables for templates

app.use((req, res, next) => {
   res.locals.username = ""; 
   res.locals.email = ""; 
   res.locals.error = null; 
   // login 
   // 
   res.locals.passwordError = null;
    // registration specific 
    res.locals.usernameError = null; 
    res.locals.emailError = null; 
    res.locals.mailError = null; 
    res.locals.passError = null; 
    next(); 
});








/* -------------------- DATABASE -------------------- */
const db = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

db.connect()
  .then(() => console.log("✅ Connected to database"))
  .catch((err) => console.error("❌ DB Error", err));






/* --------------------   REGISTRATION -------------------- */

app.post("/register",  async (req, res) => {
  const { username, email, password } = req.body;

  try {

    // Check if username or email already exists
    const userResult = await db.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );
 
    // Username exists
    if (userResult.rows.length > 0) {
      return res.render("registration", {
        usernameError: "Username already exists",
        username,
        email
      });
    }


    // Email exists
    const emailResult = await db.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    // Email exists
    if (emailResult.rows.length > 0) {
      return res.render("registration", {
        emailError: "Email already exists",
        username,
        email
      });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await db.query(
      "INSERT INTO users (username, email, password) VALUES ($1,$2,$3)",
      [username, email, hashedPassword]
    );

    res.redirect("/login");

  } catch (err) {
    console.error(err);
    res.render("registration", {
      error: "Registration error",
      username: "",
      email: ""
    });
  }
});








/* -------------------- PASSPORT LOCAL STRATEGY -------------------- */
passport.use(
  new LocalStrategy(
    { usernameField: "email" },   // ⭐ VERY IMPORTANT
    async (email, password, done) => {
      try {
        const result = await db.query(
          "SELECT * FROM users WHERE email = $1",
          [email]
        );

        if (result.rows.length === 0) {
           return done(null, false, { message: "Email not found" });
        }

        const user = result.rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
          return done(null, false, { message: "Incorrect password" });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);


// Serialize and deserialize user
passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err);
  }
});








// serving login page
app.get("/login", (req, res) => {
  res.render("login", {
    mailError: null,
    passError: null
  });
});







// Handle login form
app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      if (info.message === "Email not found") {
        req.flash("mailError", info.message);
      } else {
        req.flash("passError", info.message);
      }
      return res.redirect("/login");
    }

    req.logIn(user, err => {
      if (err) return next(err);
      return res.redirect("/weather");
    });
  })(req, res, next);
});















/* -------------------- ROUTES -------------------- */

// Home → Login
app.get("/", (req, res) => {
  res.render("login");
});




// Register page
app.get("/register", (req, res) => {
  res.render("registration", { error: null });
});








// Weather API route

const cities = [
  { country: "UAE", city: "Abu Dhabi" },
  { country: "Saudi Arabia", city: "Riyadh" },
  { country: "Kuwait", city: "Kuwait City" },
  { country: "Qatar", city: "Doha" },
  { country: "Bahrain", city: "Manama" },
  { country: "Oman", city: "Muscat" }
];





function ensureAuth(req,res,next){
  if(req.isAuthenticated()) return next();
  res.status(401).json({error:"not logged in"});
}

app.get("/api/weather", ensureAuth, async (req,res)=>{

  try {
    const weatherData = [];

    for (let i = 0; i < cities.length; i++) {
      const response = await axios.get(
        "https://api.openweathermap.org/data/2.5/weather",
        {
          params: {
            q: cities[i].city,
            appid: WEATHER_API_KEY,
            units: "metric"
          }
        }
      );

      weatherData.push({
        
        temperature: response.data.main.temp,
        feelsLike: response.data.main.feels_like,
        humidity: response.data.main.humidity,
        windSpeed: response.data.wind.speed,
        condition: response.data.weather[0].description
      });
    }

    res.json(weatherData);
  } catch (err) {
    res.status(500).json({ error: "Weather fetch failed" });
  }
});









// Logout
app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/login");
  });
});



/* -------------------- MAIN WEATHER PAGE -------------------- */
app.get("/weather", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }

  res.render("weather");
});




















/* -------------------- SERVER -------------------- */
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
