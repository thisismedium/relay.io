// # util.js #
//
// Helpful methods that implement boring parts of Relay.
//
define(['exports', 'sys', 'events'], function(exports, Sys, Events) {

  exports.gensym = gensym;
  exports.splitAppId = splitAppId;
  exports.readlines = readlines;
  exports.inherits = Sys.inherits;
  exports.EventEmitter = Events.EventEmitter;
  exports.each = each;
  exports.concat = concat;
  exports.toArray = toArray;
  exports.isEmpty = isEmpty;
  exports.get = get;
  exports.pop = pop;
  exports.extend = extend;
  exports.extendDef = extendDef;
  exports.access = access;
  exports.proxyEvents = proxyEvents;
  exports.proxyProps = proxyProps;
  exports.hostname = hostname;
  exports.Host = Host;

    
  exports.withProcessArguments = withProcessArguments;
  exports.isFlag = isFlag;

  Events.EventEmitter.once = function (event, callback) {
    var self = this;
    this.on(event, callback);
    var destroy = function () {
      self.removeEvent(event, callback);
      self.removeEvent(event, this);
    }
    this.on(event,destroy);
    return this;
  }

  if (typeof(Function.prototype.partial) == "undefined") {
    Function.prototype.partial = function (){
      var that = this;
      var thoseArgs = Array.prototype.slice.call(arguments, 0);
      return function(){
        var comArgs = thoseArgs.concat(Array.prototype.slice.call(arguments, 0));
        return that.apply(this,comArgs);
      };
    };
  }

  
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

  function isEmpty(obj) {
    for (var _ in obj)
      return false;
    return true;
  }

  function get(obj, key, ctor) {
    var val = obj[key];
    if (val === undefined && ctor !== undefined)
      val = obj[key] = new ctor();
    return val;
  }

  function pop(obj, key) {
    var val = obj[key];
    delete obj[key];
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

  function extendDef(target) {
    var key, obj;

    if (target) {
      for (key in target) {
        if (target[key] === undefined)
          delete target[key];
      }
    }

    for (var i = 1, l = arguments.length; i < l; i++) {
      if ((obj = arguments[i])) {
        for (key in obj) {
          if (obj[key] !== undefined)
            target[key] = obj[key];
        }
      }
    }

    return target;
  }

  function access(self, obj, args) {
    var key = args[0], val = args[1];

    if (args.length == 0)
      return obj;
    else if (typeof key == 'object')
      extend(obj, key);
    else if (args.length == 1)
      return obj[key];
    else
      obj[key] = val;

    return self;
  }

  function proxyProps(ctor, props, accessor) {
    props.forEach(function(name) {
      Object.defineProperty(ctor.prototype, name, {
        get: function() { return accessor.call(this)[name]; },
        set: function(val) { accessor.call(this)[name] = val; }
      });
    });
  }

  function proxyEvents(names, from, into) {
    names.forEach(function(name) {
      from.on(name, function() {
        into.emit.apply(into, unshift(arguments, name));
      });
    });
  }

  
  // ## Network ##

  function hostname(port, host) {
    if (port instanceof Host)
      return port;
    else if (typeof port == 'number')
      return new Host(port, host);
    else if (port && host)
      return new Host(parseInt(port), host);

    var probe = port.toString().match(/^(?:(\w[^:]+)\:)?(\d+)$/);
    if (!probe)
      throw new Error('Invalid hostname `' + port + '`.');
    return new Host(probe[2], probe[1]);
  }

  function Host(port, host) {
    this.port = port;
    this.host = host || 'localhost';
  }

  Host.prototype.toString = function() {
    return '#<Host ' + this.hostname() + '>';
  };

  Host.prototype.hostname = function() {
    return this.host + this.port;
  };



  // ## Command line arguments ##

  var it = require("iterators");

  function isFlag (f) { return (f instanceof Flag) }
  function withProcessArguments () { return new Arguments(process.argv) }

  function Flag (x) {
    this.string = x;
  }

  function Arg (x) {
    this.string = x;
  }

  function Arguments(argv) {

    var flagReaders = {};
    var masterFlagReader;
    var aliases = {};

    function expandArgs (args) {
      return args.reduce(function(a, b) {
        if (b.slice(0,2) == "--") {
          return a.concat(new Flag(b));
        } else if (b[0] == "-" && b.slice(0,2) != "--") {
          return a.concat(b.slice(1).split("").map(function (x) {
            return new Flag("-" + x);
          }));
        } else {
          return a.concat(new Arg(b));
        }
      },[]);
    }

    this.args = it.Iterator(expandArgs(argv));

    this.alias = function (k, v) {
      aliases[k] = v;
      return this;
    };

    this.next = function () {
      return this.args.next();
    }

    this.nextArgument = function () {
      var next = this.args.next();
      if (!isFlag(next)) {
        return next.string;
      } else {
        // rewind one
        this.args.back();
        return null;
      }
    }

    this.nextFlag = function () {
      var next = this.args.next();
      if (isFlag(next)) {
        return next.string;
      } else {
        this.args.back();
        return null
      }
    }

    this.onFlag = function (flag, fn) {
      flagReaders[flag] = fn ;
      return this;
    }

    this.onAnyFlag = function (fn) {
      masterFlagReader = fn;
      return this;
    }

    this.parse = function (obj) {
      var self = this;
      var psrd = it.fold(function(a, b) {
        if (b instanceof Flag) {
          var fl = aliases[b.string] ? aliases[b.string] : b.string
          var fr = flagReaders[fl];
          if (fr) {
            return [fr.call(self, a[0]), a[1]];
          } else if (masterFlagReader) {
            return [masterFlagReader.call(self, b.string, a[0]), a[1]]
          } else {
            throw (new Error("Invalid flag"));
          }
        } else {
          return [a[0], a[1].concat( [b.string])];
        }
      }, [obj ? obj : {},[]], this);
      return { "flags": psrd[0], 
               "arguments": psrd[1] }
    }

    this.autoParse = function () {
      this.onAnyFlag(function(flg, obj) {
        console.log(flg);
        var na = this.nextArgument();
        if (na) {
        obj[flg] = na;
        } else {
          obj[flg] = true;
        }
        return obj;
      });
      return this;
    };
    

  }

});

