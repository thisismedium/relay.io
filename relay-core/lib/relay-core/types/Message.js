function Message (type, to, from, body, id){
    this.message = this.build.apply(this, arguments);
  };

  Message.prototype.build = function (type, to, from, body, id) {
    return { 
      "type" : type,
      "to"   : to,
      "from" : from,
      "body" : body,
      "id"   : id
    }  
  }

  Message.prototype.dump = function () {
    for (var key in this.message) {
      if (this.message.hasOwnProperty(key)) {
        if(this.message[key] == null) delete this.message[key];
      }
    }
    return this.message;
  }

  Message.prototype.load = function (obj) {
    this.message = this.build(obj.type, obj.to, obj.from, obj.body, obj.id);
  };

Message.prototype.__defineGetter__("type", function () { return this.message.type });
Message.prototype.__defineGetter__("to", function () { return this.message.to });
Message.prototype.__defineSetter__("to", function (s) { return this.message.to = s });
Message.prototype.__defineGetter__("from", function () { return this.message.from });
Message.prototype.__defineSetter__("from", function (address) { this.message.from = address });
Message.prototype.__defineGetter__("body", function () { return this.message.body });

Message.prototype.__defineGetter__("id", function () { return this.message.id });
Message.prototype.__defineSetter__("id", function (i) { this.message.id = i; });

module.exports = Message;