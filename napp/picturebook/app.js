const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const morgan = require("morgan");
const exphbs = require("express-handlebars");
const methodOverride = require("method-override");
const passport = require("passport");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const connectDB = require("./config/db");
const router = express.Router();
// Load config
dotenv.config({ path: "./config/config.env" });

// Passport config
require("./config/passport")(passport);

connectDB();

const app = express();

// Body parser
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Method override
app.use(
  methodOverride(function (req, res) {
    if (req.body && typeof req.body === "object" && "_method" in req.body) {
      // look in urlencoded POST bodies and delete it
      let method = req.body._method;
      delete req.body._method;
      return method;
    }
  })
);

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Handlebars Helpers
const {
  formatDate,
  stripTags,
  truncate,
  editIcon,
  select,
} = require("./helpers/hbs");

// Handlebars
const hbs = exphbs.create({
  helpers: {
    formatDate,
    stripTags,
    truncate,
    editIcon,
  },
  defaultLayout: "main",
  extname: ".hbs",
  runtimeOptions: {
    allowProtoPropertiesByDefault: true,
    allowProtoMethodsByDefault: true,
  },
});

app.engine(".hbs", hbs.engine);
app.set("view engine", ".hbs");

const viewsDir = path.join(__dirname, 'views');
app.set('views', viewsDir);

// Register the commentRecursive partial
hbs.handlebars.registerPartial('commentRecursive', '{{! Recursive partial to display comments }}\n{{#each this}}\n  <li>\n    <strong>{{this.by}}</strong> {{this.text}}\n    {{#if this.kids}}\n      <ul class="nested-comments">\n        {{> commentRecursive this.kids}}\n      </ul>\n    {{/if}}\n  </li>\n{{/each}}');
app.use(
  session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({mongoUrl: process.env.MONGO_URI,}),
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Set global var
app.use(function (req, res, next) {
  res.locals.user = req.user || null;
  next();
});

// Static folder
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use('/', require('./routes/index'))

app.use("/auth", require("./routes/auth"));

// Invoice parsing route (public, no auth required)
app.use('/public/invoice', require('./routes/invoice'));

const PORT = process.env.PORT || 3000;

app.listen(
  PORT,
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
);
