var pack   = require("./pack").pack;
var Buffer = require("buffer").Buffer;
var event  = require("events");
var api    = require("./api");

function passEvent(event, from, to) {
  from.on(event,function() { 
    to.emit(event, arguments);
  });
}

function ApplicationSocketLink (stream) {

  var self = this;
  var LENGTH_HEADER_SIZE = 2;
  var lbits = LENGTH_HEADER_SIZE;
  var waiting = 0;
  var queue = "";

  stream.removeAllListeners("data");

  stream.on("data", function (buf) {
    function aux (buf) {
      // console.log("Got Data:");
      // console.log("\twaiting: " + waiting);
      if (lbits > 0) {
        queue = "";
        for (var i = 0; lbits > 0 && i < buf.length; i++){
          waiting = waiting << 8;
          waiting = buf[i] | waiting;
          lbits -= 1;
        }
        buf = buf.slice(i,buf.length);
      }
      if (lbits == 0) {
        // console.log("\twaiting: " + waiting);
        var over = buf.length - waiting;
        var bufA = buf.slice(0, over > 0 ? waiting : buf.length);

        queue  += bufA.toString('utf8');
        waiting -= bufA.length;
        // console.log("\twaiting: " + waiting);
        if (waiting == 0) {
          lbits = LENGTH_HEADER_SIZE;
          try {
            var json = JSON.parse(queue);
          } catch (e) {
            console.log("Got invalid data: " + e + " in " + queue);
          }
          if (json) self.emit("data", api.constructRequest(json));
          if (over > 0) {
            var leftover = buf.slice(buf.length-over, buf.length);
            if (leftover.length > 0) aux(leftover);
          }
        }
      }
    }
    aux(buf);  
  });

  this.write = function (obj) { 
    var json = JSON.stringify(obj.dump())
    self.writeRaw(json)
  }

  this.writeRaw = function (json) {
    var bufA = new Buffer(Buffer.byteLength(json) + 2,'binary');
    var bufB = new Buffer(pack('n',Buffer.byteLength(json)),'binary');
    bufB.copy(bufA,0,0)
    var bufC = new Buffer(json);
    bufC.copy(bufA,2,0);
    try {
      stream.write(bufA);
    } catch (e) { 
      stream.end();
      stream.destroy();
    }
  }
  
  passEvent("close", stream, this);
  passEvent("end", stream, this);
  passEvent("connect", stream, this);

  this.end     = function () { stream.end() }
  this.destroy = function () { stream.destroy() }

};
ApplicationSocketLink.prototype = event.EventEmitter.prototype;
exports.ApplicationSocketLink = ApplicationSocketLink;
