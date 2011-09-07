NowJS User Manual
==============

Installing NowJS is very easy. In order to get started, you'll first
need to have [node.js](http://nodejs.org) and
[npm](http://npmjs.org/).

Installing
-------------------
At your command line, simply enter `npm install now`.

Setup on the server
-------------------

NowJS needs an instance of a node.js http server in order to
communicate. If your application is already using an http server,
NowJS can use the existing instance. Otherwise, you will need to
create one. Here's an example server:

    var yourHttpServer = require('http').createServer(function(req, response){ /* Serve your static files */ });
    yourHttpServer.listen(8080);

Using this http server, get NowJS and use it to get a reference to the
`everyone` object, a group that contains every connected user.

    var nowjs = require('now');
    var everyone = nowjs.initialize(yourHttpServer);

Setup on the client
-------------------

On pages that you would like to use NowJS on, simply include this
script tag in your HTML head: `<script src="/nowjs/now.js"></script>`

Using NowJS
-------------------

The secret to NowJS lies in two magic objects called `now` and
`everyone.now`. In the **Setup on the server** section, we created the
`everyone` object. Including the script tag in **Setup on the client**
automatically added the `now` object to the browser document's global
namespace.

###The shared namespaces

Each client has a `now` object, which is a namespace that is shared
between the server and that particular client. Any variables or
functions that are changed/added in this shared namespace get synced
automatically to the server. Circular references are not supported.

The server has the `everyone.now` object, which is a namespace that is
shared between the server and all clients. When the server
adds/changes variables and functions in `everyone`, those changes are
reflected in each client's `now` namespace. Variables added or changed
in the `everyone` object will be reflected in all currently connected
clients as well as all future clients.

You can also create custom groups that behave just like everyone.now,
but only include a subset of connected users.

###Remote function calls

Syncing variables is useful but the true power of NowJS lies in remote
function calls. This means that the client can call functions that
execute on the server, or vice-versa.

Functions that are placed in a shared namespace can be called by
either the server or the client. Functions are executed on the machine
on which the function was created. When calling a remote function,
pass in the arguments as usual; closures and callbacks work fine.

Note that when making a remote function call, `return` values are
ignored. Any type of value you need to `return` should be in a
callback.

Quick example:

    now.sayHi = function() {
      return "hi"
    }
Should be changed to

    now.sayHi = function(callback) {
      callback("hi")
    }

This change is because `return` is a synchronous operation while
communication over the network with Node is asynchronous. Callbacks
allow greater flexibility without blocking the main thread.

When a remote machine invokes a function, the `now` namespace that is
shared between it and the remote machine is in scope. This namespace
can be accessed in the function body through the `this.now` object
(i.e. `this` client's `now`). If the function is being executed on the
server, the `everyone.now` namespace also remains available.

###Special behavior of everyone.now

When you call a function inside the `everyone.now` namespace, NowJS
will attempt to call the corresponding function in each connected
client's `now` namespace. If the corresponding function exists, a
remote function call will be made to that client. If not, a call will
not be made.

Setting variables inside the `everyone.now` namespace will set the
same value uniformly across all clients' `now` namespaces. It is
possible to also get/read values from `everyone.now`, but since
clients may change the value of the variable in their own `now`
namespace, the returned value is indeterminate/meaningless.


### The this.now and this.user object

Each connected user in NowJS has a scope it shares with the
server. The `everyone.now` object is used to control the now scopes
across all clients, but they can also be manipulated
individually. This is exposed via the `this.now` object.

For example:

     everyone.now.testFunc = function(){
         // this.now.doSomething();
         console.log(this.user.clientId);
     }

     everyone.now.testFunc();

would list the clientId of every user connected to the client. Note
that when you call `everyone.now.testFunc()`, `testFunc` is actually
called many times, once for each user, each time with that user's
specific this.now and this.user.

You can also add your own properties to `this.user` (for example,
`this.user.loggedIn = true;`). These are **not** shared with the
client, but they will be available wherever `this.user` is available.


###Client ready event on the client

NowJS allows you to specify a callback to be fired when the client has
successfully connected to the NowJS server. To set a listener for the
events, do the following:

    now.ready(function(){});
    

###Client disconnect event on the client

If the client loses communication with the server, a event is fired
     
    now.core.on('disconnect', function(){})

All remote functions are deleted at this time. The client will attempt
to reconnect to the server using Socket.IO's built-in capabilities,
which utilizes exponential backoff.

Other events that are fired:
* `rv`, indicating a variable replacement
* `rfc`, indicating a remote function call;
* `del`, indicating the syncing that a variable has been deleted;

* `reconnect`, indicating a successful reconnect;
* `reconnect_failed`, indicating that all reconnect attempts have been exhausted;
* `connect_failed`, indicating that the initial connection failed for some reason;
* `error`, indicating an error.

###Accessing clientId on the client

To access the clientId the server uses to identify client on the
client side, simply access
    
    now.core.clientId;

##The NowJS module object

Calling `require('now')` on the server returns a reference to the
NowJS module object. You should store this in a variable for easy
access like this:
    
    var nowjs = require('now');
    
In previous versions of NowJS, before 0.5.0, it was common practice to
immediately chain an `initialize` call after requiring the module,
rather than storing a reference to the module object. Such code would
look like this:

    var everyone = require('now').initialize(httpServer);    // pre 0.5.0

As of NowJS 0.5.0, it is strongly encouraged to break this up into two
different calls, so that a reference to the NowJS module object can be
stored, like this:

    var nowjs = require('now');
    var everyone = nowjs.initialize(httpServer);

The module object exposes several methods that can be used:

###.initialize(httpServer, [options])

The initialize function takes a Node.js http server such as the one
available in the `http` module or a module like Express.  Returns a
reference to the `everyone` object.

You can also pass in an options object. Here are the currently
available options and their defaults:

    {
      "clientWrite" : true,   // Enable syncing of changes to variables that originate from the client (browser)
      "autoHost" : true,      // This flag enables NowJS to serve the client-side libraries using the provided httpServer
      "host" : undefined,     // Overrides the autodetected host information when autoHost is enabled. You may need to set this if the server behind a reverse proxy or other complex network setup.
      "port" : undefined,     // Overrides the autodetected port information when autoHost is enabled

      "socketio" : {},        // This is the options object passed into io.listen(port, options)
      "closureTimeout : 30000 // This specifies how long before references to callbacks expire.
      "client : {},           // This specifies which options are available by default in the client-side library.
      "scope" : "window"      // A string representing the default scope in which the now namespace will be established.
                              // Do note that the object that this points to should already exist by the time now.js is loaded.
    }

If the options object is incomplete, the default values will be used
in place of any missing options.

###.getGroup(groupName)

This method takes an arbitrary string `groupName` and returns an
`ClientGroup` object whose name is `groupName`. If a group with that
name was already created by a previous call to `getGroup`, that group
will be returned. Otherwise, a new group will be created and returned.

###.getClient(clientId, function(){})

getClient allows you to address a single client by passing its
clientId as a parameter. The clientId is simply the
`this.user.clientId` of the client.  The second parameter is the
callback you wish to be called with the client scope.  Inside the
callback you can access `this.user` and `this.now` for the clientId
given.

If the clientId given does not exist, the callback is called with an
`err` parameter.

###.on('connect/disconnect', function(){})

NowJS allows you to specify a callback to be fired when a client
connects to or disconnects from the server. To set a listener for the
events, do the following:

    nowjs.on('connect', function(){});
    nowjs.on('disconnect', function(){});

The callbacks are run in the context `this.now` and `this.user`. This
makes it easy to access information about that client for setup or
setdown procedures.

<a name="groups"></a>
##Groups in NowJS

While the `everyone` object is used to perform actions on all
connected clients, it is sometimes useful to be able to address a
smaller subset of clients. For this reason, NowJS 0.5.0 and above
exposes the groups API.

A group is created or retrieved by passing a string to the `getGroup`
method of the NowJS module object. Calling this method returns a group
object. For example, to create a group called "foo," one would do
this:

    var fooGroup = nowjs.getGroup("foo");`

Users can be added to a group by passing their `this.user.clientId`
string to the `addUser` method of the group object. A similar call to
`removeUser` will remove the user from the group. Note that when a new
user with client ID `clientId` successfully connects to the NowJS
server, `everyone.addUser(clientId)` is called, and when that same
user disconnects from the NowJS server, `group.removeUser(clientId)`
is called for all groups that the user was in prior to
disconnecting.

Continuing the example above, one could do this:

    everyone.now.addToFooGroup = function(){
      var fooGroup = nowjs.getGroup("foo");
      fooGroup.addUser(this.user.clientId);
    }
    
    everyone.now.removeFromGroup = function(){
      var fooGroup = nowjs.getGroup("foo");
      fooGroup.removeUser(this.user.clientId);
    }

The groups behave similarly to the `everyone` object explained
earlier. Each group has a `now` namespace that can be used to perform
actions on all members of that group. For example,

    everyone.now.sendToFooGroup = function(){
      var fooGroup = nowjs.getGroup("foo");
      fooGroup.now.receiveMessage("Hello, members of foo group");
    }

In the above function, `receiveMessage` would be called on only users
who had previously added to the group named "foo."

While the `everyone` object and group objects expose similar
functionality, there are subtle yet crucial differences in how they
work. It is highly discouraged to use groups to set variables for only
a subset of users, like this: `fooGroup.now.x = 3`. A discussion of
this topic can be found in the Best Practices document.

###Group objects
###.addUser(clientId)

Takes a user's `this.user.clientId`, and adds that user to the
group. Does nothing if `clientId` is not a valid sessionId.

###.removeUser(clientId)

Takes a user's `this.user.clientId` and removes that user to the
group. Does nothing if `clientId` is not a valid sessionId or the
referenced user is not in the group in question.

###.now

A `now` namespace similar to `everyone.now`. Actions to this namespace
affect all users that are members of the group. For example, actions
on 'fooGroup.now' from the above example affect all users in the group
'foo'.

###.exclude([clientId1, clientId2, ... ])

Takes an array of users' `this.user.clientId`, and generates a new
group identical to the calling group, except with the specified
clients excluded. The returned group automatically updates to
accommodate any changes made to its parent group.

###.on('join/leave', function(){})

Every group receives two events `join` and `leave`. Join is
triggered when a user is added to the group. Leave is triggered
when a user is removed from the group or is disconnected from the
server. You can access that user's `this.now` and `this.user` objects
from the callback.

     everyone.on('connect', function(){
       //this.now.setup();
     });
    
     everyone.on('disconnect', function(){
       //this.now.destruct();
     });

###.hasClient(clientId, callback)

Takes a clientId and calls `callback` with a boolean `true` or `false`
indicating whether the clientId is a member of the group. Note that
this function is now asynchronous.

###.count(callback)

Calls `callback` with the total number of users in the given
group. Note that this is now a method, as opposed to a property.


Further Reading
----------------------

Now that you've read the User Manual guide, try the NowJS
[Quick Start](http://nowjs.org/guide) and
[Best Practices](http://nowjs.org/bestpractices)

Have more questions? You can reach us in #nowjs on freenode.
