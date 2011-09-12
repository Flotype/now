Getting Started with NowJS
==========================
Installation
------------
NowJS is a node.js module, which means you'll need node installed before proceeding. If you don't, see the [node.js website](http://nodejs.com/) for an introduction and instructions on how to get it.

After installing node, you'll need to grab [npm](http://npmjs.org/) (a node.js package manager). Once npm is installed, you can type "npm install now" at the command line and get access to NowJS.

Understanding How It Works
--------------------------
NowJS creates a dropbox object called `now` which is automatically synchronized between a client (typically a browser) and a server. Client and server both share a copy of the same `now`, updated live. The server also gets a special `everyone.now` object that provides a bird's eye view and provides access to all clients simultaneously. `now` and `everyone.now` are both regular JavaScript objects, so they can host any reasonable number of child objects, including functions.

NowJS is vital for simplifying communications that would otherwise require messy AJAX or socket requests. After connecting to a server, a client can access the `now` object at will and use it to store or retrieve data, or invoke server functions (and vice versa).

The simplicity and efficiency of NowJS makes it ideal for all types of web applications including social networking, games, news, search, and even banking.


A Simple Chat Client
--------------------
Let's demonstrate the 2-way nature of NowJS by running a simple chat server. To follow along, download the two source files [here](https://github.com/downloads/Flotype/now/chat-example.tgz).

### How It Works
The Hello World chat example uses NowJS to allow client and server to share information, and give each other the ability to invoke functions remotely. The client calls the server's `distributeMessage` function with the message it wants to send. `distributeMessage` in turn calls the `receiveMessage` function held by each client, and the chat message is printed on the screen of each participant.

### On The Server
For our chat program, the client should be able to tell the server to send a message to everyone else. We'll call this function `distributeMessage`. Since this function needs to run on the server, we'll put it in the server .js file.

    everyone.now.distributeMessage = function(message){
      everyone.now.receiveMessage(this.now.name, message);
    };
    
Don't worry about what's happening inside the function for the moment. What's important is that we put the function into the `everyone.now` object. This means that all currently connected clients and all future clients will get a function called `distributeMessage` added to their `now`.

With that done, the client code can call the `now.distributeMessage` locally and the server will execute the function.

### On The Client
Let's switch to the client-side code for a moment. We should allow users to set their name, so here's the bit of code that does that:

    now.name = prompt("What's your name?", "");

Notice how we stored it into a variable called `name` in the client's `now` object. This means when this client talks to the server, the server can access this client's name and use it.

That's cool, but how do we send messages?! Here is how:

    $("#send-button").click(function(){
      now.distributeMessage($("#text-input").val());
      $("#text-input").val("");
    });
    
Remember the `distributeMessage` function that the server put in every client's `now`? When the user clicks the send button, we call the `distributeMessage` function with the message passed in. The server receives the function call, runs the function, and everyone should receive the user's message. Let's see how it does that.

### Back To The Server
So let's say that a client just called `distributeMessage`. The server runs the function in the "context" of that particular client. This means that the function body has access to all the stuff in the calling client's `now`. We can access all that client's `now` by using `this.now` (i.e. this client's `now`).

In this case, we want to let all the other client's know the name of the user that sent the message. We can get the calling client's name by looking in `this.now.name`. Here's the code for the function in case you forgot it:

    everyone.now.distributeMessage = function(message){
      everyone.now.receiveMessage(this.now.name, message);
    };
    
We pass in that name as well as the user's message to the `receiveMessage` function in  `everyone.now`. HOLD UP! `receiveMessage`? Where did that come from? Come along, I'll show you.

### Back To The Client! (last time, I promise)
The `receiveMessage` function is found in the client code. Here it is for reference:

    now.receiveMessage = function(name, message){
      $("#messages").append("<br>" + name + ": " + message);
    }

The client puts its `receiveMessage` function in its `now` object so the server can call it when there are new messages. All it does is append the new chat message to the page.

Because the client defines the `receiveMessage` function in the `now` object, that function also gets added to the server's `everyone.now`. This way, the server can easily call every single client's `receiveMessage` function in one fell swoop. And that is exactly what the server does inside the `distributeMessage` function.

Fin
---
That's all there is to building things in NowJS. Armed with this knowledge, you can build all sorts of real-time applications easily and expressively. Happy coding!

Further Reading
----------------------
Now that you've read the Getting Started guide, try the NowJS [User Manual](http://nowjs.org/doc) and [Best Practices](http://nowjs.org/bestpractices)

Have more questions? You can reach us in #nowjs on freenode