// # archive.js #
//
// The archive server listens for updates from Relay Stations and
// answers queries about usage.

define(['exports', './api', './db'], function(exports, Api, DB) {

  exports.createServer = createServer;

  function createServer(me, db) {
    var subscribers = new DB.Router();

    return Api.createServer(me, function(stream) {
      stream
        .on('Source', onSource)
        .on('Push', onPush)
        .on('Subscribe', onSubscribe)
        .on('close', onClose)
        .on('error', onError);
    });

    function onSource(mesg) {
      return this.peer(mesg.from).Ok(mesg);
    }

    function onPush(mesg, resp) {
      db.logStats(mesg.body(), function(err) {
        err && console.log(err.message);
      });
      //subscribers.n2otify(stats);
    }

    function onSubscribe(mesg, resp) {
      // subscribers.add(this, mesg.getApp(), mesg.getChannel());
    }

    function onCancel(mesg) {
      // subscribers.remove(this, mesg.getApp(), mesg.getChannel());
      this.Ok(mesg);
    }

    function onClose() {
      // subscribers.remove(this);
    }

    function onError(err) {
      console.log('## Caught Error ##');
      console.log(err && err.toString());
    }
  }

});