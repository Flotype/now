Get NowJS
=========
NowJS is a NodeJS module. The client javascript (now.js) is served by the NowJS server.


<a href="https://github.com/Flotype/now/">Go to Github</a> or 
<a href="https://github.com/Flotype/now/tarball/master">Download the tgz</a>


Install From npm
----------------

`npm install now`



NowJS uses the excellent <a href="https://github.com/LearnBoost/Socket.IO-node">socket.io</a> and <a href="https://github.com/isaacs/node-proxy">node-proxy</a> libraries and portions of <a href="https://github.com/substack/node-sesame">sesame</a>


2 Step Setup
==============

**1. On the server**

    
    var httpServer = require('http').createServer(function(req, response){ /* Serve your static files */ })
    httpServer.listen(8080);
    
    var everyone = require("now").initialize(httpServer);
    everyone.now.msg = "Hello World!";
    
**2. On the client**
<pre><code>
&lt;script type="text/javascript" src="http://localhost:8080/nowjs/now.js">&lt;/script>

&lt;script type="text/javascript"&gt;
  now.ready(function(){
    // alerts "Hello World!"
    alert(now.msg);
  });
&lt;/script>
</code></pre>

FAQ
-------

**Q: Can I pass in a callback or closure, for example, if the remote function is asynchronous??**

A: Yes. This is 100% supported


**Q: How do I use NowJS with [Express](https://github.com/visionmedia/express)?**

A: Very easily. 
    var app = express.createServer();
    app.listen(3000);
    var everyone = require("now").initialize(app);


Further Reading
---------------

Now that you have NowJS, try the NowJS [User Manual](http://nowjs.com/doc) and [Quick Chat Example](http://nowjs.com/guide) 

Have more questions? Please contact us:
Email: team@nowjs.com
IRC: #nowjs on freenode
Twitter: @NowJSTeam
