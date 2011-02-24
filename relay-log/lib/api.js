// # Archive Api #
//
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
//
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


define(['exports', 'relay-core/protocol', 'relay-core/util'],
function(exports, Proto) {

  var Api = this.exports = Proto.protocol('Archive')
    .stream({
      Error: function(err, status, orig) {
        if (typeof status == 'object') {
          orig = status;
          status = undefined;
        }
        err = Api.Error(err, status, orig);
        return orig ? this.reply(orig, err) : this.send(err);
      },

      Source: function(next) {
        return this.dm(Api.Source(), next);
      },

      Ok: function(orig) {
        return this.reply(orig, Api.OK());
      },

      Push: function(quantum) {
        return this.dm(Api.Push(quantum));
      },

      Subscribe: function(app, channel) {
        return this.dm(Api.Subscribe(app, channel));
      },

      Update: function(entries) {
        return this.dm(new Api.Update(entries));
      },

      Cancel: function(app, channel) {
        return this.dm(new Api.Cancel(app, channel));
      }
    })
    .type({
      Error: function() {
        return Api.message('Error')
          .status(status || 500)
          .body({ message: (err && err.toString()), orig: orig });
      },

      Source: function() {
        return Api.message('Source');
      },

      OK: function() {
        return Api.message('Ok')
          .status(200);
      },

      Push: function(quantum) {
        return Api.message('Push')
          .body(quantum.dump());
      },

      Subscribe: function(app, channel) {
        return Api.message('Subscribe')
          .body({ app: app, channel: channel || null });
      },

      Update: function(entries) {
        return Api.message('Update')
          .body('record', entries.map(function(entry) {
            return entry.dump();
          }));
      },

      Cancel: function(app, channel) {
        return Api.message('Cancel')
          .body({ app: app, channel: channel || null });
      }
    })
    .api();
});
