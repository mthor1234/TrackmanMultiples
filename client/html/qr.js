var socket = io.connect(SOCKET_IO_URL);

const generateQR = async text => {
    try {
        await QRCode.toFile('./qr_code.png', text, {
            color: {
                dark: '#FFF',  // White
                light: '#0000' // Transparent background
              },
        });
    } catch (err) {
        console.log(err);
    }
}

generateQR(SOCKET_IO_URL + "/time-selection");

// make connection with server from user side
socket.on('connect', function(){
    console.log('Connected to Server')
});
  
// when disconnected from server
socket.on('disconnect', function(){
    console.log('Disconnect from server')
});

// When the user's payment is accepted
socket.on('start', function(){
    console.log('Start Session')

    // Show the user the timer!
    window.location.href='/timer.html';
});

// When the user's payment is accepted
socket.on('start timer', function(){
    console.log('Start timer')

    // Show the user the timer!
    window.location.href='/timer.html';
});

// client-side
socket.on("hello", (arg) => {
    console.log(arg); // world
  });
