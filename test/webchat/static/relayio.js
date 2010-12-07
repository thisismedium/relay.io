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

  function EventEmitter () {
    void(0);
  };
  EventEmitter.prototype.on = EventEmitter.prototype.addEventListener = function (event, callback) {
    if (!this._events) this._events = {};
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(callback);
  };

  EventEmitter.prototype.emit = function () {
    if (!this._events) this._events = {};
    var event  = arguments[0];
    var args   = Array.prototype.slice.call(arguments).slice(1);
    var events = this._events[event] ? this._events[event] : [];
    for (var i = 0; i < events.length; i++) {
      events[i].apply(this, args);
    }
  };  

  // HTTP Socket

  function HttpSocket (hostname, port) {

    var self = this;

    function readLoop () {
      $.get("/stream/read", function(data) {
        var parsed = data.split('\x00');
        parsed.reverse();
        for (var i = 0; i < parsed.length; i++) {
          if (parsed[i]) self.emit("data", parsed[i]);
        }
        readLoop();
      });
    };

    function connect() {
      $.get("/stream/open", function(data) {
        readLoop();
        self.emit("connect");
      })  
    };

    this.write = this.send = function write (data, callback) {
      $.post("/stream/write", data, callback);
    };

    connect();

  }
  HttpSocket.prototype = EventEmitter.prototype;
  exports.HttpSocket = HttpSocket;

  // Websocket wrapper
  function WebSocketSocket (hostname, port) {

    var self = this;

    var ws = new WebSocket("ws://"+hostname + ((port) ? ":" + port : ":80"));

    ws.addEventListener("message", function (mesg) {
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

  function getConnection() {
    return HttpSocket;
  };

  function RelayClient (app_id, keys) {
    
    var self = this;

    var connection;
    
    var connected = false;

    var current_message_id = 0;

    var user_id = undefined;

    var chans   = {};

    var mesg_listeners = {};

    var messageHandler = new EventEmitter();

    this.connect = function connect (callback) {

      connection = new (getConnection())("magic", 8080);

      connection.on("connect", function() {

        connection.on("data", function (data) {
          var json = JSON.parse(data);
          if (json.mesgId && mesg_listeners[json.mesgId]) {
            mesg_listeners[json.mesgId](json);
            delete mesg_listeners[json.mesgId];
          } else {
            self.emit("data", json);
            messageHandler.emit(json.type, json);
          }
        });

        connection.write(JSON.stringify({"type": "Hello",
                                         "body": app_id,
                                         "keys": keys}));
      });
      
      messageHandler.on("Welcome", function (json) {
        connected = true;
        user_id = json.body;
        callback();
      });

      
    };

    function getNextMessageId() {
      return ++current_message_id;
    };

    function send (mesg, callback) {
      if (callback) {
        var id = getNextMessageId();
        mesg.mesgId = id;
        mesg_listeners[id] = callback;
      }
      connection.write(JSON.stringify(mesg))
    };

    messageHandler.on("Message", dispatchMessage);

    function dispatchMessage(mesg) {
      if (mesg.to == "#global" || mesg.to == user_id) {
        self.emit("message", mesg.body);
      } else {
        chans[mesg.to].emit("message", mesg.body);
      }
    }

    this.join = function join (chan, callback) {
      var mesg = { "type": "Join",
                   "body": chan };
      send(mesg, function(json) {
        if (json.type != "Error") {
          var chanObj = new EventEmitter();
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

relay.on("message", function(mesg) {
  console.log(mesg);
});
  
relay.on("error", function (err) {
  console.debug(err);
});

relay.connect(function () {

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
    
    chan.on("client-leave", function (client_id) {
      console.log("Client " + client_id + " has left.");
    });

    chan.send("Hello World!", function(succeed) {
      console.log("Hello message sent!");
    });

  });
  
});
*/
