define(['exports', 'sys', 'events'], function(exports, Sys, Events) {

  exports.proxyEvents = proxyEvents;
  exports.readlines = readlines;
  exports.inherits = Sys.inherits;
  exports.EventEmitter = Events.EventEmitter;
  exports.extend = extend;

  
  // ## Helpers ##

  var gensym = exports.gensym = (function() {
    var index = -1;
    return function gensym(prefix) {
      return (prefix || 'g:') + (++index);
    };
  })();

  
  // ## Events ##

  function proxyEvents(names, from, into) {
    names.forEach(function(name) {
      from.on(name, function() {
        into.emit.apply(into, unshift(arguments, name));
      });
    });
  }

  
  // ## Streams ##

  function readlines(stream, callback) {
    var probe, buffer = '';

    stream.on('data', function(chunk) {
      buffer += chunk;
      while ((probe = buffer.match(/^(.*)[\r\n]+/))) {
        buffer = buffer.substr(probe[0].length);
        if (probe[1])
          callback(probe[1]);
      }
    });

    return stream;
  }

  
  // ## Sequences ##

  function unshift(seq, name) {
    if (!seq.unshift)
      seq = toArray(seq);
    seq.unshift(name);
    return seq;
  }

  function toArray(seq) {
    if (!seq)
      return [];
    else if (typeof seq.length != 'number')
      throw new Error("Expected sequence, not '" + (typeof seq) + "'.");

    var result = new Array(seq.length);
    for (var i = 0, l = seq.length; i < l; i++)
      result[i] = seq[i];
    return result;
  }

  
  // ## Objects ##

  function extend(target) {
    var key, obj;

    for (var i = 1, l = arguments.length; i < l; i++) {
      if ((obj = arguments[i])) {
        for (key in obj)
          target[key] = obj[key];
      }
    }

    return target;
  }

});