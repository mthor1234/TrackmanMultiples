const SOCKET_IO_URL_KIOSK = "http://localhost:9999"


// SOCKET IO
var socket = io.connect(SOCKET_IO_URL_KIOSK);

// make connection with server from user side
socket.on('connect', function(){
    console.log('Connected to Server')
});

// when disconnected from server
socket.on('user_disconnected', function(){
    window.location.reload();
    console.log('Disconnect from server')
});

// Customer navigated to time-selection. 
// Generate a new QR
// Helps with handling state related to back navigation
socket.on('new_qr', function(){
    console.log('new_qr')
    window.location.reload();
});

// When the user's payment is accepted
socket.on('start_timer', function(){
    console.log('Start timer')

    // Show the user the timer!
    window.location.href='/timer';
});
