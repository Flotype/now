Get NowJS http://www.nowjs.com/
=========

###NowJS makes realtime web apps really easy.


<a href="https://github.com/Flotype/now/">Go to Github</a> or 
<a href="https://github.com/Flotype/now/tarball/master">Download the master tgz</a>


Install From npm
----------------

`npm install now` or `npm install now -g` to install globally



NowJS is a Node.js module. The client javascript (now.js) is served by the NowJS server.


NowJS uses the excellent <a href="https://github.com/LearnBoost/Socket.IO-node">socket.io</a> and <a href="https://github.com/isaacs/node-proxy">node-proxy</a> libraries.

2 Step Setup
==============

**1. On the server**

    
    var httpServer = require('http').createServer(function(req, response){ /* Serve your static files */ })
    httpServer.listen(8080);
    
    var nowjs = require("now");
    var everyone = nowjs.initialize(httpServer);
    
    everyone.now.logStuff = function(msg){
        console.log(msg);
    }
    
**2. On the client**
<pre><code>
&lt;script type="text/javascript" src="http://localhost:8080/nowjs/now.js">&lt;/script>

&lt;script type="text/javascript"&gt;
  now.ready(function(){
    // "Hello World!" will print on server
    now.logStuff("Hello World!");
  });
&lt;/script>
</code></pre>

FAQ
-------

**Q: Can I pass in a callback or closure, for example, if the remote function is asynchronous?**

A: Yes. This is 100% supported


**Q: How do I use NowJS with [Express](https://github.com/visionmedia/express)?**

A: Very easily. 
    var app = express.createServer();
    app.listen(3000);
    var everyone = require("now").initialize(app);

**Q: How do I disable WebSockets or only use xhr-polling?**

A: You can specifiy exactly which transports to use as an initialization options as follows:
    
    var nowjs = require("now");
    var everyone = nowjs.initialize(yourHttpServer, {socketio: {transports: ['xhr-polling', 'jsonp-polling']}});


**Q: Error: " SyntaxError: Unexpected token *" / Can I statically host the now.js file?**

A: On the client side, make sure you link to now.js like this

     <script src="http://myserver:myport/nowjs/now.js"></script>

You do not need to host the file /nowjs/now.js. It is automatically hosted by the NowJS using the http server you pass into the .initialize(...) in your server code. If you choose to host now.js yourself, you can, but **do not use the version in github repo** you MUST save the file at `http://myserver:myport/nowjs/now.js` and host that, because it is automatically configured for your server.

Further Reading
---------------

Now that you have NowJS, try the NowJS [User Manual](http://nowjs.com/doc) and [Quick Chat Example](http://nowjs.com/guide) 

Have more questions? Please contact us:
Email: team@nowjs.com

IRC: [#nowjs on freenode](http://webchat.freenode.net/?nick=nowjs.&channels=nowjs)

Twitter: [@NowJSTeam](http://twitter.com/nowjsteam)