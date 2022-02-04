const QRCode = require('qrcode');

const generateQR = async text => {
    try {
        await QRCode.toFile('./qr_code.png', text);
    } catch (err) {
        console.log(err);
    }
}

generateQR("192.168.1.4:4242/time-selection");

