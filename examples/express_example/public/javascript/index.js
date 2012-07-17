$(document).ready(function() {
$('#chat').click(function(e) {
    e.preventDefault();
    $('<iframe width="300px" height="100%" sandbox="allow-same-origin allow-forms allow-scripts" src="http://localhost:8080/chat"></iframe>').appendTo('#floater');
    });
});