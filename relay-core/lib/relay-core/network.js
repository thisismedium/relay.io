require("./inherit");
var events = require("events");
var api = require("./api");
var MultiplexedSocket = require("./multiplex").MultiplexedSocket;

var ApplicationSocketLink = function (raw_socket) {
  
  var self = this;

  var socket = new MultiplexedSocket(raw_socket);

  socket.on("end",   function () { self.emit("end") });
  socket.on("error", function (e) { self.emit("error",e) });
  socket.on("close", function () { self.emit("close") });

  socket.on("channel", function (chan) { 
    self.emit("channel", new ApplicationSocketLinkChannel(chan));
  });

  this.newChannel = function () {
    return (new ApplicationSocketLinkChannel(socket.newChannel()));
  };

  this.end = function () {
    return socket.end()
  };

};
ApplicationSocketLink.inheritsFrom(events.EventEmitter);

var ApplicationSocketLinkChannel = function (socketChan) {

  var self = this;
  var currentMid = 0;
  var callbacks = {};
  var rpcHandler = null;

  function getNextMessageId () {
    currentMid += 1;
    return currentMid;
  };

  socketChan.on("end",   function () { self.emit("end") });
  socketChan.on("error", function (e) { self.emit("error",e)});
  socketChan.on("close", function () { self.emit("close")});
    
  self.getSocket = function () { return socketChan };

  this.dispatch = function (mesg) {
    if (mesg.id && callbacks[mesg.id]) {
      callbacks[mesg.id](mesg);
    } else if (rpcHandler) {
      if (rpcHandler.log) {
        rpcHandler.log(mesg);
      }
      if (mesg.method && rpcHandler[mesg.method]) {
        rpcHandler[mesg.method](mesg, {
          "reply": function (replyMessage, callback) {
            if (mesg.id) {
              replyMessage.id = mesg.id;
            } 
            self.write(replyMessage, callback);
          }
        });
      }
    } else {
      self.emit("data", mesg);
    }
  }

  socketChan.on("data", function (data) {
    if (typeof(data) == "string") {
      try {
        var json = JSON.parse(data);
      } catch (e) {
        self.emit("error", e);
      }
    }
    if (json) {
      self.dispatch(json);
    }
  });

  this.bindRpcHandler = function (handler) {
    if (handler.initialize) handler.initialize(this);
    rpcHandler = handler;
  }

  this.getId     = function () { return socketChan.getId() };
  this.getSocket = function () { return socketChan.getSocket() };

  this.end = this.destroy = function () { return socketChan.end() }

  this.write = this.send = function (json, callback) {
    if (callback) {
      if (!json.id) {
        var mid = getNextMessageId();
      } else {
        var mid = json.id;
      }
      callbacks[mid] = callback;
      json.id = mid;
    }
    socketChan.write(JSON.stringify(json));
  };

  this.writeRaw = function (data) { socketChan.writeRaw(data) };

  this.multiWrite = function (chans, obj) {
    socketChan.multiWrite(chans, JSON.stringify(obj.dump()));
  };
};
ApplicationSocketLinkChannel.inheritsFrom(events.EventEmitter);

exports.ApplicationSocketLink = ApplicationSocketLink;
