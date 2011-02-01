define(['exports', './util'], function(exports, U) {

  exports.MapRed = MapRed;
  exports.ReduceStream = ReduceStream;
  exports.Score = Score;

  
  // ## Map Reduce ##

  U.inherits(MapRed, U.EventEmitter);
  function MapRed() {
    U.EventEmitter.call(this);

    this.interval = null;
    this.data = null;

    this._seed = null;
    this._map = null;
    this._reduce = null;
    this._heartbeat = null;

    var self = this;

    this.onTick = function() { self.tick(); };
  }

  MapRed.prototype.seed = function(fn) {
    this._seed = fn;
    return this;
  };

  MapRed.prototype.map = function(fn) {
    this._map = fn;
    return this;
  };

  MapRed.prototype.reduce = function(fn) {
    this._reduce = fn;
    return this;
  };

  MapRed.prototype.heartbeat = function(delay) {
    this._heartbeat = delay;
    return this;
  };

  MapRed.prototype.start = function() {
    if (!this.data) {
      this.data = this._seed();
      if (this.interval)
        clearInterval(this.interval);
      if (this._heartbeat)
        this.interval = setInterval(this.onTick, this._heartbeat);
    }
    return this;
  };

  MapRed.prototype.stop = function() {
    if (this.interval)
      clearInterval(this.interval);
    if (this.data)
      this.emit('data', this.data);
    this.data = this.interval = null;
    return this;
  };

  MapRed.prototype.tick = function() {
    var data = this.data;
    this.data = this._seed();
    this.emit('data', data);
    return this;
  };

  MapRed.prototype.push = function(obj, ctx) {
    var result = this._map.call(ctx || this, obj);
    if (result !== undefined)
      this.inject(result);
    return this;
  };

  MapRed.prototype.inject = function(obj, ctx) {
    var result = this._reduce.call(ctx || this, this.data, obj);
    if (result !== undefined)
      this.data = result;
    return this;
  };

  
  // ## Map Reduce Stream ##

  U.inherits(ReduceStream, MapRed);
  function ReduceStream(readEv, writeEv) {
    MapRed.call(this);

    this.readEv = readEv || 'data';
    this.writeEv = writeEv || 'write';
  }

  ReduceStream.prototype.add = function(stream, ctx) {
    var self = this;

    function read(obj, len) {
      self.push(new StreamEvent('read',  obj, len), ctx);
    }

    function write(obj, len) {
      self.push(new StreamEvent('write', obj, len), ctx);
    }

    function close() {
      stream
        .removeListener(self.readEv, read)
        .removeListener(self.writeEv, write)
        .removeListener('close', close);
    }

    stream
      .on(this.readEv, read)
      .on(this.writeEv, write)
      .on('close', close);

    return this;
  };

  
  // ## Event ##

  function StreamEvent(type, data, nbytes) {
    this.type = type;
    this.data = data;
    this.nbytes = nbytes;
  }

  StreamEvent.prototype.toString = function() {
    return '#<StreamEvent ' + this.type + ' ' + this.nbytes + '>';
  };

  
  // ## Score ##

  U.inherits(Score, U.EventEmitter);
  function Score(mapred, averages) {
    U.EventEmitter.call(this);

    this.last = null;
    this.total = null;
    this.average = {};

    this._zero = null;
    this._add = null;

    var self = this;

    (this.mapred = mapred)
      .on('data', function(obj) { self.update(obj); });

    if (averages)
      averages.forEach(function(secs) {
        self.average[secs] = null;
      });
  }

  Score.prototype.toString = function() {
    return '#<Score>';
  };

  Score.prototype.zero = function(fn) {
    this._zero = fn;
    return this;
  };

  Score.prototype.add = function(fn) {
    this._add = fn;
    return this;
  };

  Score.prototype.start = function() {
    if (!this.total)
      this.reset();
    this.mapred.start();
    return this;
  };

  Score.prototype.reset = function() {
    this.total = this.quantum();
    this.last = this.quantum().stop();

    for (var secs in this.average)
      this.average[secs] = new Average(this, secs);

    return this;
  };

  Score.prototype.stop = function() {
    this.total = this.last = null;

    for (var secs in this.average)
      this.average[secs] = null;

    return this;
  };

  Score.prototype.quantum = function(data, started) {
    return new Quantum(this, data, started);
  };

  Score.prototype.update = function(obj) {
    var started = this.last.stopped,
        point = this.quantum(obj, started).stop();

    this.last = point;
    this.total.update(obj);

    for (var secs in this.average)
      this.average[secs].push(point);

    this.emit('update');
    return this;
  };

  
  // ## Quantum ##

  function Quantum(score, data, started, stopped) {
    this.score = score;
    this.data = (data === undefined) ? score._zero() : data;
    this.started = (started === undefined) ? Date.now() : started;
    this.stopped = stopped || null;
  }

  Quantum.prototype.toString = function() {
    return '#<Quantum ' + this.started + ' - ' + this.stopped + '>';
  };

  Quantum.prototype.dump = function() {
    return {
      started: this.started,
      stopped: (this.stopped || Date.now()),
      data: this.data.dump()
    };
  };

  Quantum.prototype.stop = function() {
    if (this.stopped === null)
      this.stopped = Date.now();
    return this;
  };

  Quantum.prototype.delta = function() {
    return (this.stopped || Date.now()) - this.started;
  };

  Quantum.prototype.update = function(data) {
    var result = this.score._add(this.data, data);
    if (result !== undefined)
      this.data = data;
    return this;
  };

  Quantum.prototype.add = function(other) {
    this.started = Math.min(this.started, other.started);
    this.stopped = Math.max(this.stopped || 0, other.stopped || 0) || null;
    this.data = this.data.add(other.data);
    return this;
  };

  
  // ## Average ##

  function Average(score, secs) {
    this.score = score;
    this.time = secs * 1000;
    this.queue = [];
  }

  Average.prototype.toString = function() {
    return '#<Average for ' + (this.time / 1000) + ' over ' + this.score + '>';
  };

  Average.prototype.push = function(point) {
    var bound = point.stopped - this.time,
        queue = this.queue;

    queue.push(point);
    for (var i = 0, l = queue.length;
         i < l && queue[i].started < bound;
         i++);
    queue.splice(0, i);

    return this;
  };

  Average.prototype.each = function(fn) {
    this.queue.forEach(fn);
    return this;
  };

  Average.prototype.stats = function() {
    var length = this.queue.length,
        total = this.score.quantum().stop(),
        sumDelta;

    if (length > 0) {
      this.each(function(point) {
        sumDelta += point.delta();
        total.update(point.data);
      });

      total.started = this.queue[0].started;
      total.ended = this.queue[length - 1].ended;
    }

    return {
      length: length,
      total: total,
      avgDelta: sumDelta / length
    };
  };

});