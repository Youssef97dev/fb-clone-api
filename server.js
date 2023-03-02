const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const app = express();

// import readdirSync to read files
const { readdirSync } = require("fs");

// Environement Variable
const dotenv = require("dotenv");
dotenv.config();

app.use(express.json());
app.use(cors());
app.use(
  fileUpload({
    useTempFiles: true,
  })
);

// Dynamic way to use routes with readdirSync
readdirSync("./routes").map((r) => app.use("/", require("./routes/" + r)));

// Database
mongoose
  .connect(process.env.DATABASE_URL, {
    useNewUrlParser: true,
  })
  .then(() => console.log("database connected successfully"))
  .catch((err) => console.log("error connecting to mongodb", err));

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`server is lestning on port ${PORT}...`);
});
