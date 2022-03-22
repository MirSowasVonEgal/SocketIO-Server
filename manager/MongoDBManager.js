const mongoose = require('mongoose');
const TS3AudioBot = require('../models/TS3AudioBot');
const User = require('../models/User');
var connectedUser = new Map();
var TS3AUDIOBOTS = new Map();

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
    this.startUpdateStream();
  }

  setLoggedInUser(socket) {
    connectedUser.set(socket.id, { id: socket.user._id });
  }

  deleteConnectedUser(socket) {
    connectedUser.delete(socket.id);
  }

  getTS3AudioBots() {
    return TS3AUDIOBOTS;
  }

  startUpdateStream() {
    User.watch().on('change', data => {
      if(data.operationType == 'delete'
        || data.operationType == 'insert') return;
      connectedUser.forEach((user, id) => {
        var userID = data.documentKey._id.toString();
        if(user.id && user.id == userID) {
          const socket = this.io.sockets.sockets.get(id);
          if(data.operationType == 'replace') {
            var updated = data.fullDocument;
            delete updated.__v;
            delete updated.password;
            socket.user = updated;
          } else {
            var updated = socket.user;
            Object.entries(data.updateDescription.updatedFields).forEach(field => {
              updated[field[0]] = field[1];
            });
            socket.user = updated;
          }
          socket.emit("user:profile", { user: socket.user, authenticated: true});
        }
      })
    });
    TS3AudioBot.watch().on('change', async data => {
      if(data.operationType == 'delete'
        || data.operationType == 'insert') return;
        
      const ts3audiobots = await TS3AudioBot.find();
      connectedUser.forEach((user, id) => {
        if(user) {
          const temp = ts3audiobots.filter(o => o.owner == user.id);
          if(JSON.stringify(TS3AUDIOBOTS.get(user._id)) != JSON.stringify(temp)) {
            TS3AUDIOBOTS.set(user._id, temp);
            const socket = this.io.sockets.sockets.get(id);
            socket.emit("ts3audiobot:list", { ts3audiobots: temp });
          }
        }
      })
    });
  }
}
