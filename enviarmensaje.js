const twilio = require('twilio');

/*Cuenta:  */


// Credenciales de Twilio
const accountSid = 'AC434a0dc49bbc76206f9e2bec9986047b';
const authToken = 'e43f7fc637cac834dc06e319799c5f39';
const client = twilio(accountSid, authToken);

// Obtener mensaje desde argumentos
const message = process.argv[2];

if (!message) {
  console.error('No se recibió ningún mensaje para enviar.');
  process.exit(1);
}

client.messages
  .create({
    body: message,
    from: 'whatsapp:+14155238886', // Sandbox de Twilio
    to: 'whatsapp:+5492615453364'  // Tu número real
  })
  .then(msg => console.log('Mensaje enviado con SID:', msg.sid))
  .catch(err => console.error('Error al enviar mensaje:', err));