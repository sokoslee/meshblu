var config = require('./config');
var restify = require('restify');
var socketio = require('socket.io');

var server = restify.createServer();
var io = socketio.listen(server);

server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());

io.sockets.on('connection', function (socket) {

  console.log('Websocket connection detected. Requesting identification from socket id: ' + socket.id.toString());
  require('./lib/logEvent')(100, {"socketId": socket.id.toString(), "protocol": "websocket"});
  
  socket.emit('identify', { socketid: socket.id.toString() });
  socket.on('identity', function (data) {
    data["socketid"] = socket.id.toString();
    console.log('Identity received: ' + JSON.stringify(data));
    require('./lib/logEvent')(101, data);
    require('./lib/updateSocketId')(data, function(auth){
      // socket.emit('authentication', { status: auth.status });
      // Have device join its uuid room name so that others can subscribe to it
      if (auth.status == 201){
        socket.emit('ready', { status: auth.status });
        console.log('subscribe: ' + data.uuid);
        socket.join(data.uuid);
      } else {
        socket.emit('notReady', { status: auth.status });
      }
    });
  });

  socket.on('disconnect', function (data) {
    console.log('Presence offline for socket id: ' + socket.id.toString());
    require('./lib/logEvent')(102, data);
    require('./lib/updatePresence')(socket.id.toString());
    // Emit API request from device to room for subscribers
    require('./lib/getUuid')(socket.id.toString(), function(uuid){
      socket.broadcast.to(uuid.uuid).emit('message', {"api": "disconnect"});
    });      

  });

  socket.on('subscribe', function(room) { 
      console.log('joining room ', room);
      socket.join(room); 
      // Emit API request from device to room for subscribers
      require('./lib/getUuid')(socket.id.toString(), function(uuid){
        socket.broadcast.to(uuid.uuid).emit('message', {"api": "subscribe"});
      });      
  })  

  socket.on('unsubscribe', function(room) { 
      console.log('leaving room ', room);
      socket.leave(room); 
      // Emit API request from device to room for subscribers
      require('./lib/getUuid')(socket.id.toString(), function(uuid){
        socket.broadcast.to(uuid.uuid).emit('message', {"api": "unsubscribe"});
      });      
  })  

  // APIs
  socket.on('status', function (fn) {

    // Emit API request from device to room for subscribers
    require('./lib/getUuid')(socket.id.toString(), function(uuid){
      socket.broadcast.to(uuid.uuid).emit('message', {"api": "status"});

      require('./lib/getSystemStatus')(function(results){
        console.log(results);
        try{
          fn(results);
          
          // Emit API request from device to room for subscribers
          socket.broadcast.to(uuid.uuid).emit('message', results);

        } catch (e){
          console.log(e);
        }
      });

    });

  });

  socket.on('devices', function (data, fn) {
    if(data == undefined){
      var data = {};
    }
    // Emit API request from device to room for subscribers
    require('./lib/getUuid')(socket.id.toString(), function(uuid){
      var reqData = data;
      reqData["api"] = "devices";      
      socket.broadcast.to(uuid.uuid).emit('message', reqData);

      require('./lib/getDevices')(data, function(results){
        console.log(results);
        try{
          fn(results);

          // Emit API request from device to room for subscribers
          socket.broadcast.to(uuid.uuid).emit('message', results);

        } catch (e){
          console.log(e);
        }
      });
    });
  });

  socket.on('whoami', function (data, fn) {
    if(data == undefined){
      var data = "";
    } else {
      data = data.uuid
    }
    // Emit API request from device to room for subscribers
    require('./lib/getUuid')(socket.id.toString(), function(uuid){
      var reqData = data;
      reqData["api"] = "whoami";      
      socket.broadcast.to(uuid.uuid).emit('message', reqData);

      require('./lib/whoami')(data, function(results){
        console.log(results);
        try{
          fn(results);

          // Emit API request from device to room for subscribers
          socket.broadcast.to(uuid.uuid).emit('message', results);

        } catch (e){
          console.log(e);
        }
      });
    });
  });

  socket.on('register', function (data, fn) {
    if(data == undefined){
      var data = {};
    }
    // Emit API request from device to room for subscribers
    require('./lib/getUuid')(socket.id.toString(), function(uuid){
      var reqData = data;
      reqData["api"] = "register";      
      socket.broadcast.to(uuid.uuid).emit('message', reqData);

      require('./lib/register')(data, function(results){
        console.log(results);
        try{
          fn(results);

          // Emit API request from device to room for subscribers
          socket.broadcast.to(uuid.uuid).emit('message', results);

        } catch (e){
          console.log(e);
        }
      });
    });
  });

  socket.on('update', function (data, fn) {
    if(data == undefined){
      var data = {};
    };
    // Emit API request from device to room for subscribers
    require('./lib/getUuid')(socket.id.toString(), function(uuid){
      var reqData = data;
      reqData["api"] = "update";      
      socket.broadcast.to(uuid.uuid).emit('message', reqData);

      require('./lib/updateDevice')(data.uuid, data, function(results){
        console.log(results);
        try{
          fn(results);

          // Emit API request from device to room for subscribers
          socket.broadcast.to(uuid.uuid).emit('message', results);

        } catch (e){
          console.log(e);
        }
      });
    });
  });

  socket.on('unregister', function (data, fn) {
    if(data == undefined){
      var data = {};
    }
    // Emit API request from device to room for subscribers
    require('./lib/getUuid')(socket.id.toString(), function(uuid){
      var reqData = data;
      reqData["api"] = "unregister";      
      socket.broadcast.to(uuid.uuid).emit('message', reqData);

      require('./lib/unregister')(data.uuid, data, function(results){
        console.log(results);
        try{
          fn(results);

          // Emit API request from device to room for subscribers
          socket.broadcast.to(uuid.uuid).emit('message', results);

        } catch (e){
          console.log(e);
        }
      });
    });
  });

  socket.on('message', function (data) {
    if(data == undefined){
      var data = {};
    }

    var eventData = data

    // Broadcast to room for pubsub
    require('./lib/getUuid')(socket.id.toString(), function(uuid){
      eventData["api"] = "message";
      socket.broadcast.to(uuid.uuid).emit('message', eventData)  
      // io.sockets.in(uuid.uuid).emit('message', eventData)
    });

    console.log('devices: ' + data.devices);
    console.log('message: ' + JSON.stringify(data.message));

    if(data.devices == "all"){

        io.sockets.emit('message', data.message);
        require('./lib/logEvent')(300, eventData);

    } else {

      // for (var i=0;i<devices.length;i++)
      // { 
      //   require('./lib/getSocketId')(devices[i], function(data){
      //     io.sockets.socket(data.socketid).emit('message', message);
      //   });
      // }      

      var devices = data.devices;

      // if string convert to array
      if( typeof devices === 'string' ) {
          devices = [ devices ];
      };

      devices.forEach( function(device) { 
        // require('./lib/getSocketId')(device, function(data){
        //   io.sockets.socket(data).emit('message', message);
        // });

        // Broadcast to room for pubsub
        console.log('sending message to room: ' + device);
        io.sockets.in(device).emit('message', message)

      });

      require('./lib/logEvent')(300, eventData);

    }

  });

});

