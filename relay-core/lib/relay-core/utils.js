var pack  = require("./pack").pack;
var Buffer = require("buffer").Buffer;
var event = require("events");

function passEvent(event, from, to) {
  from.on(event,function() { 
    to.emit(event, arguments);
  });
}

function SocketReStreamer (stream) {
  var self = this;
  var waiting = 0;
  var buffer = "";
  stream.on("data", function (buf) {
    console.log("Got Data");
    console.log("\twaiting: " + waiting);
    if (waiting == 0) {
      buffer = ""
      waiting = buf[0] | waiting;
      waiting = waiting << 8;
      waiting = buf[1] | waiting;
      buf = buf.slice(2,buf.length);
    }
    console.log("\twaiting: " + waiting);
    buffer += buf.toString('utf8');
    waiting -= buf.length;
    console.log("\twaiting: " + waiting);
    if (waiting <= 0) {
      waiting = 0;
      self.emit("data", buffer);
    }
  });

  passEvent("close", stream, this);
  passEvent("end", stream, this);
  passEvent("connect", stream, this);

 

  this.end = function () { socket.end() }
  this.destroy = function () { socket.end() }
  this.write   = function (x) { 
    var bufA = new Buffer(x.length + 2,'binary');
    var bufB = new Buffer(pack('n',x.length),'binary');
    bufB.copy(bufA,0,0)
    var bufC = new Buffer(x);
    bufC.copy(bufA,2,0);
    stream.write(bufA);
  }

};
SocketReStreamer.prototype = event.EventEmitter.prototype;

exports.SocketReStreamer = SocketReStreamer;
