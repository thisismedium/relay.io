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

  function JQueryBackend() {
    this.get = function get(obj) {
      $.ajax({ "url": obj.url,
               "success": obj.success,
               "complete": obj.complete
             });
    };
    this.post = function post(obj) {
      $.ajax({ "type": 'POST',
               "url": obj.url,
               "success": obj.success,
               "complete": obj.complete,
               "data": obj.data,
               "contentType": "text/plain"
             });
    };
  };

  function HttpSocket (hostname, port, backend) {

    var self = this;
    var session_id;
    var failures = 0;

    function readLoop () {
      backend.get({ 
        "url": "http://"+hostname+":"+port+"/stream/read/"+session_id, 
        "success": function(data) {
          failures = 0;
          var parsed = data.split('\x00');
          parsed.reverse();
          for (var i = 0; i < parsed.length; i++) {
            if (parsed[i]) self.emit("data", parsed[i]);
          }
        },
        "complete": function(){if(failures < 5) setTimeout(readLoop,1)}
      });
    };

    function connect() {
      backend.get({
        "url": "http://"+hostname+":"+port+"/stream/open",
        "success": function(data) {
          session_id = data;
          readLoop();
          self.emit("connect");
        }
      });
    };
    
    this.write = this.send = function write (data, callback) {
      backend.post({
        "url":"http://"+hostname+":"+port+"/stream/write/"+session_id, 
        "data": data, 
        "success": callback
      });
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

  // Should determine the type of connection we can use to connect to 
  // relay.

  function getConnection() {
    return new HttpSocket(RELAY_CARRIER_DOMAIN ? RELAY_CARRIER_DOMAIN : "api.relay.io", 
                          RELAY_CARRIER_PORT   ? RELAY_CARRIER_PORT   : "80", 
                          new JQueryBackend());
    //return WebSocketSocket;
  };

  ////////////////////////////////////////////////////////////////////////
  
  var MessageWrapper = function () {}
  MessageWrapper.prototype.dump = function () {
    return { 
      "type": this.type,
      "body": this.body 
    };
  };

  function $message (fn) {
    fn.prototype = MessageWrapper.prototype;
    return fn;
  };

  var Hello = $message(function(app_id, keys) {
    this.type = "Hello";
    this.body = { 
      "appId": app_id,
      "keys": keys 
    }
  });

  var GetStatus = $message(function (address) {
    this.type = "GetStatus";
    this.body = { "address": address }
  });
    
  var Message = $message(function (to, body) {
    this.type = "Message";
    this.dump = function () {
      return {"type": this.type,
              "from": "@me",
              "to"  : to,
              "body": body }
    };
  });

  var Join = $message(function(channel) {
    this.type = "Join";
    this.body = {"address": channel};
  });

  var Exit = $message(function(channel) {
    this.type = "Exit";
    this.body = {"address": channel };
  });

  ////////////////////////////////////////////////////////////////////////

  
  function RelayChannel (name, parent) {
    
    this.getName = function getName () {
      return name;
    }

    this.getStatus = function (callback) {
      var mesg = new GetStatus(name);
      parent.send(mesg, function (json) {
        if (json.type == "Error") {
          callback(json.body);
        } else {
          var clients = [];
          for (var i = 0; i < json.body.clientsList.length; i++) {
            clients.push(new RelayChannel(json.body.clientsList[i], parent));
          }
          callback(undefined, clients);
        }
      });
    };

    this.exit = function exit(callback) {
      var mesg = new Exit(this.getName());
      parent.send(mesg, callback);
    };

    this.send = function send (mesg, callback) {
      var rmesg = new Message(name, mesg);
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

      connection = getConnection();

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

        self.send(new Hello(app_id, keys));
      });
      
      messageDispatcher.on("Welcome", function (json) {

        connected = true;
        user_id = json.body.clientId;

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
      console.log(mesg);
      var mesg = mesg.dump();
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
      var mesg = new Join(chan);
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