Getting Started with NowJS
==========================
Getting started with NowJS is really simple. Here we will make a simple chat server in just over a dozen lines of code. If you want to follow along on your own computer, download the two source files [here](https://github.com/downloads/Flotype/now/chat-example.tgz).

Magic Pockets
-------------
The secret to NowJS lies in two "magic pockets", `now` and `everyone.now`. 
The `now` object is a magic pocket that is shared between one particular client and the server. The client can put variables and functions in the `now` magic pocket and the server can freely access them. It works the other way around too!

The server can have lots of clients connected at once. That's a lot of magic pockets to keep track of. That's why the server has the `everyone.now` magic pocket. Any variables the server changes or adds to the `everyone.now` pocket gets passed along to every client's personal `now` pocket.

Building a chat server
----------------------
### TL;DR
This is a pretty long article but the process of building a chat server is simple: the client calls the server's `distributeMessage` function with the message it wants to send. The `distributeMessage` function in turn calls all the clients' `receiveMessage` function, which takes that message and prints it.

###On the server
For our chat program, the client should be able to tell the server to send a message to everyone else. We'll call this function `distributeMessage`. Since this function needs to run on the server, we'll put it in the server .js file.

    everyone.now.distributeMessage = function(message){
      everyone.now.receiveMessage(this.now.name, message);
    };
    
Don't worry about what's happening inside the function for the moment. What's important is that we put the function into the `everyone.now` pocket. This means that all currently connected clients and all future clients will get a function called `distributeMessage` added to their `now` magic pockets.

With that done, the client code can call the `now.distributeMessage` locally and the server will execute the function.

###On the client
Let's switch to the client-side code for a moment. We should allow users to set their name, so here's the bit of code that does that:

    now.name = prompt("What's your name?", "");

Notice how we stored it into a variable called `name` in the client's `now` magic pocket. This means when this client talks to the server, the server can access this client's name and use it.

That's cool, but how do we send messages?! Here is how:

    $("#send-button").click(function(){
      now.distributeMessage($("#text-input").val());
      $("#text-input").val("");
    });
    
Remember the `distributeMessage` function that the server put in every client's magic pocket? When the user clicks the send button, we call the `distributeMessage` function with the message passed in. The server receives the function call, runs the function, and everyone should receive the user's message. Let's see how it does that.

###Back to the server!
So let's say that a client just called `distributeMessage`. The server runs the function in the "context" of that particular client. This means that the function body has access to all the stuff in the calling client's `now` magic pocket. We can access all that client's `now` by using `this.now`. (i.e. `this` client's `now` pocket)

In this case, we want to let all the other client's know the name of the user that sent the message. We can get the calling client's name by looking in `this.now.name`. Here's the code for the function in case you forgot it:

    everyone.now.distributeMessage = function(message){
      everyone.now.receiveMessage(this.now.name, message);
    };
    
We pass in that name as well as the user's message to the `receiveMessage` function in the `everyone.now` magic pocket. HOLD UP! `receiveMessage`? Where did that come from? Come along, I'll show you.

###Back to the client! (last time, I promise)
The `receiveMessage` function is found in the client code. Here it is for reference:

    now.receiveMessage = function(name, message){
      $("#messages").append("<br>" + name + ": " + message);
    }

The client puts its `receiveMessage` function in its `now` pocket so the server can call it when there are new messages. All it does is append the new chat message to the page.

Because the client defines the `receiveMessage` function in the `now` pocket, that function also gets added to the server's `everyone.now` pocket. This way, the server can easily call every single client's `receiveMessage` function in one fell swoop. And that is exactly what the server does inside the `distributeMessage` function.

Fin
---
That's all there is to building things in NowJS. Armed with this knowledge, you can build all sorts of real-time applications easily and expressively. Happy coding!

Further Reading
----------------------
Now that you've read the Getting Started guide, try the NowJS [User Manual](http://nowjs.com/doc) and [Best Practices](http://nowjs.com/bestpractices)

Have more questions? You can reach us in #nowjs on freenode