// curl http://localhost:3000/status
// server.get('/status', require('./lib/getSystemStatus'));
server.get('/status', function(req, res){
  require('./lib/getSystemStatus')(function(data){
    console.log(data);
    res.json(data);
  });
});


// curl http://localhost:3000/devices
// curl http://localhost:3000/devices?key=123
// curl http://localhost:3000/devices?online=true
// server.get('/devices', require('./lib/getDevices'));
server.get('/devices', function(req, res){
  require('./lib/getDevices')(req.query, function(data){
    console.log(data);
    res.json(data);
  });
});


// curl http://localhost:3000/devices/01404680-2539-11e3-b45a-d3519872df26
// server.get('/devices/:uuid', require('./lib/whoami'));
server.get('/devices/:uuid', function(req, res){
  require('./lib/whoami')(req.params.uuid, function(data){
    console.log(data);
    res.json(data);
  });
});


// curl -X POST -d "name=arduino&description=this+is+a+test" http://localhost:3000/devices
// server.post('/devices', require('./lib/register'));
server.post('/devices', function(req, res){
  require('./lib/register')(req.params, function(data){
    console.log(data);
    res.json(data);
  });
});


// curl -X PUT -d "token=123&online=true&temp=hello&temp2=world" http://localhost:3000/devices/01404680-2539-11e3-b45a-d3519872df26
// curl -X PUT -d "token=123&online=true&temp=hello&temp2=null" http://localhost:3000/devices/01404680-2539-11e3-b45a-d3519872df26
// curl -X PUT -d "token=123&online=true&temp=hello&temp2=" http://localhost:3000/devices/01404680-2539-11e3-b45a-d3519872df26
// curl -X PUT -d "token=123&myArray=[1,2,3]" http://localhost:3000/devices/01404680-2539-11e3-b45a-d3519872df26
// curl -X PUT -d "token=123&myArray=4&action=push" http://localhost:3000/devices/01404680-2539-11e3-b45a-d3519872df26
// server.put('/devices/:uuid', require('./lib/updateDevice'));
server.put('/devices/:uuid', function(req, res){
  require('./lib/updateDevice')(req.params.uuid, req.params, function(data){
    console.log(data);
    res.json(data);
  });
});

