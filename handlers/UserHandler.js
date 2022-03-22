
const Token = require('../models/Token');
const User = require('../models/User')
module.exports = (io, socket, mongodbManager) => {

  const loginUser = async (payload, callback) => {
    if(!(payload.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))) 
      return callback({ error: true, message: "Diese E-Mail ist nicht gültig!" });
    if(!(payload.password && payload.password.length >= 8)) 
      return callback({ error: true, message: "Das Passwort muss mindestens 8 Zeichen haben!" });
    
    const user = await User.findOne({ "email" : { $regex : new RegExp(`^${payload.email}$`, 'i') } }).select('+password').exec();

    if(!user)
      return callback({ error: true, message: "Dieser Account wurde nicht gefunden!" })

    if(user.provider != 'E-Mail')
      return callback({ error: true, message: "Du hast dich mit " + user.provider + " registriert!"});

    user.verifyPassword(payload.password, async result => {
      user.password = undefined;
      user.__v = undefined;
      if(!result)
        return callback({ error: true, message: "Das angegebene Passwort stimmt nicht!" });
      
      if(user.blocked)
        callback({ error: true, message: "Dein Account wurde gesperrt! Melde dich im Support um weitere Informationen zu bekommen.", type: 'blocked' });
      
      socket.user = user;

      User.findByIdAndUpdate(user._id, { last_login: new Date() }).then(() => {
        setTimeout(() => {
          mongodbManager.setLoggedInUser(socket)
        }, 100);
      });

      const token = await new Token({ 
        userid: user._id, 
        ip: socket.request.connection.remoteAddress, 
        user_agent: socket.request.headers['user-agent'], 
        remember_me: payload.remember_me 
      }).save();

      return callback({ error: false, message: "Du hast dich erfolgreich angemeldet!", user, authenticated: true, token: token.token });
    });
  }

  const registerUser = async (payload, callback) => {
    if(!(payload.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))) 
      return callback({ error: true, message: "Diese E-Mail ist nicht gültig!" });
    if(!(payload.password && payload.password.length >= 8)) 
      return callback({ error: true, message: "Das Passwort muss mindestens 8 Zeichen haben!" });
    if(!(payload.username && payload.username.length >= 4 && payload.username.length <= 16)) 
      return callback({ error: true, message: "Dein Nutzernamen muss mindestens 4 Zeichen und maximal 16 Zeichen haben!" });
    const check_user = await User.findOne({$or: [{ "email" : { $regex : new RegExp(`^${payload.email}$`, 'i') } }, 
      { "username" : { $regex : new RegExp(`^${payload.username}$`, 'i') } }]}).exec();
    
    if(check_user)
      return callback({ error: true, message: "Es gibt bereit einen Account mit der E-Mail oder dem Nutzernamen!" });

    const user = await new User(payload).save();

    socket.user = user;
      
    const token = await new Token({ 
      userid: user._id, 
      ip: socket.request.connection.remoteAddress, 
      user_agent: socket.request.headers['user-agent'], 
      remember_me: false
    }).save();
    
    return callback({ error: false, message: "Du hast dich erfolgreich registriert.", user, authenticated: true, token: token.token });
  }

  socket.on("auth:login", loginUser);
  socket.on("auth:register", registerUser);
}