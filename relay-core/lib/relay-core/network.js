require("./inherit");
var events = require("events");
var Api = require("./api");
var MultiplexedSocket = require("./multiplex").MultiplexedSocket;

var ApplicationSocketLink = function (raw_socket, api) {

  var self = this;

  var socket = new MultiplexedSocket(raw_socket);

  socket.on("end",   function () { self.emit("end") });
  socket.on("error", function (e) { self.emit("error",e) });
  socket.on("close", function () { self.emit("close") });
  socket.on("connect", function() { self.emit("connect"); });

  socket.on("channel", function (chan) {
    self.emit("channel", new ApplicationSocketLinkChannel(chan, api));
  });

  this.newChannel = function () {
    return (new ApplicationSocketLinkChannel(socket.newChannel(), api));
  };

  this.end = function () {
    return socket.end()
  };

};
ApplicationSocketLink.inheritsFrom(events.EventEmitter);

var ApplicationSocketLinkChannel = function (socketChan, api) {

  var self = this;
  var currentMid = 0;
  var callbacks = {};
  var rpcHandler = null;

  api = api || Api;

  function getNextMessageId () {
    currentMid += 1;
    return currentMid;
  };

  socketChan.on("end",   function () { self.emit("end") });
  socketChan.on("error", function (e) { self.emit("error",e)});
  socketChan.on("close", function () { self.emit("close")});
  socketChan.on("connect", function() { self.emit("connect"); });

  self.getSocket = function () { return socketChan };

  this.dispatch = function (mesg) {
    if (mesg.getMesgId && callbacks[mesg.getMesgId()]) {
      callbacks[mesg.getMesgId()](mesg);
    } else if (rpcHandler) {
      if (rpcHandler.log) {
        rpcHandler.log(mesg);
      }
      if (mesg.getType && rpcHandler[mesg.getType()]) {
        rpcHandler[mesg.getType()](mesg, {
          "reply": function (replyMessage, callback) {
            if (mesg.getMesgId) {
              replyMessage._data_.mesgId = mesg.getMesgId();
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
        console.log(e);
        self.emit("error", e);
      }
    }
    if (json) {
      var mesg = api.constructMessage(json);
      self.dispatch(mesg);
    }
  });

  this.bindRpcHandler = function (handler) {
    console.log("Switching RPC handler");
    if (handler.initialize) handler.initialize(this);
    rpcHandler = handler;
  }

  this.getId     = function () { return socketChan.getId() };
  this.getSocket = function () { return socketChan.getSocket() };

  this.end = this.destroy = function () { return socketChan.end() }

  this.write = this.send = function (obj, callback) {
    var data = obj.dump();
    if (callback) {
      if (!data.mesgId) {
        var mid = getNextMessageId();
      } else {
        var mid = data.mesgId;
      }
      callbacks[mid] = callback;
      data.mesgId = mid;
    }
    socketChan.write(JSON.stringify(data));
  };

  this.writeRaw = function (data) { socketChan.writeRaw(data) };

  this.multiWrite = function (chans, obj) {
    socketChan.multiWrite(chans, JSON.stringify(obj.dump()));
  };
};
ApplicationSocketLinkChannel.inheritsFrom(events.EventEmitter);

exports.ApplicationSocketLink = ApplicationSocketLink;
