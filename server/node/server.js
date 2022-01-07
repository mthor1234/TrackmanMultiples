var hasActiveSession = false;
var checkoutSessionID = null;
var token = null;

// // Trying my own token handling for handling the sessions
const express = require('express');
const session = require('express-session')
const jwt = require('jsonwebtoken')
const app = express();

var randomNumber = (Date.now() + Math.random()).toString(36);
console.log("Random: " + randomNumber);


const { resolve } = require('path');
const { stringify } = require('querystring');
// Copy the .env.example in the root into a .env file in this folder
require('dotenv').config({ path: './.env' });


// Ensure environment variables are set.
checkEnv();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2020-08-27',
  appInfo: { // For sample support and debugging, not required for production:
    name: "stripe-samples/checkout-one-time-payments",
    version: "0.0.1",
    url: "https://github.com/stripe-samples/checkout-one-time-payments"
  }
});


app.use(express.static(process.env.STATIC_DIR));
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

// Catches all routes to show the QR Code route
// app.get('/*', function(req, res) {
//   const path = resolve(process.env.STATIC_DIR + '/qr.html');
//   res.sendFile(path);
// });

app.get('/QR', (req, res) => {
  const path = resolve(process.env.STATIC_DIR + '/qr.html');
  res.sendFile(path);

  //   const QRCode = require('qrcode');

  // // QR Code is generated to the file below
  // const generateQR = async text => {
  //   try {
  //       await QRCode.toFile('./qr_code.png', text);

  //       // const path = resolve(process.env.STATIC_DIR + '/qr_code.png');
  //       const path = resolve('./qr_code.png');


  //       res.sendFile(path);

  //   } catch (err) {
  //       console.log(err);
  //       // TODO: Handle routing to an error page?
  //   }
  // }
  // generateQR("192.168.1.6:4242");

});

// TODO: This random number might work. Need to work on constant updating the random number to avoid user from unwanted access
  app.get('/' + randomNumber, (req, res) => {

    console.log("In the random number");

    // Creates the JWT so we can restrict access to the club selection page
    generateJWT();
  
    //session.id = randomNumber;
  
    // const path = resolve(process.env.STATIC_DIR + '/qr.html');
    //const path = resolve(process.env.STATIC_DIR + '/success.html');

    // TODO Probably use the JWT ID to hide this route 
    // const success_url = `http://localhost:4242/success.html?session_id=`+ req.session.id;
    const success_url = `http://localhost:4242/success.html?session_id=`+ token;

  
    //res.sendFile(path);
    res.redirect(success_url);
  
  });

app.get("/checksession", function (req, res) {
  var currentTime = new Date();
  console.log("Current Time: " + currentTime);

  // Check if the JWT has expired / is still valid
  jwt.verify(token, process.env.TOKEN_SECRET, function(err, decoded) {
    if (err) {

      console.log("Token is EXPIRED!");
      return res.send(401)

      /*
        err = {
          name: 'TokenExpiredError',
          message: 'jwt expired',
          expiredAt: 1408621000
        }
      */
    }else{
      console.log("Token is GOOD!");
      return res.send(200)
    }
  });
})

// TODO: Testing
app.get("/session", function (req, res) {

  // Generate the JWT
  generateJWT(1234);

  return res.send(200)
})


// Fetch the Checkout Session to display the JSON result on the success page
app.get('/check-session', async (req, res) => {

  if( isTokenValid() ){
    console.log("Token is fine")
    res.sendStatus(200)

  }else{

    console.log("Want to send them to the beginning or session expired")
    //res.send(403)

    //res.status(404).sendFile('/absolute/path/to/404.png')

    // TODO: Testing
    const path = resolve(process.env.STATIC_DIR + '/');

    //return res.redirect(303, path);

    //res.redirect(path)
    //res.sendFile(path);

    res.status(403);
    res.send('None shall pass');

    // Session has expired. Lower the flag
    //hasActiveSession = false;
  }

  // const { sessionId } = req.query;

  // if (sessionId === req.session.id) {
  //   console.log("SESSION ID MATCHES!");
  // } else {
  //   console.log("SESSION ID DOES NOT MATCH!");
  // }

  //res.send(session);
});


app.get('/config', async (req, res) => {
  const price = await stripe.prices.retrieve(process.env.PRICE);

  res.send({
    publicKey: process.env.STRIPE_PUBLISHABLE_KEY,
    unitAmount: price.unit_amount,
    currency: price.currency,
  });
});

// Fetch the Checkout Session to display the JSON result on the success page
app.get('/checkout-session', async (req, res) => {
  const { sessionId } = req.query;
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  hasActiveSession = true;

  // Timeout counter starts as soon as the checkout is successful...
  // TODO: Need to make sure this isn't called if there's a failed checkout
  setTimeout(sessionTimer, 60000, 'Thats TIME!');

  res.send(session);
});

app.post('/create-checkout-session', async (req, res) => {

  if (hasActiveSession) {
    const path = resolve(process.env.STATIC_DIR + '/already_in_use.html');
    res.sendFile(path);
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
      // ?session_id={CHECKOUT_SESSION_ID} means the redirect will have the session ID set as a query param
      //success_url: `${domainURL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      success_url: `${domainURL}/` + randomNumber,

      cancel_url: `${domainURL}/canceled.html`,
    });

    // Represents seconds before the payment intent is cancelled 
    const PAYMENT_INTENT_TIMEOUT = 20000;

    // This is how we can see the other sessions. Can check if there is an active session
    // Active Session -> We don't create the new request and we alert the user
    // !Active Session -> Create the session
    const sessions = await stripe.checkout.sessions.list({
      limit: 1,
    });

    console.log("Previous Session: ");
    console.log("id: " + sessions.data[0].id);
    console.log("Payment_Status: " + sessions.data[0].payment_status);
    console.log("status: " + sessions.data[0].status);
    console.log("expires_at: " + sessions.data[0].expires_at);

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

app.listen(4242, () => console.log(`Node server listening on port ${4242}!`));


// Sesion Expired Endpoint
app.get('/session-expired', (req, res) => {
  const path = resolve(process.env.STATIC_DIR + '/session_expired.html');
  res.sendFile(path);

  // Session has expired. Lower the flag
  hasActiveSession = false;
});


// Sesion Expired Endpoint
app.post('/send', (req, res) => {
  console.log(req.body.email_address)
  sendEmail(req.body.email_address, res)
});


// Sesion Expired Endpoint
app.get('/error', (req, res) => {
  const path = resolve(process.env.STATIC_DIR + '/error.html');
  res.sendFile(path);
});


function checkEnv() {
  const price = process.env.PRICE_ID;
  if (price === !price) {
    console.log("You must set a Price ID in the environment variables. Please see the README.");
    process.exit(0);
  }
}

async function sessionTimer(arg) {
  console.log(`TimedOut => ${arg}`);
}

// The server object listens on port 3000.
app.listen(3000, function () {
  console.log("Express Started on Port 3000");
});

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
  token = jwt.sign({username}, process.env.TOKEN_SECRET, { expiresIn: '10s', });
}

// Check if the JWT is still valid
function isTokenValid(){

    var isTokenValid = false;

    // Check if the JWT has expired / is still valid
    jwt.verify(token, process.env.TOKEN_SECRET, function(err, decoded) {
      if (err) {
  
        console.log("Token is EXPIRED!");  
        /*
          err = {
            name: 'TokenExpiredError',
            message: 'jwt expired',
            expiredAt: 1408621000
          }
        */
      }else{
        console.log("Token is GOOD!");
        isTokenValid = true;
      }
    });

    return isTokenValid;
}



