const argon2 = require("argon2");
const mongoose = require("mongoose");
const { v4 } = require("uuid");

var userSchema = new mongoose.Schema({
  _id: { type: String, default: () => v4() },
  username: String,
  email: String,
  notes: String,
  provider: { type: String, default: "E-Mail" },
  balance: Number,
  role: { type: String, default: "Kunde" },
  address: Object,
  supportid: { type: String, default: () => generateSupportID() },
  first_login: { type: Date, default: new Date() },
  last_login: { type: Date, default: new Date() },
  avatar: String,
  password: String,
  confirm_token: String,
  blocked: Boolean,
});

userSchema.pre('save', async function (next) {
  if(this.password)
    this.password = await argon2.hash(this.password);
  this.email = this.email;
  next();
});

userSchema.post('save', function (doc, next) {
  this.password = undefined;
  next();
});

userSchema.methods.verifyPassword = async function (password, callback) {
  callback(await argon2.verify(this.password, password));
}

const generateSupportID = () => {
  var supportID = "";
  for (var i = 8; i > 0; i--) {
    supportID += Math.floor(Math.random() * 10).toString();
    if(i == 5)
      supportID += "-";
  }
  return supportID;
};

module.exports = mongoose.model('User', userSchema);