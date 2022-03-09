
const mongoose = require('mongoose');
const { update } = require('../models/User');
const User = require('../models/User')
var connectedUser = new Map();
module.exports = class MongoDB {

  constructor(io){
    this.io = io;
    mongoose.connect(`mongodb://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_HOST}:${process.env.MONGODB_PORT}/${process.env.MONGODB_DATABASE}`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }, (error) => {
      if(error) { 
        throw error;
      } else {
        console.log("MongoDB connected")
      }
    });
  }

  updateConnectedUser() {
    this.io.on("connection", (socket) => {
      connectedUser.set(socket.id, { id: undefined });
      socket.on("disconnecting", () => {
        connectedUser.delete(socket.id);
      });
      socket.on("auth:login", (payload, callback) => 
        this.updateAuthStatus(socket, payload, callback));
    });
    this.startUpdateStream();
  }

  updateAuthStatus(socket, payload, callback) {
    if(!(payload.username && payload.password)) {
      callback({ message: "Es wurde kein Passwort oder kein Nutzer angegeben."})
    }
    User.findOne({username: new RegExp('^'+payload.username+'$', "i")}, (error, user) => {
      if(user == null) {
        callback({ message: "User wurde nicht gefunden." })
      } else if(user.password == payload.password) {
        callback({ message: "Du wurdest eingeloggt." });
        connectedUser.set(socket.id, { id: user.id, username: user.username });
      } else {
        callback({ message: "Das Passwort stimmt nicht mit dem Nutzer überein." })
      }
    });
  }

  startUpdateStream() {
    User.watch().on('change', data => {
      if(data.operationType == 'delete'
        || data.operationType == 'insert') return;
      connectedUser.forEach((user, id) => {
        var userID = data.documentKey._id.toString();
        if(user.id && user.id == userID) {
          if(data.operationType == 'replace') {
            var updated = data.fullDocument;
            delete updated._id;
            delete updated.__v;
            updated.id = userID; 
            connectedUser.set(id, updated)
          } else {
            var updated = connectedUser.get(id);
            Object.entries(data.updateDescription.updatedFields).forEach(field => {
              updated[field[0]] = field[1];
              connectedUser.set(id, updated)
            })
          }
          // TODO: Send User Updated Profile.
        }
      })
    });
    setTimeout(() => {
      User.findByIdAndUpdate("6227ce98f07c267aef4f83c6",  { $set:  { username: "Test7" } }, (error, document) => {
        console.log(error);
      });
    }, 3000)
  }
}
