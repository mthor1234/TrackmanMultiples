// const QRCode = require('qrcode');

const generateQR = async text => {
    try {
        await QRCode.toFile('./qr_code.png', text, {
            color: {
                dark: '#00F',  // Blue dots
                light: '#0000' // Transparent background
              }
        });
    } catch (err) {
        console.log(err);
    }
}

generateQR(SOCKET_IO_URL + "/time-selection");

