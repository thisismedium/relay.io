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
  var messageHandler = null;

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
    } else if (messageHandler) {
      if (messageHandler.log) {
        messageHandler.log(mesg);
      }
      if (mesg.type && messageHandler[mesg.type]) {
        messageHandler[mesg.type](mesg, {
          "reply": function (replyMessage, callback) {
            if (mesg.id) {
              replyMessage.from = mesg.to;
              replyMessage.id   = mesg.id;
              replyMessage.to   = api.RELAY_MASTER_ADDRESS;
            } 
            self.send(replyMessage, callback);
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
      self.dispatch(api.inspectMessage(json));
    }
  });

  this.bindMessageHandler = function (handler) {
    if (handler.initialize) handler.initialize(this);
    messageHandler = handler;
  }

  this.getId     = function () { return socketChan.getId() };
  this.getSocket = function () { return socketChan.getSocket() };

  this.end = this.destroy = function () { return socketChan.end() }

  this.write = function (data) {
    throw "Write should not be used, use '.send' instead";
  }

  this.send = function (json, callback) {
    if (callback) {
      if (!json.id) {
        var mid = getNextMessageId();
      } else {
        var mid = json.id;
      }
      callbacks[mid] = callback;
      json.id = mid;
    }
    if (typeof json['dump'] == "function") json = json.dump();
    
    var str = JSON.stringify(json);
    if (!str) throw "Object could not be serialized";
    else socketChan.write(JSON.stringify(json));
  };

  this.writeRaw = function (data) { socketChan.writeRaw(data) };

  this.multiWrite = function (chans, obj) {
    if (typeof(obj.dump) == "function") obj = obj.dump();
    socketChan.multiWrite(chans, JSON.stringify(obj));
  };
};
ApplicationSocketLinkChannel.inheritsFrom(events.EventEmitter);

exports.ApplicationSocketLink = ApplicationSocketLink;
