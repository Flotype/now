NowJS User Manual
==============
Installing NowJS is very easy. In order to get started, you'll first need to have [node.js](http://nodejs.org) and [npm](http://npmjs.org/). 

Installing
-------------------
At your command line, simply enter `npm install nodejs`.

Setup on the server
-------------------
NowJS needs an instance of a node.js http server in order to communicate. If your application is already using an http server, NowJS can use the existing instance. Otherwise, you will need to create one. Here's an example server:

    var yourHttpServer = require('http').createServer(function(req, response){ /* Serve your static files */ });
    yourHttpServer.listen(8080);

At the top of your code, place the following: 
`var everyone = require("now").initialize(yourHttpServer);`

Setup on the client
-------------------
On pages that you would like to use NowJS on, simply include this script tag in your HTML head:
`<script src="/nowjs/now.js"></script>`

NowJS only works on pages that are served through the same http server instance that was passed into the `initialize` function above.

Using NowJS
-------------------
The secret to NowJS lies in two magic objects called `now` and `everyone.now`. In the **Setup on the server** section, we created the `everyone` object. Including the script tag in **Setup on the client** automatically added the `now` object to the document's global namespace.

###The shared namespaces
Each client has a `now` object, which is a namespace that is shared between the server and that particular client. Any variables or functions that are changed/added in this shared namespace get synced automatically to the server.

The server has the `everyone.now` object, which is a namespace that is shared between the server and all clients. When the server adds/changes variables and functions in `everyone`, those changes are reflected in each client's `now` namespace. Variables added or changed in the `everyone` object will be reflected in all currently connected clients as well as all future clients.

###Remote function calls
Syncing variables is useful but the true power of NowJS lies in remote function calls. This means that the client can call functions that execute on the server, or vice-versa.

Functions that are placed in a shared namespace can be called by either the server or the client. Functions are executed on the machine on which the function was created. When calling a remote function, pass in the arguments as usual. You may pass a callback function as an extra argument. When the remote function returns, the callback function is run with the return value as its first argument.

When a remote machine invokes a function, the `now` namespace that is shared between it and the remote machine is in scope. This namespace can be accessed in the function body through the `this.now` object (i.e. `this` client's `now`). If the function is being executed on the server, the `everyone.now` namespace also remains available.

###Special behavior of everyone.now
When you call a function inside the `everyone.now` namespace, NowJS will attempt to call the corresponding function in each connected client's `now` namespace. If the corresponding function exists, a remote function call will be made to that client. If not, a call will not be made.

Setting variables inside the `everyone.now` namespace will set the same value uniformly across all clients' `now` namespaces. It is possible to also get/read values from `everyone.now`, but since clients may change the value of the variable in their own `now` namespace, the returned value is indeterminate/meaningless.

###Client connected/disconnected events on the server
NowJS allows you to specify a callback to be fired when a client connects or disconnects on the server. To set a listener for the events, do the following:

    everyone.connected(function(){});
    everyone.disconnected(function(){});

The callbacks are run in the context of the connecting/disconnecting client's `now` namespace. This makes it easy to access information about that client for setup or setdown procedures.

###Client ready event on the client
NowJS allows you to specify a callback to be fired when the client has successfully connected to the NowJS server. To set a listener for the events, do the following:

    now.ready(function(){});

    
Further Reading
----------------------
Now that you've read the User Manual guide, try the NowJS [Quick Start](http://nowjs.com/guide) and [Best Practices](http://nowjs.com/bestpractices)

Have more questions? You can reach us in #nowjs on freenode