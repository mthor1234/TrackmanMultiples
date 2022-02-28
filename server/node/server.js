// FIXME: User is able to navigate back to the club selection page after pressing the back button
// FIXME: Follow up. When the above happens, the timer hits 0 but nothing happens. Need to make sure the timer is functioning properly

// LIBS //

// Copy the .env.example in the root into a .env file in this folder
require('dotenv').config({ path: './.env' });

const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
const http = require('http');
const port = process.env.PORT || 4242 // setting the port 
const server = http.createServer(app);
const socketIO = require('socket.io');
const QRCode = require('qrcode');
const io = socketIO(server)
const { resolve } = require('path');


// PATHS //
const PATH_BASE = process.env.STATIC_DIR;
const PATH_ALREADY_IN_USE = resolve(PATH_BASE + '/already_in_use.html');
const PATH_INDEX = resolve(PATH_BASE + '/index.html');
const TIME_SELECTION_INDEX = resolve(PATH_BASE + '/time_selection.html');
const PATH_QR = resolve(PATH_BASE + '/qr.html');
const PATH_SESSION_EXPIRED = resolve(PATH_BASE + '/session_expired.html');
const PATH_ERROR = (PATH_BASE + '/error.html');
const PATH_PLEASE_SCAN = resolve(PATH_BASE + '/scan_qr.html');
const PATH_SUCCESS = PATH_BASE + '/success.html';

// Append this on the end of success route to avoid users from 'hacking' into a free session
var randomNumber = generateRandomNumber();
console.log("Random: " + randomNumber);

//                //
// QR Generation  //
//                //

// TODO: Can I turn this into a lambda that just keep going instead of it being in just the setInterval function
// Generates the QR Code 
var randomNumberQR = generateRandomNumber();

// Generates the QR Code image and saves it to the /res directory
const generateQR = async text => {

  console.log("CREATING A NEW QR");

    try {
        await QRCode.toFile('../../client/html/res/qr_code.png', text);
    } catch (err) {
        console.log(err);
    }
}

// Call to create the QR code with the randomly generated number
generateQR("http://localhost:4242/time-selection/" + randomNumberQR);

console.log("Random Number QR: " + randomNumberQR);

var hasActiveSession = false;
var token = null;

// Ensure environment variables are set.
checkEnv();

// Sets up the Stripe constant used throughout
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2020-08-27',
  appInfo: { // For sample support and debugging, not required for production:
    name: "stripe-samples/checkout-one-time-payments",
    version: "0.0.1",
    url: "https://github.com/stripe-samples/checkout-one-time-payments"
  },
  maxNetworkRetries: 3
});

app.use(express.static(PATH_BASE));
app.use(express.urlencoded());
app.use(
  express.json({
    // We need the raw body to verify webhook signatures.
    // Let's compute it only when hitting the Stripe webhook endpoint.
    verify: function (req, res, buf) {
      if (req.originalUrl.startsWith('/webhook')) {
        req.rawBody = buf.toString();
      }
    },
  })
);

server.listen(port, () => console.log(`Node server listening on port ${port}!`));

// SOCKET IO //

// make a connection with the user from server side
io.on('connection', (socket) => {
  if (hasActiveSession) {
    console.log('Theres an active socket connection. Reject this connection');
  }
  else {
    console.log('New user connected... ID: ' + socket.id);
    hasActiveSession = true;

    // This is how to call the disconnect from SocketIO. 
    // When the user navigates away from the webpage, this is called
    socket.on('disconnect', function () {
      console.log('user disconnected');
      hasActiveSession = false;

      // Generate a new QR code everytime the customer moves away from the Time-Selection page
      // This helps prevent a random person from logging in remote and hogging the machine even
      generateRandomQR();
    });
  }
});

//        //
// ROUTES //
//        //

// Time-Selection must match the randomly generated number, otherwise, it will route the scan_qr.html page
app.get('/time-selection/:key', function (req, res) {
  console.log('Index hit!');

  if(req.params.key === randomNumberQR){
    console.log("Number matches QR!")
    var path = resolve(routeBasedOnMachineInUse(TIME_SELECTION_INDEX));
    res.sendFile(path);
  }else{
    console.log("Number does NOT match QR!")

    // Route the user to scan the QR Code
    res.sendFile(PATH_PLEASE_SCAN);
  }
});

