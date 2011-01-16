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
               "error"  : obj.error,
               "complete": obj.complete
             });
    };
    this.post = function post(obj) {
      $.ajax({ "type": 'POST',
               "url": obj.url,
               "success": obj.success,
               "error"  : obj.error,
               "complete": obj.complete,
               "data": obj.data,
               "contentType": "text/plain"
             });
    };
  };

  function PlainBackend () {
    var self = this;

    this.POST = "POST";
    this.GET  = "GET";

    var timeout = 30000;

    this.ajax = function (method, obj) {

      var req = new XMLHttpRequest();
      req.open(method, obj.url);  

      if (obj.multipart === true) {
        req.multipart = obj.multipart;
        req.setRequestHeader("Accept","multipart/x-mixed-replace");
      }

      if (req.multipart === true) {
        var abort = function(){ req.abort() };
        var to = setTimeout(abort, timeout);
        req.onload = function() {
          if (req.status == 200) {
            clearTimeout(to);
            to = setTimeout(abort, timeout);
            if (obj.success) obj.success(req.responseText);
          } else {
            if (obj.error) obj.error(req.status, req.responseText);
            if (obj.complete) obj.complete();
          }
        }
        req.onabort = function () { 
          if (obj.complete) obj.complete(); 
        }
      } else {
        req.onreadystatechange = function (event) {
          if (req.readyState == 4) {
            if (req.status == '200') {
              if (obj.success) obj.success(req.responseText);
            } else {
              if (obj.error) obj.error();
            }
            if(obj.complete) obj.complete(req.status, req.responseText);
          }
        };
      }
      
      if (method == self.POST) req.send(obj.data);  
      else req.send();
      
    };

    this.get = function(obj) {
      this.ajax(this.GET, obj);
    };

    this.post = function(obj) {
      this.ajax(this.POST, obj);
    };

  };


  function HttpSocket (hostname, port, backend) {

    var self = this;
    var session_id;
    var failures = 0;
    var readers = 0;

    function readLoop () {
      function aux() {
        readers += 1;
        backend.get({ 
          "multipart": false,
          "url": "http://"+hostname+":"+port+"/stream/read/"+session_id, 
          "success": function(data) {
            failures = 0;
            var parsed = data.split('\x00');
            parsed.reverse();
            for (var i = 0; i < parsed.length; i++) {
              if (parsed[i]) self.emit("data", parsed[i]);
            }
          },
          "error": function () { failures += 1 },
          "complete": function(){readers -= 1; if(failures < 10) setTimeout(readLoop,1)}
        });
      }
      while (readers < 1) {
        aux();
      }
    };

    function connect() {
      backend.get({
        "url": "http://"+hostname+":"+port+"/stream/open",
        "success": function(data) {
          session_id = data;
          self.emit("connect");
          readLoop();
        }
      });
    };
    
    this.write = this.send = function write (data, callback) {
      if (failures < 10) {
        backend.post({
          "url":"http://"+hostname+":"+port+"/stream/write/"+session_id, 
          "data": data, 
          "error": function () { failures += 1 },
          "success": callback
        });
      }
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
    if (RELAY_CARRIER_HOST) {
      var carrier = RELAY_CARRIER_HOST[Math.floor(Math.random()*RELAY_CARRIER_HOST.length)];
    } else {
      var carrier = ["api.relay.io","80"];
    }
    if (!window.WebSocket) {
      return new HttpSocket(carrier[0], carrier[1], new PlainBackend());
    } else {
      return new WebSocketSocket(carrier[0], carrier[1]);
    } 
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
      //console.log(mesg);
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
