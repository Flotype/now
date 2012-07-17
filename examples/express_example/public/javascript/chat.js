$(document).ready(function(){

  now.receiveMessage = function(name, message){
    $("#messages").append("<br>" + name + ": " + message);
  }

  $("#send-button").click(function(){
    now.distributeMessage($("#text-input").val());
    $("#text-input").val("");
    $("#text-input").focus();
  });

  now.name = prompt("What's your name?", "");

});