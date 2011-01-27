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
      var self = this;
      db.logStats(mesg.getBody()._data_, function(err) {
        err && console.error(err.message);
      });
      //subscribers.notify(stats);
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