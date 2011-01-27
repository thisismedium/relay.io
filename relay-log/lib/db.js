define(['exports', './sql', './util'], function(exports, Sql, U) {

  exports.LogDB = LogDB;
  exports.Router = Router;

  
  // ## Database Client ##

  U.inherits(LogDB, U.EventEmitter);
  function LogDB(uri) {
    U.EventEmitter.call(this);
    this.uri = uri;
  }

  LogDB.prototype.logStats = function(quantum, next) {
    var start = new Date(quantum.started),
        stop = new Date(quantum.stopped);

    this.insert('log')
      .names('appId', 'channel', 'kind', 'val', { start: start, stop: stop })
      .eachValue(quantum.data, function(item, key) {
        var what = U.splitAppId(key);
        for (var kind in item)
          this.exec(what.appId, what.channel, kind, item[kind]);
      })
      .end(next);

    return this;
  };

  LogDB.prototype.insert = function(into) {
    return new Sql.Insert(this.uri).into(into);
  };

  
  // ## Router ##

  function Router() {
  };

  Router.prototype.add = function(stream, app, channel) {
  };

  Router.prototype.remove = function(stream, app, channel) {
  };

  Router.prototype.notify = function(stats) {
  };

});