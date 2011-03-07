import asyncore
import socket

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
        # if (incoming): print " < LineStream Read: %s" % incoming
        for i in incoming:
            if (i == "\n"):
                self.onLine(self.inputBuffer)
                self.inputBuffer = ""
            else:
                self.inputBuffer += i

    def handle_write(self):
        if self.outputBuffer:
            wrote = self.send(self.outputBuffer)
            # if (wrote): print " > LineStream Wrote: %s" % self.outputBuffer[:wrote]
            self.outputBuffer = self.outputBuffer[wrote:]
