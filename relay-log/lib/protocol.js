define(['exports', './util'], function(exports, U) {

  exports.message = message;
  exports.Message = Message;

  
  // ## Message ##

  function message(type, attr, body) {
    attr = attr || {};
    attr.type = type;
    return new Message(attr, body);
  }

  function Message(attr, body) {
    this._attr = attr || {};
    this._body = body || {};
  }

  U.proxyProps(Message, ['type', 'id', 'to', 'from'], function() {
    return this._attr;
  });

  Message.load = function(data) {
    return new Message(data, U.pop(data, 'body'));
  };

  Message.prototype.dump = function() {
    return U.extendDef({ type: this.type, body: this._body }, this._attr);
  };

  Message.prototype.toString = function() {
    return '#<' + this.type + '>';
  };

  Message.prototype.attr = function(key, val) {
    return U.access(this, this._attr, arguments);
  };

  Message.prototype.body = function(key, val) {
    return U.access(this, this._body, arguments);
  };

  Message.prototype.status = function(val) {
    return (arguments.length == 0) ? this.body('status') :
      this.body('status', val);
  };

});