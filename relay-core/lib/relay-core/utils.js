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
  var waiting = 0;
  var buffer = "";

  stream.removeAllListeners("data");

  stream.on("data", function (buf) {
    function aux (buf) {

      if (waiting == 0) {
        buffer = "";
        waiting = buf[0] | waiting;
        waiting = waiting << 8;
        waiting = buf[1] | waiting;
        if (buf.length > 2)
          buf = buf.slice(2,buf.length);
        else
          buf = new Buffer(0);
      }

      var over = buf.length - waiting;
      var bufA = buf.slice(0, over > 0 ? waiting : buf.length);

      buffer  += bufA.toString('utf8');
      waiting -= bufA.length;

      if (waiting == 0) {
        try {
          var json = JSON.parse(buffer);
          self.emit("data", api.constructRequest(json));
        } catch (e) {
          console.log("Got invalid data");
        }
        if (over > 0) {
          var leftover = buf.slice(buf.length-over, buf.length);
          if (leftover.length > 0) aux(leftover);
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

    stream.write(bufA);
  }
  
  passEvent("close", stream, this);
  passEvent("end", stream, this);
  passEvent("connect", stream, this);

  this.end     = function () { stream.end() }
  this.destroy = function () { stream.destroy() }

};
ApplicationSocketLink.prototype = event.EventEmitter.prototype;
exports.ApplicationSocketLink = ApplicationSocketLink;
