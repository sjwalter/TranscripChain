var config = require('./config'),
    twilio = require('twilio'),
    express = require('express'),
    app = express.createServer(),
    io = require('socket.io').listen(app),
    redis = require('redis').createClient();

// Create a new instance of the client object.
var c = new twilio.Client(config.MY_ACCOUNT_SID, config.MY_AUTH_TOKEN, 'transcripchain.com');

// Set up our express app
app.use(express.static(__dirname + '/static'));

// Get a phone number object out of our new client
var p = c.getPhoneNumber(config.MY_PHONE_NUMBER);

// A list of transcriptions, including our starter Jurrassic Park quote
var johnHammond = 'We\'ve made living biological attractions so astounding that ' + 
    'they\'ll capture the imagination of the entire planet. ';

var transcriptions = [];

redis.lrange('transcripchain:transcriptions', 0, -1, function(err, res) {
    if (err) return;

    res.forEach(function(i) {
        var d = JSON.parse(i);
        transcriptions.push({url: d.recording.RecordingUrl, text: d.transcription.TranscriptionText});
    });
});

// Setup our phone object's statusURLs for incoming calls and sms
p.setup(function() {
    io.sockets.on('connection', function(s) {
        s.emit('allTranscriptions', transcriptions);
    });

    p.on('incomingCall', function(req, res) {
        // Greet the player
        res.append(new twilio.Twiml.Say('Welcome to Transcrip Chain! ' + 
            'The last transcription was. ' +
            ((transcriptions.length > 0) ?
                transcriptions[transcriptions.length - 1].text :
                johnHammond) +
            'After the tone, say what you just heard. ' +
            'Press any key when you are done.'));

        redis.rpush('transcripchain:calls', JSON.stringify(req));

        var recording = new twilio.Twiml.Record(
            {transcribe: true, maxLength: 15});
        var thisRec = null;

        recording.on('recorded', function(recReq, recRes) {
            recRes.append(new twilio.Twiml.Say('Thank you! Bye bye!'));
            recRes.append(new twilio.Twiml.Hangup());
            thisRec = recReq;
            recRes.send();
        });

        recording.on('transcribed', function(tranReq, tranRes) {
            var txt = tranReq.TranscriptionText;
            console.log('New transcription: ' + txt);
            transcriptions.push(txt);

            redis.rpush('transcripchain:transcriptions', JSON.stringify({
                recording: thisRec,
                transcription: tranReq
            }));

            io.sockets.emit('transcription', {
                url: thisRec.RecordingUrl, text: tranReq.TranscriptionText
            });
        });

        res.append(recording);
        res.send();
    });
});

app.listen(80);
console.log('Call ' + config.MY_PHONE_NUMBER);