// TODO: This will be running on the PC and shouldn't be hosted / accesible by the customer
app.get('/QR', (req, res) => {
  res.sendFile(PATH_QR);
});

app.get('/' + randomNumber, (req, res) => {
 
  console.log("In the random number");

  // Creates the JWT so we can restrict access to the club selection page
  generateJWT();

  const success_url = `http://localhost:4242/success.html?session_id=` + token;

  // TODO: Testing by not setting a cache on the Success page that way it'll load a fresh page when the user navigates back via back button
  // Seems to be working but I want to test it some more.
  // PROBLEM: It sends me back to the credit card processing page. Instead, I want it to send the user back to the scan QR page or something
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');

  res.redirect(success_url);
});

app.get('/expire-token', async (req, res) => {
  console.log("EXPIRE THE TOKEN!")
  token = null
  // isTokenValid()

  res.sendStatus(200)
});

// Fetch the Checkout Session to display the JSON result on the success page
app.get('/check-session', async (req, res) => {

  console.log("check-session");

  if (isTokenValid()) {
    console.log("Token is fine")

    res.sendStatus(200)

  } else {

    console.log("Want to send them to the beginning or session expired")
    res.status(403);
    res.send('None shall pass');
  }
  console.log("Outside");
});


// Fetch the Checkout Session to display the JSON result on the success page
app.get('/check-qr', async (req, res) => {
  console.log("randomNumberQR " + randomNumberQR)

  res.status(200)
  res.send({qr: randomNumberQR});
});

// Fetch the Checkout Session to display the JSON result on the success page
app.get('/checkout-session', async (req, res) => {
  hasActiveSession = true;
  res.send(hasActiveSession);
});

// Sesion Expired Endpoint
app.get('/session-expired', (req, res) => {
  res.sendFile(PATH_SESSION_EXPIRED);

  // Session has expired. Lower the flag
  hasActiveSession = false;
});

// Error sending an email
app.get('/error', (req, res) => {
  res.sendFile(PATH_ERROR);
});

// Catches all routes to show the QR Code route
app.get('/*', function(req, res) {
  res.sendFile(PATH_PLEASE_SCAN);
});

app.post('/create-checkout-session', async (req, res) => {

  if (hasActiveSession) {
    res.sendFile(PATH_ALREADY_IN_USE);
  } else {

    const domainURL = process.env.DOMAIN;

    const { quantity } = req.body;

    // The list of supported payment method types. We fetch this from the
    // environment variables in this sample. In practice, users often hard code a
    // list of strings for the payment method types they plan to support.
    const pmTypes = (process.env.PAYMENT_METHOD_TYPES || 'card').split(',').map((m) => m.trim());

    // Create new Checkout Session for the order
    // Other optional params include:
    // [billing_address_collection] - to display billing address details on the page
    // [customer] - if you have an existing Stripe Customer ID
    // [customer_email] - lets you prefill the email input in the Checkout page
    // TODO: NEED TO ADD THIS! 
    // [after_expiration] - Configure actions after a Checkout Session has expired.
    // [expires_at] - The Epoch time in seconds at which the Checkout Session will expire. It can be anywhere from 1 to 24 hours after Checkout Session creation. By default, this value is 24 hours from creation.
    // For full details see https://stripe.com/docs/api/checkout/sessions/create
    const session = await stripe.checkout.sessions.create({
      payment_method_types: pmTypes,
      mode: 'payment',
      expires_at: generateTimeStampCurrentPlusOneHour(),
      line_items: [
        {
          price: process.env.PRICE,
          quantity: quantity
        },
      ],
      success_url: `${domainURL}/` + randomNumber,
      cancel_url: `${domainURL}/canceled.html`,
    });
    return res.redirect(303, session.url);
  }
});

