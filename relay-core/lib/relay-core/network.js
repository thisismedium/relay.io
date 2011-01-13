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

  function getNextMessageId () {
    currentMid += 1;
    return currentMid;
  };

  socketChan.on("end",   function () { self.emit("end") });
  socketChan.on("error", function (e) { self.emit("error",e)});
  socketChan.on("close", function () { self.emit("close")});
    
  socketChan.on("data", function (data) {
    try {
      var json = JSON.parse(data);
    } catch (e) {
      console.log(e);
      self.emit("error", e);
    }
    if (json) {
      console.log("Parsed some JSON");
      var mesg = api.constructMessage(json);
      if (mesg.getMesgId && callbacks[mesg.getMesgId()]) {
        callbacks[mesg.getMesgId()](mesg);
      } else {
        self.emit("data", mesg);
      }
    }
  });

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
