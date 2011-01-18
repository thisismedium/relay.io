define(['exports'], function() {

  exports.use = use;
  exports.Server = Server;

  exports.welcome = welcome;

  exports.parseMessage = parseMessage;
  exports.message = message;
  exports.Message = Message;

  function use(app, protocol) {
    for (var name in protocol)
      app.on(name, protocol[name]);
  }

  
  // ## Protocols ##

  var Server = {

    hello: function(msg, client) {
      var name = msg.data('name');
      if (!name)
        this.fail(msg, 'HELLO: missing required "name" attribute"');
      else if (client.hasSession())
        this.fail(msg, 'HELLO: session already started.');
      else
        welcome(this.startSession(client, name), msg);
    }

  };

  
  // ## Messages ##

  function welcome(sender, hello) {
    return message(sender, 'welcome')
      .data('sid', hello.client.sid())
      .send(hello.client);
  }

  
  // ## Message ##

  function parseMessage(sender, obj) {
    Assert.ok(obj.type,               'Missing required "type" attribute.');
    Assert.ok(obj.data !== undefined, 'Missing required "data" attribute.');
    return new Message(sender, obj.type, obj.data, obj);
  };

  function Message(sender, type, data, orig) {
    this.sender = sender;
    this.type = type;
    this._data = data;
    this.orig = orig;
  }

  Message.prototype.toString = function() {
    var id = this.sender.id,
        type = this.type;
    return '#<Message from: ' + id + ' type: ' + type + '>';
  };

  Message.prototype.data = function(name, value) {
    if (arguments.length == 0)
      return this._data;
    else if (typeof name == 'object')
      U.extend(this._data, obj);
    else if (arguments.length == 1)
      return this._data[name];
    else
      this._data[name] = value;
    return this;
  };

  Message.prototype.send = function(dest, status) {
    var obj = { type: this.type, when: Date.now(), data: this._data };

    if (status !== undefined)
      obj.status = status;

    dest.write(obj);

    return this;
  };

});