// # util.js #
//
// Helpful methods that implement boring parts of Relay.
//
define(['exports', 'sys', 'events'], function(exports, Sys, Events) {

  exports.gensym = gensym;
  exports.splitAppId = splitAppId;
  exports.proxyEvents = proxyEvents;
  exports.readlines = readlines;
  exports.inherits = Sys.inherits;
  exports.EventEmitter = Events.EventEmitter;
  exports.each = each;
  exports.concat = concat;
  exports.toArray = toArray;
  exports.get = get;
  exports.extend = extend;

  
  // ## Helpers ##

  var gensym = exports.gensym = (function() {
    var index = -1;
    return function gensym(prefix) {
      return (prefix || 'g:') + (++index);
    };
  })();

  function splitAppId(name) {
    var probe = name.match(/^([^\/]*)(?:\/(.+))?$/);
    return probe && { appId: probe[1], channel: probe[2] || null };
  }

  
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

  function each(seq, fn, ctx) {
    if (seq.forEach)
      seq.forEach(fn, ctx);
    else if (typeof seq.length == 'number') {
      for (var i = 0, l = seq.length; i < l; i++)
        fn.call(ctx, seq[i], i, seq);
    }
    else {
      for (var key in seq)
        fn.call(ctx, seq[key], key, seq);
    }
    return this;
  }

  function unshift(seq, name) {
    if (!seq.unshift)
      seq = toArray(seq);
    seq.unshift(name);
    return seq;
  }

  function concat() {
    var seed = [];
    for (var i = 0, il = arguments.length; i < il; i++) {
      for (var j = 0, seq = arguments[i], jl = seq.length; j < jl; j++)
        seed.push(seq[j]);
    }
    return seed;
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

  function get(obj, key, ctor) {
    var val = obj[key];
    if (val === undefined && ctor !== undefined)
      val = obj[key] = new ctor();
    return val;
  }

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