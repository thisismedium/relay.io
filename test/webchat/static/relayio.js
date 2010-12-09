/* 

Socket Methods:

   .connect() - Connect a socket
   .write()   - Write to a socket
   .on()      - Added an event
   .close()   - Disconnect a socket

Socket Events:

   "connect"    - a connection was established
   "data"       - message was recieved
   "close"      - socket closed


*/

// Events

var relayio = {};
(function (exports) {
  
  var DEBUG = false;
  function debug (mesg) {
    if (DEBUG) console.log(mesg);
  };

  function EventEmitter () {
    void(0);
  };
  EventEmitter.prototype.on = EventEmitter.prototype.addEventListener = function (event, callback) {
    if (!this._events) this._events = {};
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(callback);
    return this;
  };

  EventEmitter.prototype.emit = function () {
    if (!this._events) this._events = {};
    var event  = arguments[0];
    var args   = Array.prototype.slice.call(arguments).slice(1);
    var events = this._events[event] ? this._events[event] : [];
    for (var i = 0; i < events.length; i++) {
      events[i].apply(this, args);
    }
    return this;
  };  

  EventEmitter.prototype.removeListener = function (event, listener) {
    if (this._events[event]) {
      for (var i = 0; i < this._events[event].length; i++) {
        if (this._events[event][i] == listener) {
          delete this._events[event][i];
        }
      }
    }
    return this;
  };
  
  EventEmitter.prototype.removeAllListeners = function (event) {
    if (this._events[event]) {
      this._events[event] = [];
    }
    return this;
  };

  // HTTP Socket

  function HttpSocket (hostname, port) {

    var self = this;
    var session_id;

    function readLoop () {
      $.ajax({ "url": "/stream/read/"+session_id, 
               "success": function(data) {
                 var parsed = data.split('\x00');
                 parsed.reverse();
                 for (var i = 0; i < parsed.length; i++) {
                   if (parsed[i]) self.emit("data", parsed[i]);
                 }
                 readLoop();
               },
               "error": readLoop
             });
    };

    function connect() {
      $.get("/stream/open", function(data) {
        session_id = data;
        readLoop();
        self.emit("connect");
      })  
    };

    this.write = this.send = function write (data, callback) {
      $.post("/stream/write/"+session_id, data, callback);
    };

    connect();

  }
  HttpSocket.prototype = EventEmitter.prototype;
  exports.HttpSocket = HttpSocket;

  // Websocket wrapper
  function WebSocketSocket (hostname, port) {

    var self = this;

    var ws = new WebSocket("ws://"+hostname + ((port) ? ":" + port : ":80"));
    debug(ws);
    ws.addEventListener("message", function (mesg) {
      debug(mesg);
      self.emit("data",mesg.data);
    });

    ws.addEventListener("open", function () {
      self.emit("connect");
    });
    
    this.write = function (data) {
      ws.send(data);
    };

  };
  WebSocketSocket.prototype = EventEmitter.prototype;
  exports.WebSocketSocket = WebSocketSocket;

  ////////////////////////////////////////////////////////////////////////

  function getConnection() {
    return HttpSocket;
    //return WebSocketSocket;
  };

  ////////////////////////////////////////////////////////////////////////
  
  function RelayChannel (name, parent) {
    
    this.getName = function getName () {
      return name;
    }

    this.getStatus = function (callback) {
      var mesg = { "type": "GetStatus",
                   "body": name };
      parent.send(mesg, function (json) {
        if (json.type == "Error") {
          callback(json.body);
        } else {
          var clients = [];
          for (var i = 0; i < json.clients.length; i++) {
            clients.push(new RelayChannel(json.clients[i], parent));
          }
          callback(undefined, clients);
        }
      });
    };

    this.exit = function exit(callback) {
      var mesg = {"type": "Exit", "body": this.getName() };
      parent.send(mesg, callback);
    };

    this.send = function send (mesg, callback) {
      var rmesg = {"type": "Message",
                   "to": name,
                   "from": "@me",
                   "body": mesg };
      debug(parent);
      parent.send(rmesg, function(json) {
        if (callback) {
          if (json.type == "Error") {
            callback(json.body);
          } else {
            callback();
          }
        }
      });
    }

  };
  RelayChannel.prototype = EventEmitter.prototype;

  function RelayClient (app_id, keys) {
    
    var self = this;
    var connection;
    var connected = false;
    var current_message_id = 0;
    var user_id = undefined;
    var chans   = {};
    var mesg_listeners = {};
    var messageDispatcher = new EventEmitter();

    this.connect = function connect (callback) {

      connection = new (getConnection())("localhost", 8080);

      connection.on("connect", function() {

        connection.on("data", function (data) {
          debug(" > DATA IN: " + data);
          var json = JSON.parse(data);
          if (json.mesgId && mesg_listeners[json.mesgId]) {
            mesg_listeners[json.mesgId](json);
            delete mesg_listeners[json.mesgId];
          }
 
          self.emit("data", json);
          messageDispatcher.emit(json.type, json);
          
        });

        connection.write(JSON.stringify({"type": "Hello",
                                         "body": app_id,
                                         "keys": keys}));
      });
      
      messageDispatcher.on("Welcome", function (json) {

        connected = true;
        user_id = json.body;

        var private_chan = new RelayChannel(user_id, self);
        var global_chan  = new RelayChannel("#global", self);

        chans[user_id] = private_chan;
        chans["#global"] = global_chan;

        callback(global_chan, private_chan);

      });

      
    };

    function getNextMessageId() {
      return ++current_message_id;
    };

    this.send = function send (mesg, callback) {
      if (callback) {
        var id = getNextMessageId();
        mesg.mesgId = id;
        mesg_listeners[id] = callback;
      }
      debug(" < DATA OUT: " + JSON.stringify(mesg))
      connection.write(JSON.stringify(mesg))
    };

    messageDispatcher.on("Message", function(mesg) {
      debug(chans);
      var from = chans[mesg.from] ? chans[mesg.from] : (new RelayChannel(mesg.from, self));
      if (chans[mesg.to])
        chans[mesg.to].emit("message", mesg.body, from);
    });

    messageDispatcher.on("ClientEnter", function (mesg) {
      debug(chans);
      if (mesg.body.clientId != user_id && chans[mesg.body.channelId]) {
        debug(mesg.body.clientId);
        var new_chan = chans[mesg.body.clientId] ? chans[mesg.body.clientId] : new RelayChannel(mesg.body.clientId, self);
        chans[mesg.body.channelId].emit("client-enter", new_chan);
      }
    });

    messageDispatcher.on("ClientExit", function (mesg) {
      if (mesg.body.clientId != user_id && chans[mesg.body.channelId]) {
        var new_chan = chans[mesg.body.clientId] ? chans[mesg.body.clientId] : new RelayChannel(mesg.body.clientId, self);
        chans[mesg.body.channelId].emit("client-exit", new_chan);
      }
    });
    
    this.getClientId = function () {
      return user_id;
    };

    this.join = function join (chan, callback) {
      var mesg = { "type": "Join",
                   "body": chan };
      self.send(mesg, function(json) {
        if (json.type != "Error") {
          var chanObj = new RelayChannel(chan, self);
          chans[chan] = chanObj;
          callback(undefined, chanObj);
        } else {
          callback(json.body, undefined);
        }
      });    

    };

  }
  RelayClient.prototype = EventEmitter.prototype;
  exports.RelayClient = RelayClient;
  
})(relayio);

/*
var relay = new RelayClient("my_app", ["write_key","read_key"]);

relay.on("error", function (err) {
  console.debug(err);
});

relay.connect(function (globalchan, privatechan) {

  globalchan.on("message", function(mesg) {
    console.log(mesg);
  });
  
  relay.join("#medium", function(chan) {

    chan.getStatus(function(status) {
      console.log(status);
    });

    chan.on("message", function (mesg) {
      console.log("Got mesage on #medium: " + mesg);
    });
    
    chan.on("client-enter", function (client_id) {
      console.log("Client " + client_id + " has entered.");
    });
    
    chan.on("client-exit", function (client_id) {
      console.log("Client " + client_id + " has left.");
    });

    chan.send("Hello World!", function(succeed) {
      console.log("Hello message sent!");
    });

  });
  
});
*/
