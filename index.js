require('dotenv').config();
const cluster = require("cluster");
const http = require("http");
const { Server } = require("socket.io");
const numCPUs = require("os").cpus().length;
const { setupMaster, setupWorker } = require("@socket.io/sticky");
const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");
const MongoDBManager = require("./manager/MongoDBManager");

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  const httpServer = http.createServer();

  // setup sticky sessions
  setupMaster(httpServer, {
    loadBalancingMethod: "least-connection",
  });

  // setup connections between the workers
  setupPrimary();

  cluster.setupMaster({
    serialization: "advanced",
  });

  httpServer.listen(3000);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });

  cluster.on('fork', (worker) => {
    worker.on('message', (data) => {
      if(data.type && data.type == 'broadcast') {
        Object.keys(cluster.workers).forEach(id => {
          cluster.workers[id].send(data);
        });
      }
    });
  });

} else {
  console.log(`Worker ${process.pid} started`);

  const httpServer = http.createServer();
  const io = new Server(httpServer);

  // use the cluster adapter
  io.adapter(createAdapter());

  // setup connection with the primary process
  setupWorker(io);

  const userHandler = require("./handlers/UserHandler");
  const ts3AudioBotHandler = require("./handlers/TS3AudioBotHandler");
  const connectionHandler = require("./handlers/ConnectionHandler");

  const mongodbManager = new MongoDBManager(io);
  
  connectionHandler(io, mongodbManager);
  ts3AudioBotHandler(io, null);

  const onConnection = (socket) => {
    if(!socket.user) 
      socket.emit('user:profile', { authenticated: false });

    userHandler(io, socket, mongodbManager);
    ts3AudioBotHandler(io, socket);

    socket.on('disconnect', () => {
      mongodbManager.deleteConnectedUser(socket);
    });
  }

  io.on("connection", onConnection);
}