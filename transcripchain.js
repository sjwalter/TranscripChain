var config = require('./config'),
    twilio = require('twilio'),
    express = require('express'),
    app = express.createServer(),
    io = require('socket.io').listen(app);

// Create a new instance of the client object.
var c = new twilio.Client(config.MY_ACCOUNT_SID, config.MY_AUTH_TOKEN, 'transcripchain.com');

// Set up our express app
app.use(express.static(__dirname + '/static'));

// Emit all the transcription data

// Get a phone number object out of our new client
var p = c.getPhoneNumber(config.MY_PHONE_NUMBER);

// A list of transcriptions, including our starter Jurrassic Park quote
var transcriptions = ['We\'ve made living biological attractions so astounding that ' + 
    'they\'ll capture the imagination of the entire planet. '];

// Setup our phone object's statusURLs for incoming calls and sms
p.setup(function() {
    p.on('incomingCall', function(req, res) {
        // Greet the player
        res.append(new twilio.Twiml.Say('Welcome to Transcrip Chain!' + 
            'The last transcription was. ' +
            transcriptions[transcriptions.length -1 ] +
            'After the tone, say what you just heard. ' +
            'Press any key when you are done.'));

        var recording = new twilio.Twiml.Record(
            {transcribe: true, maxLength: 15});

        recording.on('recorded', function(recReq, recRes) {
            recRes.append(new twilio.Twiml.Say('Thank you! Bye bye!'));
            recRes.append(new twilio.Twiml.Hangup());
            recRes.send();
        });

        recording.on('transcribed', function(tranReq, tranRes) {
            var txt = tranReq.TranscriptionText;
            console.log('New transcription: ' + txt);
            transcriptions.push(txt);
        });

        res.append(recording);
        res.send();
    });
});

console.log('Call ' + config.MY_PHONE_NUMBER);
