var mongoose = require('mongoose');
const { v4 } = require("uuid");

var ts3AudioBotSchema = new mongoose.Schema({
  _id: { type: String, default: () => v4() },
  owner: String,
  display_name: String,
  status: { type: Number, default: 0 },
});

module.exports = mongoose.model('TS3AudioBot', ts3AudioBotSchema);