// curl -X DELETE -d "token=123" http://localhost:3000/devices/01404680-2539-11e3-b45a-d3519872df26
// server.del('/devices/:uuid', require('./lib/unregister'));
server.del('/devices/:uuid', function(req, res){
  require('./lib/unregister')(req.params.uuid, req.params, function(data){
    console.log(data);
    res.json(data);
  });
});

// curl -X POST -d '{"devices": "all", "message": {"yellow":"off"}}' http://localhost:3000/messages
// curl -X POST -d '{"devices": ["ad698900-2546-11e3-87fb-c560cb0ca47b","2f3113d0-2796-11e3-95ef-e3081976e170"], "message": {"yellow":"off"}}' http://localhost:3000/messages
// curl -X POST -d '{"devices": "ad698900-2546-11e3-87fb-c560cb0ca47b", "message": {"yellow":"off"}}' http://localhost:3000/messages
server.post('/messages', function(req, res, next){
  try {
    var body = JSON.parse(req.body);
  } catch(err) {
    var body = req.body;
  }
  var devices = body.devices;
  var message = body.message;
  var eventData = {devices: devices, message: message}

  console.log('devices: ' + devices);
  console.log('message: ' + JSON.stringify(message));

  if(devices == "all"){
      
      io.sockets.emit('message', message);
      require('./lib/logEvent')(300, eventData);
      res.json(eventData);

  } else {

    // if string convert to array
    if( typeof devices === 'string' ) {
        devices = [ devices ];
    };

    devices.forEach( function(device) { 
      // require('./lib/getSocketId')(device, function(data){
      //   io.sockets.socket(data).emit('message', message);
      // });

      // Broadcast to room for pubsub
      console.log('sending message to room: ' + device);
      io.sockets.in(device).emit('message', message)

    });

    require('./lib/logEvent')(300, eventData);
    res.json(eventData);

  }

});

server.listen(process.env.PORT || config.port, function() {
  console.log("\n SSSSS  kk                            tt    ");
  console.log("SS      kk  kk yy   yy nn nnn    eee  tt    ");
  console.log(" SSSSS  kkkkk  yy   yy nnn  nn ee   e tttt  ");
  console.log("     SS kk kk   yyyyyy nn   nn eeeee  tt    ");
  console.log(" SSSSS  kk  kk      yy nn   nn  eeeee  tttt ");
  console.log("                yyyyy                         ");
  console.log('\nSkynet listening at %s', server.url);  
});