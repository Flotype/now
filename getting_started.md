Now.js User Manual
===========================
Installing now.js is very easy. In order to get started, you'll first need to have [node.js](http://nodejs.org) and [npm](http://npmjs.org/). 

Installing
----------
At your command line, simply enter `npm install nodejs`.

Setup on the server
-------------------
Now.js needs an instance of a node.js `httpServer` in order to communicate. If your application is already using an `httpServer`, now.js can use the existing instance. Otherwise, you will need to create one.

At the top of your code, place the following: 
`var everyone = require("nowjs").initialize(yourHttpServer);`

Setup on the client
-------------------
On pages that you would like to use now.js on, simply include this script tag in your HTML head:
`<script src="/nowjs/nowClient.js"></script>`

Now.js only works on pages that are served through the same `httpServer` instance that was passed into the `initialize` function above.

Using now.js
------------
The secret to now.js lies in two magic objects called `now` and `everyone.now`. In the **Setup on the server** section, we created the `everyone` object. Including the script tag in **Setup on the client** automatically added the `now` object to the document's global namespace.

###The shared namespaces
Each client has a `now` object, which is a namespace that is shared between the server and that particular client. Any variables or functions that are changed/added in this shared namespace get synced automatically to the server.

The server has the `everyone.now` object, which is a namespace that is shared between the server and all clients. When the server adds/changes variables and functions in `everyone`, those changes are reflected in each client's `now` namespace. Variables added or changed in the `everyone` object will be reflected in all currently connected clients as well as all future clients.

###Remote function calls
Syncing variables is useful but the true power of now.js lies in remote function calls. This means that the client can call functions that execute on the server, or vice-versa.

Functions that are placed in a shared namespace can be called by either the server or the client. Functions are executed on the machine on which the function was created. When calling a remote function, pass in the arguments as usual. You may pass a callback function as an extra argument. When the remote function returns, the callback function is run with the return value as its first argument.

When a remote machine invokes a function, the `now` namespace that is shared between it and the remote machine is in scope. This namespace can be accessed in the function body through the `this.now` object (i.e. `this` client's `now`). If the function is being executed on the server, the `everyone.now` namespace also remains available.

###Special behavior of `everyone.now`
When you call a function inside the `everyone.now` namespace, now.js will attempt to call the corresponding function in each connected client's `now` namespace. If the corresponding function exists, a remote function call will be made to that client. If not, a call will not be made.

Setting variables inside the `everyone.now` namespace will set the same value uniformly across all clients' `now` namespaces. However, it is not possible to read values out of `everyone.now`, even immediately after setting a variable. This is because each client *may* change this value upon receipt, so there is no single value that could be returned.

