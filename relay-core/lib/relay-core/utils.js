var pack   = require("./pack").pack;
var Buffer = require("buffer").Buffer;
var event  = require("events");
var api    = require("./api");

function passEvent(event, from, to) {
  from.on(event,function() { 
    to.emit(event, arguments);
  });
}

function assert(pred, mesg) {
  if (pred)
    return true;
  else
    throw mesg
}

function ApplicationSocketLink (stream) {

  var self = this;

  var header_size = 2;

  var header_bytes_read, header, waiting, queue, queue_written;

  stream.removeAllListeners("data");

  function reset () {
    header_bytes_read = 0;
    header = new Buffer(header_size, 'binary');
    waiting = 0;
  };

  reset();

  stream.on("data", function (data) {
    function aux (data) {

      if (header_bytes_read < header_size) {
        for (var i = 0; header_bytes_read < header_size && i < data.length; i++){
          header[header_bytes_read] = data[i];
          header_bytes_read += 1;          
        }
        data = data.slice(i,data.length);
      }

      if (header_bytes_read == header_size) {

        if (waiting == 0) {
          for (var i = 0; i < header_size; i++) {
            waiting = waiting << 8;
            waiting = header[i] | waiting;
          }
          queue = new Buffer(waiting, 'binary');
          queue_written = 0;
        }

        var over  = data.length - waiting;
        var dataA = data.slice(0, over > 0 ? waiting : data.length);

        dataA.copy(queue, queue_written, 0, dataA.length);
        queue_written += dataA.length;
        waiting       -= dataA.length;

        if (waiting == 0) {
  
          try {
            var json = JSON.parse(queue.toString('utf8'));
          } catch (e) {
            self.emit("error")
          }
          
          if (json) self.emit("data", api.constructRequest(json));
          
          reset();

          if (over > 0) {
            var leftover = data.slice(data.length-over, data.length);
            if (leftover.length > 0) aux(leftover);
          }

        }
      }
    }
    aux(data);  
  });

  this.write = function (obj) { 
    var json = JSON.stringify(obj.dump())
    self.writeRaw(json)
  }

  this.writeRaw = function (json) {
    var bufA = new Buffer(Buffer.byteLength(json) + 2,'binary');
    var bufB = new Buffer(pack('n',Buffer.byteLength(json)),'binary');
    bufB.copy(bufA,0,0);
    var bufC = new Buffer(json);
    bufC.copy(bufA,2,0);    
    doWrite(bufA);
  }

  function doWrite (buf) {
    // this does not seem to work at for some reason :(
    if (stream.writeable !== false) {
      try {
        stream.write(buf);
      } catch (e) {
        
      }
    }      
  }

  
  
  passEvent("close", stream, this);
  passEvent("end", stream, this);
  passEvent("error", stream, this);
  passEvent("connect", stream, this);

  this.end     = function () { stream.end() }
  this.destroy = function () { stream.destroy() }

};
ApplicationSocketLink.prototype = event.EventEmitter.prototype;
exports.ApplicationSocketLink = ApplicationSocketLink;
