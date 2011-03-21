import socket
import json
import functools
import asyncore
from . import linestream

defaultConfig = {
    "host": "api.dev.relay.io",
    "port": 6790
    }

# Errors

class RelayError():

    @staticmethod
    def fromJson (theError):
        err = RelayError()
        err.code = theError.has_key("code") and theError["code"]
        err.message = theError.has_key("message") and theError["message"]
        return err

# Channels

class EventEmitter:
    def on(self, event, fn):
        if not hasattr(self, "events"):
            setattr(self, "events", {})
        if not self.events.has_key(event):
            self.events[event] = []
        self.events[event].append(fn)
        
    def emit(self, event, *args, **kwargs):
        if hasattr(self, "events") and self.events.has_key(event):
            for k in self.events[event]:
                k(*args, **kwargs)

class RelayChannel (EventEmitter):
    
    def __init__(self, address, stream):
        self.stream = stream
        self.address = address

    def _dispatch(self, mesg):
        if (mesg.has_key("type") and mesg["type"] == "Message"):
            self.emit("Message", mesg["body"], RelayChannel(mesg["from"], self.stream))

    def send(self, mesg):
        self.stream.send({
            "type": "Message",
            "to": self.address,
            "body": mesg
        })

class RelayUser (RelayChannel): pass

class RelayClient ():
    
    def __init__(self, config=defaultConfig):
        self.lineStream = linestream.LineStream(config["host"], config["port"])
        self.directMessageHandlers = {}
        self.channels = {}
        self.uid = 1

    def connectHandler(self, callback, mesg):
        self.channels[mesg["to"]] = RelayUser(mesg["to"], self)
        callback(self.channels[mesg["to"]])

    def joinHandler(self, channel, callback, mesg):
        if (mesg["type"] == "Error"):
            callback(RelayError.fromJson(mesg))
        else:
            chan = RelayChannel(channel, self)
            self.channels[channel] = chan
            callback(chan)
        
    def messageHandler(self, mesg):
        try:
            mesg = json.loads(mesg)
            if mesg.has_key("id") and self.directMessageHandlers.has_key(mesg["id"]):
                self.directMessageHandlers[mesg["id"]](mesg)
                del self.directMessageHandlers[mesg["id"]]
            else:
                if mesg.has_key("to") and self.channels.has_key(mesg["to"]):
                    self.channels[mesg["to"]]._dispatch(mesg)                               
        except ValueError:
            # TODO : throw an error or something
            print "Got Bad Json:"
            print mesg

    def getNewUid(self):
        self.uid += 1
        return self.uid

    def join (self, address, callback):
        k = functools.partial(functools.partial(self.joinHandler, address), callback)
        self.send({"type":"Join",
                   "to": address}, k)
        

    def connect(self, appName, key, onConnect):
        mesg = {"type":"Hello",
                "to": appName,
                "body": {"keys":[key]}
                }
        self._connect(mesg, onConnect)

    def connectAsUser(self, appName, key, user, password, onConnect):
        mesg = {"type":"Hello",
                "to": appName,
                "body": {
                    "key": [key],
                    "user": { "name": user,
                              "password": password
                              }
                    }
                }
        self._connect(mesg, onConnect)

    def _connect(self, mesg, onConnect):
        self.lineStream.onLine = self.messageHandler
        self.onConnect = onConnect
        self.send(mesg, functools.partial(self.connectHandler, onConnect))
        asyncore.loop()

    def send(self, mesgObject, callback=None):
        if (callback):
            uid = self.getNewUid()
            mesgObject["id"] = uid
            self.directMessageHandlers[uid] = callback
        theJson = json.dumps(mesgObject)
        self.lineStream.write(theJson.replace("\n","\\n") + "\n")
        
