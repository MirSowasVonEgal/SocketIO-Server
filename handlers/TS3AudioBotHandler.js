
const axios = require('axios');
const cluster = require('cluster');
const TS3AudioBot = require('../models/TS3AudioBot');

var TS3AUDIOBOTS_LIST = [];

const api = axios.create({
  baseURL: process.env.TS3AUDIOBOT_HOST + '/',
  headers: {
    Authorization : 'Basic ' + Buffer.from(process.env.TS3AUDIOBOT_TOKEN).toString('base64')
  }
});


module.exports = (io, socket) => {
  if(cluster.worker.id == 1) {
    const request = async () => {
      if((await io.fetchSockets()).length != 0) {
        const { data } = await api.get('bot/list');
        if(JSON.stringify(TS3AUDIOBOTS_LIST) != JSON.stringify(data)) {
          TS3AUDIOBOTS_LIST = data;
          updateDatabase();
        }
        process.send({ type: 'broadcast', use: 'ts3audiobot', value: data });
        setTimeout(() => request(), 1000)
      }
    };
    request();
  }

  const updateDatabase = async () => {
    for (let i = 0; i < 3; i++) {
      const onlineBots = TS3AUDIOBOTS_LIST.filter(bot => bot.Status == i);
      var onlineBotIDs = [];
      onlineBots.forEach(bot => {
        if(bot.Name) {
          onlineBotIDs.push(bot.Name.replace('Bot-', ''));
        }
      });
      TS3AudioBot.updateMany({_id: {$in: onlineBotIDs } }, { $set: { status: i } }).exec();
    }
  }

  if(!socket) return;

  const createTS3AudioBot = async (payload, callback) => {
    if(!socket.user) return;
    if(!(payload.display_name && payload.display_name.length >= 4 && payload.display_name.length <= 16))
      return callback({ error: true, message: "Du musst dem Bot einen Anzeigenamen geben, der mindestens 4 und maximal 16 Zeichen hat!" });

    const ts3audiobot = await new TS3AudioBot({
      owner: socket.user._id,
      display_name: payload.display_name,
    }).save();

    try {
      await api.get('settings/create/Bot-' + ts3audiobot._id);
      callback({ error: false, message: "Der Bot wurde erfolgreich erstellt.", ts3audiobot });
      if(payload.name) {
        await updateTS3AudioBot({ _id: ts3audiobot._id, path: 'connect.name', value: payload.name }, () => {});
      }
      if(payload.address) {
        await updateTS3AudioBot({ _id: ts3audiobot._id, path: 'connect.address', value: payload.address }, () => {});
      }
      if(payload.name && payload.address) {
        startTS3AudioBot({ _id: ts3audiobot._id }, () => {});
      }
      return;
    } catch (err) {
      return callback({ error: true, message: "Es ist ein Fehler aufgetreten." });
    }
  }
  
  const deleteTS3AudioBot = async (payload, callback) => {
    if(!socket.user) return;
    if(!payload._id)
      return callback({ error: true, message: "Der Bot wurde nicht gefunden! "});

    const ts3audiobot = await TS3AudioBot.findById(payload._id);

    if(!ts3audiobot || ts3audiobot.owner != socket.user._id)
      return callback({ error: true, message: "Der Bot wurde nicht gefunden! "});

    try {
      await stopTS3AudioBot(payload, (output) => console.log(output));
      await api.get('settings/delete/Bot-' + payload._id);
      await TS3AudioBot.findByIdAndDelete(payload._id);
      callback({ error: false, message: "Der Bot wurde erfolgreich gelöscht." });
    } catch (err) {
      console.log(err);
      return callback({ error: true, message: "Es ist ein Fehler aufgetreten." });
    }
  }

  const getTS3AudioBot = async (payload, callback) => {
    if(!socket.user) return;
    if(!payload._id)
      return callback({ error: true, message: "Der Bot wurde nicht gefunden! "});

    const ts3audiobot = await TS3AudioBot.findById(payload._id);
  
    if(!ts3audiobot || ts3audiobot.owner != socket.user._id)
      return callback({ error: true, message: "Der Bot wurde nicht gefunden! "});
    
    try {
      const { data } = await api.get('settings/bot/get/Bot-' + ts3audiobot._id);
      callback({ error: false, config: data });
    } catch (err) {
      return callback({ error: true, message: "Es ist ein Fehler aufgetreten." });
    }
  }

  const updateTS3AudioBot = async (payload, callback) => {
    if(!socket.user) return;
    if(!payload._id)
      return callback({ error: true, message: "Der Bot wurde nicht gefunden! "});

    if(!payload.path || !payload.value)
      return callback({ error: true, message: "Diese Funktion wurde nicht gefunden! "});

    const ts3audiobot = await TS3AudioBot.findById(payload._id);

    if(!ts3audiobot || ts3audiobot.owner != socket.user._id)
      return callback({ error: true, message: "Der Bot wurde nicht gefunden! "});


    try {
      await api.get('settings/bot/set/Bot-' + ts3audiobot._id + '/' + payload.path + '/' + payload.value);
      callback({ error: false, message: "Der Bot wurde erfolgreich aktualisiert." });
      if(payload.path == 'connect.name') {
        const info = (await api.get('bot/info/template/Bot-' + ts3audiobot._id)).data;
        if(!info.Id)
          return;
        await api.get('bot/use/' + info.Id + '/(/bot/name/' + payload.value + ')');
      } else if(payload.path == 'audio.volume.default') {
        const info = (await api.get('bot/info/template/Bot-' + ts3audiobot._id)).data;
        if(!info.Id)
          return;
        await api.get('bot/use/' + info.Id + '/(/volume/' + payload.value + ')');
      }
      return;
    } catch (err) {
      return callback({ error: true, message: "Es ist ein Fehler aufgetreten." });
    }
  }

  const startTS3AudioBot = async (payload, callback) => {
    if(!socket.user) return;
    if(!payload._id)
      return callback({ error: true, message: "Der Bot wurde nicht gefunden! "});

    const ts3audiobot = await TS3AudioBot.findById(payload._id);

    if(!ts3audiobot || ts3audiobot.owner != socket.user._id)
      return callback({ error: true, message: "Der Bot wurde nicht gefunden! "});

    try {
      await api.get('bot/connect/template/Bot-' + ts3audiobot._id);
      return callback({ error: false, message: "Der Bot wurde erfolgreich gestartet." });
    } catch (err) {
      return callback({ error: true, message: "Es ist ein Fehler aufgetreten." });
    }
  }

  const stopTS3AudioBot = async (payload, callback) => {
    if(!socket.user) return;
    if(!payload._id)
      return callback({ error: true, message: "Der Bot wurde nicht gefunden! "});

    const ts3audiobot = await TS3AudioBot.findById(payload._id);

    if(!ts3audiobot || ts3audiobot.owner != socket.user._id)
      return callback({ error: true, message: "Der Bot wurde nicht gefunden! "});

    try {
      const info = (await api.get('bot/info/template/Bot-' + ts3audiobot._id)).data;
      callback({ error: false, message: "Der Bot wurde erfolgreich gestoppt." });
      if(!info.Id)
        return;
      await api.get('bot/use/' + info.Id + '/(/bot/disconnect/)');
      return;
    } catch (err) {
      return callback({ error: true, message: "Es ist ein Fehler aufgetreten." });
    }
  }
  
  const playTS3AudioBot = async (payload, callback) => {
    if(!socket.user) return;
    if(!payload.song) return;
    if(!payload._id)
      return callback({ error: true, message: "Der Bot wurde nicht gefunden! "});
      

    const ts3audiobot = await TS3AudioBot.findById(payload._id);

    if(!ts3audiobot || ts3audiobot.owner != socket.user._id)
      return callback({ error: true, message: "Der Bot wurde nicht gefunden! "});

    try {
      const info = (await api.get('bot/info/template/Bot-' + ts3audiobot._id)).data;
      callback({ error: false, message: "Die Musik wird nun abgespielt." });
      await api.get('bot/use/' + info.Id + '/(/play/' + encodeURIComponent(payload.song) + '/)');
      return;
    } catch (err) {
      return callback({ error: true, message: "Es ist ein Fehler aufgetreten." });
    }
  }

  TS3AudioBot.find({ owner: socket.user._id }).then(ts3audiobots => socket.emit("ts3audiobot:list", { ts3audiobots }));

  socket.on("ts3audiobot:create", createTS3AudioBot);
  socket.on("ts3audiobot:delete", deleteTS3AudioBot);
  socket.on("ts3audiobot:get", getTS3AudioBot);
  socket.on("ts3audiobot:play", playTS3AudioBot);
  socket.on("ts3audiobot:update", updateTS3AudioBot);
  socket.on("ts3audiobot:start", startTS3AudioBot);
  socket.on("ts3audiobot:stop", stopTS3AudioBot);
}