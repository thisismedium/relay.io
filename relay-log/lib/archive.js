define(['exports', './stream', './db'], function(exports, Stream, DB) {

  exports.createServer = createServer;

  function createServer(db) {
    var subscribers = new DB.Router();

    return Stream.createServer(function(stream) {
      stream
        .on('Source', onSource)
        .on('Push', onPush)
        .on('Subscribe', onSubscribe)
        .on('close', onClose);
    });

    function onSource(mesg, resp) {
      return this.ok(resp);
    }

    function onPush(mesg, resp) {
      var stats = mesg.getStats();
      db.logStats(stats);
      subscribers.notify(stats);
    }

    function onSubscribe(mesg, resp) {
      subscribers.add(this, mesg.getApp(), mesg.getChannel());
    }

    function onCancel(mesg, resp) {
      subscribers.remove(this, mesg.getApp(), mesg.getChannel());
      this.ok(resp);
    }

    function onClose() {
      subscribers.remove(this);
    }
  }

});