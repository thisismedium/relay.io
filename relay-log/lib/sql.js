// # sql.js #
//
// Wrap up the node-postgres interface behind a Javascript/SQL DSL.

define(['exports', 'pg', 'relay-core/util'], function(exports, Pg, U) {

  exports.Insert = Insert;

  
  // ## Insert ##

  function Insert(uri) {
    this.uri = uri;
    this._into = null;
    this._names = [];
    this._values = [];
    this._exec = null;
  }

  Insert.prototype.toString = function() {
    return '#<SQL ' + this.statement() + '>';
  };

  Insert.prototype.into = function(table) {
    this._into = table;
    return this;
  };

  Insert.prototype.names = function() {
    for (var i = 0, l = arguments.length; i < l; i++) {
      if (typeof arguments[i] == 'object')
        this.bind(arguments[i]);
      else
        this._names.push(arguments[i]);
    }
    return this;
  };

  Insert.prototype.bind = function(values) {
    for (var name in values) {
      this._names.unshift(name);
      this._values.unshift(values[name]);
    }
    return this;
  };

  Insert.prototype.statement = function() {
    var names = this._names,
        values = [];

    for (var i = 1, l = names.length; i <= l; i++)
      values.push('$' + i);

    return (
      'INSERT INTO ' + this._into
        + ' (' + names.join(', ') + ')'
        + ' VALUES (' + values.join(', ') + ')'
    );
  };

  Insert.prototype.eachValue = function(seq, fn) {
    if (!seq)
      throw new Error('Insert.eachValue: invalid sequence `' + seq + '`.');

    this._exec = function(client) {
      var values,
          self = this,
          stmt = this.statement();

      this.exec = function() {
        client.query(stmt, U.concat(self._values, arguments))
          .on('error', onError);
      };

      function onError(err) {
        client.emit('error', err);
      };

      U.each(seq, function(val, key, seq) {
        if ((values = fn.call(self, val, key, seq)) !== undefined)
          self.exec(values);
      });
    };
    return this;
  };

  Insert.prototype.end = function(next) {
    var self = this, error;

    Pg.connect(this.uri, function(err, client) {
      err ? next(err) : exec(client);
    });

    function exec(client) {
      self._exec(client.on('error', onError).on('drain', onDrain));
    }

    function onError(err) {
      if (!error)
        next(error = pgError(err));
    }

    function onDrain() {
      if (!error)
        next();
    }

    return this;
  };

  
  // ## Helpers ##

  function quoteIdent(name) {
    return "'" + name + "'";
  }

  function pgError(err) {
    if (err instanceof Error)
      return err;
    // TODO: make better error messages that take advantage of the
    // current statement and the `err.position` property.
    return new Error(err.severity + ': ' + err.message);
  }
});
