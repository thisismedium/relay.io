var pack   = require("./utils/pack").pack;
var Buffer = require("buffer").Buffer;
var event  = require("events");
var api    = require("./api");

var DEBUG = true;
function debug (st) {
  if (DEBUG) console.log(st);
}

/*
  # ApplicationSocketLink
  
  ApplicataionSocketLink has the job of organizing a socket into multiple sessions
  a session is reffered to as channel.  The idea is that we should be able to divide
  a socket into several channels and work with these channels as if they where simply
  plain sockets; the job of sending message from the socket to the right clients is left
  up to the ApplicationSocketLink.  

  Multisession sockets are useful in relay because an http proxy might have a many clients 
  but only needs one socket open to the backend proccess.  The ApplicationSocketLink also
  has the important quality of being able to send a single message to many channels at once.
  This should prevent the backend from having to send the same message more than once. The 
  downside is that workers must organize the virtual sockets its handling specifically to 
  take advantage of the many to one transfer, this module provides some useful utility functions
  to make this easier namely 'groupChannelsBySocket'.

 */
function ApplicationSocketLink (stream) {

  var MODE_MESG = 1;
  var MODE_END  = 2;

  var self = this;
  var channels = {};
  var mode_header_width = 1;
  var chan_list_header_width = 2;
  var chan_id_width   = 2;
  var mesg_length_header_width = 2;

  var max_channel_id = 1 << (8 * chan_id_width);
  var header_size  = chan_list_header_width + mesg_length_header_width;


  stream.removeAllListeners("data");
 
  var wait_buffer;

  function windUp (data) {
    wait_buffer = data;
  };

  function parseN (n, data) {
    var out = 0;
    for (var i = 0; i < n; i++) {
      out = out << 8;
      out = data[i] | out;
    }
    return out;
  }

  // BitReaders job is to accept data from the network stream and
  // store it until it recieves enough, at which point it passes the
  // data to a callback. Bit reader will completely take over the socket
  // when the .read() method is called.

  function BitReader () {

    var buffer;
    var bytes_to_read = 0;
    var bytes_read = 0;
    var self = this;

    this.read = function (n, callback) {
      buffer = new Buffer(n);
      bytes_read = 0;
      bytes_to_read = n;
      stream.removeAllListeners("data");
      stream.on("data", function (data) {
        if (data.length >= bytes_to_read) {
          data.copy(buffer, bytes_read, 0, bytes_to_read);
          if (data.length == bytes_to_read) {
            wait_buffer = undefined;
          } else {
            wait_buffer = data.slice(bytes_to_read, data.length);
          }
          bytes_read += bytes_read;
          bytes_to_read = 0;
        } else {
          data.copy(buffer, bytes_read, 0, data.length);
          bytes_read += data.length;
          bytes_to_read -= data.length;
          wait_buffer = undefined;
        }
        if (bytes_to_read == 0) {
          callback(buffer);
        }
      });
      if (wait_buffer) stream.emit("data", wait_buffer);
    };
  };
  
  var reader = new BitReader();

  /*
  The fun starts here, we need to read in a header which contains the
  size of the channels list and the body of the message.
 
  The channel list header part is 2 bytes wide and represents the number of channels 
  that the message will be sent to.

  The size of the body is also 2 bytes wide and simply indicates the size in bytes of
  the messages body.

  We must first collect the head in total and then calculate the amount of data to read
  after the header so to break it down it looks a bit like this...

  -----------------------------
  read 1 byte (the mode byte)
  |
  ` read 4 bytes
    A = parse channel list size
    B = parse message size
    Y = (A * 2) + B
    read Y bytes
  ----------------------------

  */

  // please watch your step.

  function messageReader (data) {
    if (data) windUp(data);
    reader.read(1, function(mode) {
      debug("Mode is: " + (mode | 0));
      reader.read(2, function(number_of_channels) {
        number_of_channels = parseN(2, number_of_channels);
        debug("Number of channels is: " + number_of_channels);
        reader.read(2, function(mesg_length) {
          mesg_length = parseN(2, mesg_length);
          debug("message length is: " + mesg_length);
          reader.read(number_of_channels * chan_id_width, function (chans_str) {
            var chans = [];
            for (var i = 0; i < number_of_channels; i++) {            
              var slice = chans_str.slice(i*chan_id_width, (i*chan_id_width) + chan_id_width);
              chans.push(parseN(2, slice));
            }
            debug("Channels are: " + chans);
            reader.read(mesg_length, function(mesg) {
              debug("Message is: " + mesg.toString());

              try {
                var json = JSON.parse(mesg.toString('utf8'));
              } catch (e) {
                self.emit("error");
              }

              chans.forEach(function(chan_id) {
                var chan = channels[chan_id];
                if (chan == undefined) {
                  chan = new SocketChannel(chan_id);
                  self.emit("channel", chan);
                  channels[chan_id] = chan;
                }
                process.nextTick(function() {
                  if (json) chan.emit("data", api.constructMessage(json));
                });
              });
              messageReader();
            });
          });
        });
      });
    });
  }

  stream.on("data", messageReader);

  function emitToAllChannels (signal) {
    for (channel in channels) {
      if (channels.hasOwnProperty(channel)) {
        channels[channel].emit(signal);
      }
    }
  };

  function getNewChannelId () {
    for (var i = 0; i < max_channel_id; i++) {
      if (!(i in channels)) {
        return i;
      }
    }
  };
  
  this.newChannel = function () {
    var nid = getNewChannelId();
    var chan = new SocketChannel(nid);
    channels[nid] = chan;
    return chan;
  };

  function removeChannel (id) {
    if (id in channels) 
      delete channels[id];
  };

  stream.on("close",function(){ emitToAllChannels ("close") });
  stream.on("end"  ,function(){ emitToAllChannels ("end") });
  stream.on("error",function error (e){ debug(e); debug(e.stack); emitToAllChannels ("error") });

  stream.on("connect",function(){ self.emit("connect"); emitToAllChannels ("connect") });

  this.end     = function () { stream.end() }
  this.destroy = function () { stream.destroy() }

  ////////////////////////////////////////////////////////////////////////

  function SocketChannel (id) {

    var self = this;

    this.toString = function () {
      return "<SocketChannel #" + id + ">"
    };

    this.getId = function () { return id };

    this.getSocket = function () { return stream };

    this.end = this.destroy = function () { 
      removeChannel(id);
    };

    this.write = function (obj) { 
      var json = JSON.stringify(obj.dump())
      self._write([this], json)
    }

    this.multiWrite = function (chans, obj) {
      self._write(chans, JSON.stringify(obj.dump()));
    }

    this.writeRaw = function (str) { self._write([this], str); }

    this._write = function (chans, json) {

      var bufA = new Buffer(Buffer.byteLength(json) + mode_header_width + header_size + (chan_id_width * chans.length),'binary');

      var bufB = new Buffer(pack('Cnn', MODE_MESG, chans.length, Buffer.byteLength(json)),'binary');
      bufB.copy(bufA,0,0);

      var bufD = new Buffer(chans.length * chan_id_width, 'binary');
      for (var i = 0; i < chans.length; i++) {
        (new Buffer(pack('n', chans[i].getId()), 'binary')).copy(bufD, i * chan_id_width, 0)
      };
      bufD.copy(bufA, bufB.length, 0);

      var bufC = new Buffer(json);
      bufC.copy(bufA,bufB.length + bufD.length,0);    
      doWrite(bufA);
    }

    function doWrite (buf) {
      // this does not seem to work at for some reason :(
      if (stream.writeable !== false) {
        try {
          debug(buf);
          debug(buf.toString());
          stream.write(buf);
        } catch (e) {
        
        }
      }      
    }

  };
  SocketChannel.prototype = event.EventEmitter.prototype;

};
ApplicationSocketLink.prototype = event.EventEmitter.prototype;
exports.ApplicationSocketLink = ApplicationSocketLink;


exports.groupChannelsBySocket = function groupChannelsBySocket (channels) {
  var grouped = [];
  function addToGroup (chan) {
    for (var i = 0; i < grouped.length; i++) {
      if (grouped[i][0].getSocket() == chan.getSocket()) {
        grouped[i].push(chan);
        return true;
      }
    }
    return false;
  }
  for (var i = 0; i < channels.length; i++) {
    if (!addToGroup(channels[i])) {
      grouped.push([channels[i]]);
    }
  }
  return grouped
};
