// JWT can have expirations built in
// Use SessionID to only have one session?
// Session” is the term used to refer to a visitor’s time browsing a web site. It’s meant to represent the time between a visitor’s first arrival at a page on the site and the time they stop using the site.

// Use Cookie for user identification that we can save in their browser. I think this is probably the way we can know if it's on one device
//  cookie identifies, often anonymously, a specific visitor or a specific computer. Cookies can be used for authentication, storing site preferences, saving shopping carts, and server session identification

const express = require('express');
const app = express();
const { resolve } = require('path');
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

app.get('/', (req, res) => {
  const path = resolve(process.env.STATIC_DIR + '/index.html');
  res.sendFile(path);
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

  // Timeout counter starts as soon as the checkout is successful...
  // TODO: Need to make sure this isn't called if there's a failed checkout
  setTimeout(sessionTimer, 3000, 'Thats TIME!');

  res.send(session);
});

app.post('/create-checkout-session', async (req, res) => {
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
  // For full details see https://stripe.com/docs/api/checkout/sessions/create
  const session = await stripe.checkout.sessions.create({
    payment_method_types: pmTypes,
    mode: 'payment',
    line_items: [
      {
        price: process.env.PRICE,
        quantity: quantity
      },
    ],
    // TODO: Can I make this no longer valid after 30 mins? Create a QR code so the user can access easily?
    // ?session_id={CHECKOUT_SESSION_ID} means the redirect will have the session ID set as a query param
    success_url: `${domainURL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${domainURL}/canceled.html`,

  });

  return res.redirect(303, session.url);
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


function checkEnv() {
  const price = process.env.PRICE_ID;
  if (price === !price) {
    console.log("You must set a Price ID in the environment variables. Please see the README.");
    process.exit(0);
  }
}

function sessionTimer(arg) {
  console.log(`TimedOut => ${arg}`);
}


// Sesion Expired Endpoint
app.get('/session-expired', (req, res) => {
  const path = resolve(process.env.STATIC_DIR + '/session_expired.html');
  res.sendFile(path);
});


// Sesion Expired Endpoint
app.post('/send', (req, res) => {
  console.log(req.body.email_address)
  sendEmail(req.body.email_address)
});


function sendEmail(customersEmail){
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

transporter.sendMail(mailOptions, function(error, info){
  if (error) {
    console.log(error);
  } else {
    console.log('Email sent: ' + info.response);
  }
});
}


