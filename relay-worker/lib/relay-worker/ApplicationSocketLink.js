var event = require("events");
var api   = require("relay-core/api");
function ApplicationSocketLink (stream) {
  var self = this;
  this.write = function write (obj) {
    try {
      return stream.write(JSON.stringify(obj.dump()));
    } catch (e) {

    }
  };
  this.destroy = function destroy () {
    console.log("Destroying stream");
    return stream.destroy();
  };
  stream.removeAllListeners("data");
  stream.on("data", function(data){ 
    try {
      var json = JSON.parse(data);
    } catch (err) {
      throw err;
      stream.close();
    }
    if (json)
      self.emit("data", api.constructRequest(json));
  });
  stream.on("close",function(){ self.emit("close") });
  stream.on("end",function(){ self.emit("end") });
}
ApplicationSocketLink.prototype = event.EventEmitter.prototype

exports.ApplicationSocketLink = ApplicationSocketLink
