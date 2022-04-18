// const QRCode = require('qrcode');

const generateQR = async text => {
    try {
        await QRCode.toFile('./qr_code.png', text);
    } catch (err) {
        console.log(err);
    }
}

generateQR(SOCKET_IO_URL + "/time-selection");