// Webhook handler for asynchronous events.
app.post('/webhook', async (req, res) => {
  let data;
  let eventType;
  // Check if webhook signing is configured.
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;
    let signature = req.headers['stripe-signature'];

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`);
      return res.sendStatus(400);
    }
    // Extract the object from the event.
    data = event.data;
    eventType = event.type;
  } else {
    // Webhook signing is recommended, but if the secret is not configured in `config.js`,
    // retrieve the event data directly from the request body.
    data = req.body.data;
    eventType = req.body.type;
  }

  if (eventType === 'checkout.session.completed') {
    console.log(`🔔  Payment received!`);
  }

  res.sendStatus(200);
});

// Sends the Trackman Session to the User's email
app.post('/send', (req, res) => {
  console.log(req.body.email_address)
  sendEmail(req.body.email_address, res)
});

function checkEnv() {
  const price = process.env.PRICE_ID;
  if (price === !price) {
    console.log("You must set a Price ID in the environment variables. Please see the README.");
    process.exit(0);
  }
}

// Checks if the machine has an active session. 
// If so, routes the user to the already in use page. Otherwise, continues onwards with the supplied path
function routeBasedOnMachineInUse(happyPath){

  if(hasActiveSession){
    console.log('Sending the user to already-in-use.html');
    return PATH_ALREADY_IN_USE
  }
  return happyPath
}

// Generates a random number based on the current timestamp
function generateRandomNumber(){
  console.log("generateRandomNumber()")
  return (Date.now() + Math.random()).toString(36);
}

// Generates a QR code based on the random number
function generateRandomQR(){
  randomNumberQR = generateRandomNumber();
  console.log("Random QR Number: " + randomNumberQR);

  // Creates a QR Code for the time-selection route with the randomly generated number appended
  generateQR("http://localhost:4242/time-selection/" + randomNumberQR);

  io.emit('qr', PATH_SESSION_EXPIRED)
}

/**
 * Generates the timestamp for Stripe to timeout the Checkout Session
 * @returns The Current Time In Seconds + One Hour (3600 Seconds)
 */
function generateTimeStampCurrentPlusOneHour() {
  const EPOCH_SECONDS_ONE_HOUR = 3600;

  var currentTime = new Date().getTime();
  var currentTimeSeconds = Math.floor(currentTime / 1000);
  var currentTimeSecondsPlusOneHour = currentTimeSeconds + EPOCH_SECONDS_ONE_HOUR;

  console.log("Seconds: " + currentTimeSecondsPlusOneHour);

  return currentTimeSecondsPlusOneHour;
}

// Send the user an email
function sendEmail(customersEmail, res) {
  console.log(`sendEmail()`);
  var nodemailer = require('nodemailer');
  var email = process.env.EMAIL;
  var password = process.env.EMAIL_PASSWORD;

  var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: email,
      pass: password
    }
  });

  var mailOptions = {
    from: email,
    to: customersEmail,
    subject: 'Trackman Session',
    text: 'That was easy!'
  };

  transporter.sendMail(mailOptions, function (error, info) {

    // Machine is no longer in use. Lower the flag
    hasActiveSession = false;

    if (error) {

      console.log(error);

      //redirect to error screen
      res.statusCode = 302;
      res.setHeader('Location', '/error');

    } else {
      console.log('Email sent: ' + info.response);
      //Email sent, send the user back to the home screen
      res.statusCode = 302;
      res.setHeader('Location', '/');
      return res.end();
    }
  });
}

// Signs the JWT with an expiration time
function generateJWT(username) {
  // token = jwt.sign({ username }, process.env.TOKEN_SECRET, { expiresIn: '10s'});
  token = jwt.sign({ username,
    exp: Math.floor(Date.now() / 1000) + (10),
    iat: Math.floor(Date.now())
  }, process.env.TOKEN_SECRET);
  console.log("Generated a JWT")
}

// Check if the JWT is still valid
function isTokenValid() {

  var isTokenValid = false;

  // Check if the JWT has expired / is still valid
  jwt.verify(token, process.env.TOKEN_SECRET, function (err, decoded) {
    console.log("Verify Token")
    if (err) {
      console.log("Token is EXPIRED!");
    } else {
      console.log("Token is GOOD!");
      isTokenValid = true;
    }
  });

  return isTokenValid;
}

