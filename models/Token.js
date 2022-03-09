var mongoose = require('mongoose');

var tokenSchema = new mongoose.Schema({
  token: String,
  password: String,
  expires: {
     type: Date,
     default: new Date(Date.now() + 1000*3600),
   },
})

module.exports = mongoose.model('Token', tokenSchema);