define(['exports', 'relay-core/utils/autorecord', 'relay-core/api', './util'],
function(exports, AutoRec, CoreApi, U) {
  var messages = {

    Error: AutoRec.autoMessage(function(err, status) {
      this.load({
        type: 'Error',
        status: status || 500,
        body: {
          message: err && err.toString()
        }
      });

      this.getMessage = function() {
        return this.getBody().message;
      };

      this.getError = function() {
        return new Error(this.getMessage());
      };
    }),

    
    // ## Logger connects to Archive ##
    //
    // A logger in the Relay network (e.g. Station) connects to the
    // archive server to push logs in at some hearbeat interval.
    //
    //     L: Source
    //     A: OK
    //     L: Push ...
    //     L: Push ...
    //     ...

    Source: AutoRec.autoMessage(function() {
      this.load({ type: 'Source' });
    }),

    OK: AutoRec.autoMessage(function() {
      this.load({ type: 'OK', status: 200 });
    }),

    Push: AutoRec.autoMessage(function(quantum) {
      this.load({
        type: 'Push',
        body: quantum && quantum.dump()
      });
    }),

    
    // ## Website wants stats ##
    //
    // A website wants to display statistics about a particular app or
    // channel. It asks to subscribe, the Archive responds with a
    // current summary, then sends incremental updates.
    //
    //     W: Subscribe #app
    //     A: Update ...
    //     A: Update ...
    //     ....
    //     W: Cancel #app
    //     A: OK

    Subscribe: AutoRec.autoMessage(function(app, channel) {
      this.load({
        type: 'Subscribe',
        body: {
          app: app,
          channel: channel || null
        }
      });

      this.getApp = function() {
        return this.getBody().app;
      };

      this.getChannel = function() {
        return this.getBody().channel;
      };
    }),

    Update: AutoRec.autoMessage(function(entries) {
      this.load({
        type: 'Update',
        body: {
          record: entries && entries.map(function(entry) {
            return entry.dump();
          })
        }
      });

      this.each = function(fn) {
        var self = this;
        this.getBody().entries.forEach(function(obj, index, ctx) {
          fn(Entry.load(obj), index, self);
        });
      };
    }),

    Cancel: AutoRec.autoMessage(function(app, channel) {
      this.load({
        type: 'Cancel',
        body: {
          app: app,
          channel: channel || null
        }
      });

      this.getApp = function() {
        return this.getBody().app;
      };

      this.getChannel = function() {
        return this.getBody().channel;
      };
    })
  };

  U.extend(exports, messages);

  exports.constructMessage = function(data) {
    var ctor = messages[data.type];
    if (!ctor)
      return (new CoreAPI.InvalidMessage(data));
    else
      return (new ctor()).load(data);
  };

});