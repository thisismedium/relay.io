
var events = require("events");
var sys    = require("sys");
var crypto = require('crypto');

sys.inherits(WebSocketConnection, events.EventEmitter);
function WebSocketConnection (socket) {
    
    this.data = "";
    var self = this;

    socket.addListener('data', function (data) {
        handleData(data);
    });

    socket.addListener('end', function () {
        self.emit('close');
    });

    this.send = function (str) { 
	try {
            socket.write('\u0000', 'binary');
            socket.write(str, 'utf8');
            socket.write('\uffff', 'binary');
	} catch(e){
            self.close();
	}
    };

    this.close = function () {
        socket.close();
    };

    function handleData (data) {
        var chunk, chunks, chunk_count;
        self.data += data;
        chunks = self.data.split('\ufffd');
        chunk_count = chunks.length - 1;
        for (var i = 0; i < chunk_count; i++){
            chunk = chunks[i];
            if (chunk[0] !== '\u0000'){
                socket.end();
                return false;
            }
            self.emit("message", chunk.slice(1));
        }
        self.data = chunks[chunks.length - 1];    
    };
};


sys.inherits(WebSocketWrapper, events.EventEmitter);
function WebSocketWrapper(httpServer) {

    var self = this;

    httpServer.addListener("upgrade", function(req, socket, head) {

        socket.setTimeout(0);
        socket.setEncoding('utf8');
        socket.setNoDelay(true);


        var draft76 = 'sec-websocket-key1' in req.headers;
        var origin = req.headers.origin;

        if (draft76) {
            headers = [
                'HTTP/1.1 101 WebSocket Protocol Handshake',
                'Upgrade: WebSocket',
                'Connection: Upgrade',
                'Sec-WebSocket-Origin: ' + (origin || 'null')
            ];

            if (origin == null) {
                headers.push('Sec-WebSocket-Location: ' + req.url);
            } else {
                headers.push('Sec-WebSocket-Location: ws://' + req.headers.host + req.url);
            }
            
            if ('sec-websocket-protocol' in req.headers){
                headers.push('Sec-WebSocket-Protocol: ' + req.headers['sec-websocket-protocol']);
            }

         } else {
             headers = [
                 'HTTP/1.1 101 Web Socket Protocol Handshake',
                 'Upgrade: WebSocket',
                 'Connection: Upgrade',
                 'WebSocket-Origin: ' + origin,
             ];


             if (origin == null) {
                 headers.push('WebSocket-Location: ' + req.url);
             } else {
                 headers.push('WebSocket-Location: ws://' + req.headers.host + req.url);
             }

             try {
                 socket.write(headers.concat('', '').join('\r\n'));
             } catch(e){
                 // closed
             }
         }
         var wsc = new WebSocketConnection(socket);
         self.proveReception(req, socket, wsc, head, headers);
         self.emit("connection", wsc);
     });

     this.proveReception = function(request, connection, wsc, upgradeHead, headers){
         var k1 = request.headers['sec-websocket-key1'];
         var k2 = request.headers['sec-websocket-key2'];

         if (k1 && k2){
             var md5 = crypto.createHash('md5');

             [k1, k2].forEach(function(k){
                 var n = parseInt(k.replace(/[^\d]/g, '')),
                 spaces = k.replace(/[^ ]/g, '').length;

                 if (spaces === 0 || n % spaces !== 0){
                     console.log('Invalid WebSocket key: "' + k + '". Dropping connection');
                     connection.destroy();
                     return false;
                 }

                 n /= spaces;

                 md5.update(String.fromCharCode(
                     n >> 24 & 0xFF,
                     n >> 16 & 0xFF,
                     n >> 8  & 0xFF,
                     n       & 0xFF));
             });

	    md5.update(upgradeHead.toString('binary'));
	    
	    try {
                var toSend = headers.concat('', '').join('\r\n') + md5.digest('binary');
		connection.write(toSend, 'binary');
	    } catch(e){
                console.log(e);
		wsc.close();
	    }
	}
	
	return true;
    };


};

exports.WebSocketWrapper = WebSocketWrapper;
