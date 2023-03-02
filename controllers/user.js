const {
  validateEmail,
  validateLength,
  validateUsername,
} = require("../helpers/validation");
const User = require("../models/User");
const Code = require("../models/Code");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { generateToken } = require("../helpers/tokens");
const { sendVerificationEmail, sendResetCode } = require("../helpers/mailer");
const { generateCode } = require("../helpers/generateCode");

exports.register = async (req, res) => {
  try {
    // Distruct data from request body
    const {
      first_name,
      last_name,
      username,
      email,
      password,
      bYear,
      bMonth,
      bDay,
      gender,
    } = req.body;

    // Check uf email is valid
    if (!validateEmail(email)) {
      return res.status(400).json({
        message: "Invalid email adress",
      });
    }

    // Check if email is not exists
    const check = await User.findOne({ email });
    if (check) {
      return res.status(400).json({
        message: "This email already exists, try another one !",
      });
    }

    // Check if firstname length is valid
    if (!validateLength(first_name, 3, 30)) {
      return res.status(400).json({
        message: "firstname must be between 3 and 30 characters !",
      });
    }

    // Check if lastname length is valid
    if (!validateLength(last_name, 3, 30)) {
      return res.status(400).json({
        message: "lastname must be between 3 and 30 characters !",
      });
    }

    // Check if password length is valid
    if (!validateLength(password, 6, 40)) {
      return res.status(400).json({
        message: "password must be between 3 and 40 characters !",
      });
    }

    const cryptedPassword = await bcrypt.hash(password, 12);
    console.log(cryptedPassword);

    // create and validate username
    let tempUsername = first_name + last_name;
    const newUsername = await validateUsername(tempUsername);

    // insert data into model and save it to database
    const user = await new User({
      first_name,
      last_name,
      username: newUsername,
      email,
      password: cryptedPassword,
      bYear,
      bMonth,
      bDay,
      gender,
    }).save();

    const emailVerificationToken = generateToken(
      { id: user._id.toString() },
      "30m"
    );

    const url = `${process.env.BASE_URL}/activate/${emailVerificationToken}`;
    sendVerificationEmail(user.email, user.first_name, url);

    // tOKEN for registred
    const token = generateToken({ id: user._id.toString() }, "7d");

    res.send({
      id: user._id,
      username: user.username,
      picture: user.picture,
      first_name: user.first_name,
      last_name: user.last_name,
      token: token,
      verified: user.verified,
      message: "Register Success ! please activate your email to start",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.activateAccount = async (req, res) => {
  try {
    const validUser = req.user.id;
    const { token } = req.body;
    const user = jwt.verify(token, process.env.TOKEN_SECRET);
    const check = await User.findById(user.id);
    if (validUser !== user.id) {
      return res.status(400).json({
        message: "You don't have the authorization to complete this operation.",
      });
    }
    if (check.verified) {
      return res
        .status(400)
        .json({ message: "this email is already activated !" });
    } else {
      await User.findByIdAndUpdate(user.id, { verified: true });
      return res
        .status(200)
        .json({ message: "Account has been activated successfuly" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        message: "The email adress you entered is not connected to an account.",
      });
    }
    const check = await bcrypt.compare(password, user.password);
    if (!check) {
      return res.status(400).json({
        message: "Invalid credentials.Please try again.",
      });
    }
    // tOKEN for login
    const token = generateToken({ id: user._id.toString() }, "7d");

    res.send({
      id: user._id,
      username: user.username,
      picture: user.picture,
      first_name: user.first_name,
      last_name: user.last_name,
      token: token,
      verified: user.verified,
      message: "Login Success !",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.sendVerification = async (req, res) => {
  try {
    const id = req.user.id;
    const user = await User.findById(id);
    if (user.verified) {
      return res.status(400).json({
        message: "This Account is already activated.",
      });
    }
    const emailVerificationToken = generateToken(
      { id: user._id.toString() },
      "30m"
    );
    const url = `${process.env.BASE_URL}/activate/${emailVerificationToken}`;
    sendVerificationEmail(user.email, user.first_name, url);
    return res.status(200).json({
      message: "Email verification link has been sent to your email.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.findUser = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email }).select("-password");
    if (!user) {
      return res.status(400).json({
        message: "Account does not exists.",
      });
    }
    return res.status(200).json({
      email: user.email,
      picture: user.picture,
      username: user.username,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

exports.sendResetPasswordCode = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email }).select("-password");

    await Code.findOneAndRemove({ user: user._id });
    const code = generateCode(5);
    const savedCode = await new Code({
      code,
      user: user._id,
    }).save();
    sendResetCode(user.email, user.first_name, code);
    return res.status(200).json({
      message: "Emil reset code has been sent to your email",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

exports.validateResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });
    const Dbcode = await Code.findOne({ user: user._id });
    if (Dbcode.code !== code) {
      return res.status(400).json({
        message: "Verification Code is Wrong.",
      });
    }
    return res.status(200).json({ message: "OK!" });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    const cryptedPassword = await bcrypt.hash(password, 12);
    await User.findOneAndUpdate({ email }, { password: cryptedPassword });
    return res.status(200).json({ message: "OK!" });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
