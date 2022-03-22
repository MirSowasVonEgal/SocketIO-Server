
const Token = require('../models/Token');
const User = require('../models/User')
module.exports = (io, mongodbManager) => {
  io.use(async (socket, next) => {
    if(!socket.handshake.auth.token) return next();
    const token = socket.handshake.auth.token;

    const db_token = await Token.findOne({ token }).exec(); 
    if(!db_token) return next();

    db_token.verifyToken(async (error, decoded) => {
      if(error || decoded.method != "access") return next();
  
      const user = await User.findById(db_token.userid).exec();

      if(!user) return next();
      
      user.password = undefined;
      user.__v = undefined;
  
      socket.emit('user:profile', { user, authenticated: true });
  
      socket.user = user;
  
      mongodbManager.setLoggedInUser(socket);
  
      return next();
    });
  });
}