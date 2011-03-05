import socket
import sys
import asyncore
import json
import functools

class LineStream(asyncore.dispatcher):

    def __init__(self, host, port):
        asyncore.dispatcher.__init__(self)
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.create_socket(socket.AF_INET, socket.SOCK_STREAM)
        self.connect( (host, port) )
        self.inputBuffer  = ""
        self.outputBuffer = ""

    def write(self, x): self.outputBuffer += x

    def handle_close(self): pass

    def writing (self):
        return (len(self.outputBuffer) > 0)

    def readable(self): return True 

    def handle_read(self):
        incoming = self.recv(8192)
        if (incoming): print "Read: %s" % incoming
        for i in incoming:
            if (i == "\n"):
                self.onLine(self.inputBuffer)
                self.inputBuffer = ""
            else:
                self.inputBuffer += i

    def handle_write(self):
        if self.outputBuffer:
            wrote = self.send(self.outputBuffer)
            print wrote
            self.outputBuffer = self.outputBuffer[wrote:]

class RelayError():
    def fromJson (instigator, theError):
        err = RelayError()
        err.code = theError.code
        err.message = theError.message
        err.instigator = instigator
        return err

class RelayChannel:
    
    def __init__(self, address, stream):
        self.messageHandlers = []
        self.stream = stream
        self.address = address

    def onMessage(self, fn):
        self.messageHandlers.append(fn)
        return self

    def dispatch(self, mesg):
        for handler in self.messageHandlers:
            handler(mesg, RelayChannel(mesg["from"], self.stream))

    def send(self, mesg):
        self.stream.send(mesg)

class RelayClient:
    
    def __init__(self):
        self.lineStream = LineStream("api.dev.relay.io", 6790)
        self.directMessageHandlers = {}
        self.channels = {}
        self.uid = 1

    def connectHandler(self, callback, mesg):
        self.channels["#global"] = RelayChannel("#global", self)
        self.channels[mesg["to"]] = RelayChannel(mesg["to"], self)
        callback(self.channels["#global"], self.channels[mesg["to"]])

    def joinHandler(self, callback, mesg):
        callback(mesg)
        
    def messageHandler(self, mesg):
        try:
            mesg = json.loads(mesg)
            if mesg.has_key("id") and self.directMessageHandlers.has_key(mesg["id"]):
                print self.directMessageHandlers
                self.directMessageHandlers[mesg["id"]](mesg)
                del self.directMessageHandlers[mesg["id"]]
            else:
                if (self.channels.has_key(mesg["to"])):
                    self.channels[mesg["to"]].dispatch(mesg)                               
        except ValueError:
            print "Got Bad Json:"
            print mesg

    def getNewUid(self):
        self.uid += 1
        return self.uid

    def join (self, address, callback):
        k = functools.partial(self.joinHandler, callback)
        self.send({"type":"Join",
                   "to": "%s"}, k)
        

    def connect(self, onConnect):
        self.lineStream.onLine = self.messageHandler
        self.onConnect = onConnect
        self.send({"type":"Hello",
                   "to":"test",
                   "body": {"keys":[]}
                   }, functools.partial(self.connectHandler, onConnect))
        asyncore.loop()

    def send(self, mesgObject, callback=None):
        if (callback):
            uid = self.getNewUid()
            mesgObject["id"] = uid
            self.directMessageHandlers[uid] = callback
        theJson = json.dumps(mesgObject)
        self.lineStream.write(theJson.replace("\n","\\n") + "\n")
        
class ChatMaster:

    def messageHandler (self, mesg, sender):
        if mesg.has_key("type") and mesg["type"] == "Introduce":
            self.clientNames[sender.address] = sender.address
            sender.send(json.loads(self.clientNames))
            print self.clientNames
        else:
            print "GOT MESSAGE"
            print mesg

    def connectHandler (self, globalChan, userChan):
        print type(globalChan)
        globalChan.onMessage(self.messageHandler)
        userChan.onMessage(self.messageHandler)
        self.client.join("#medium", lambda x: x)

    def __init__(self):
        self.clientNames = {}
        self.client = RelayClient()
        self.client.connect(self.connectHandler)

ChatMaster()

