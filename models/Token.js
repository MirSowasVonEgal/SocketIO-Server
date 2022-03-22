var mongoose = require('mongoose');
const { v4 } = require("uuid");
var fs = require('fs');
var jwt = require('jsonwebtoken');
const ec_private = fs.readFileSync("./assets/jwt/private.ec.key").toString();
const ec_public = fs.readFileSync("./assets/jwt/public.ec.pem").toString();

var tokenSchema = new mongoose.Schema({
  _id: { type: String, default: () => v4() },
  userid: String,
  ip: String,
  remember_me: Boolean,
  token: String,
  password: String,
  user_agent: String,
  expires: {
     type: Date,
     default: new Date(Date.now() + 12 * 60 * 60 * 1000),
   },
});

tokenSchema.methods.verifyToken = function (callback) {
  jwt.verify(this.token, ec_public, { algorithm: 'ES256' }, (error, decoded) => { 
    callback(error, decoded); 
  });
}

tokenSchema.pre('save', function (next) {
  const payload = {
    id: this._id,
    userid: this.userid,
    ip: this.ip,
    method: 'access'
  }

  var expiresIn = '12h';
  if(this.remember_me) {
    expiresIn = '7d'
    this.expires = 7 * 24 * 60 * 60 * 1000; // 7 Days
  }

  this.token = jwt.sign(payload, ec_private, { algorithm: 'ES256', expiresIn });

  next();
});

module.exports = mongoose.model('Token', tokenSchema);