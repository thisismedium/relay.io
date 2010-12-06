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
  
})(relayio);
