import socket
import sys
import asyncore
import json

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
            handler(mesg["body"], RelayChannel(mesg["from"], self.stream))

    def send(self, mesg):
        self.stream.send(mesg)

class RelayClient:
    
    def __init__(self):
        self.lineStream = LineStream("api.dev.relay.io", 6790)
        self.onConnect = None
        self.channels = {}

    def messageHandler(self, mesg):
        try:
            mesg = json.loads(mesg)
            if (mesg["type"] == "Welcome"):
                print "Got Welcome"
                self.channels["#global"] = RelayChannel("#global", self)
                self.channels[mesg["to"]] = RelayChannel(mesg["to"], self)
                self.onConnect(self.channels["#global"], self.channels[mesg["to"]])
            else:
                if (self.channels.has_key(mesg["to"])):
                    self.channels[mesg["to"]].dispatch(mesg)                               
        except ValueError:
            print "Got Bad Json:"
            print mesg

    def connect(self, onConnect):
        self.lineStream.onLine = self.messageHandler
        self.onConnect = onConnect
        self.send('{"type":"Hello","to":"test","body":{"keys":[]}}')
        asyncore.loop()

    def send(self, x):
        self.lineStream.write(x.replace("\n","\\n") + "\n")
        
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
        globalChan.onMessage(self.messageHandler)
        userChan.onMessage(self.messageHandler)

    def __init__(self):
        self.clientNames = {}
        client = RelayClient()
        client.connect(self.connectHandler)

def connectHandler(globalChan, userChan):
    print "We are connected"
    def messageHandler(message, sender):
        print "Got Message:"
        print message
        print "from: %s" % sender.address
    globalChan.onMessage(messageHandler)

ChatMaster()

