var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
  username: String,
  password: String,
}, { timestamps: false });

module.exports = mongoose.model('User', userSchema);