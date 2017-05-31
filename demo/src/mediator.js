const AWS = new require('aws-sdk');
const RedisDataFlow = new require('./db/RedisDataFlow')();

const db = new RedisDataFlow({
	host: process.env.REDIS_HOSTNAME,
	port: process.env.REDIS_PORT
});
const lambda = new AWS.Lambda();
const ses = new AWS.SES();

exports.handler = async (message, context, callback) => {
	try {
		context.callbackWaitsForEmptyEventLoop = false;
		console.log(`Received event: ${JSON.stringify(message, null, 2)}`);

		// Save the incoming message to the DB
		db.save(message);

		// The Controller will figure out what to do with the
		// incoming message, and return outgoing messages
		const outMessages = await Controller(message);

		// Save the outgoing messages to the DB
		await Promise.all(
			outMessages.map(
				msg => db.save(msg)
			)
		);

		// Send all outgoing messages to their
		// corresponding lambda functions
		await Promise.all(
			outMessages.map(
				msg => lambda.invoke({
					FunctionName: msg.target,
					InvocationType: 'Event',
					Payload: JSON.stringify(msg)
				}).promise()
			)
		);

		console.log(`Completed with: ${JSON.stringify(outMessages, null, 2)}`);
	}
	catch(err) {
		console.error(err);
		callback(err);
	}
};

// The mediator is a "smart" worker:
// 	all of our configuration lives here.
// This allows us to isolate the code complexity
// associated with config/workflow in one place
const config = {
	thumbnail: {
		width: 100,
		height: 100
	},
	gif: {
		frames: 5,
		delay: 200,
		loop: true
	},
	email: {
		bodyTemplate: (ctx) => ``,
		subjectTemplate: ctx => ``,
		to: ['eschwartz@aerisweather.com'],
		from: ['eschwartz@aerisweather.com']
	}
};

async function Controller(message) {
	const outMessages = [];

	// Based on the message type, decide what to do with it
	switch (message.type) {

		// When we fetch image from Aeris Maps
		// - create thumbnails for each image
		// - create a GIF for every 5 images we get
		case 'did-fetch-image':
			// Create thumbnail for the image
			outMessages.push({
				type: 'please-create-thumbnail',
				dateCreated: Date.now(),
				target: process.env.AMP_IMAGE_FETCHER_ARN,
				// Payload
				imageId: message.imageId,
				validTime: message.validTime,
				width: config.thumbnailWidth,
				height: config.thumbnailHeight,
			});

			// Create a GIF for every 5 valid times
			//
			// We can query the DB, to figure out
			// if we have 5 new valid times.

			// First, find the last GIF we created
			// for this imageId
			const lastCreatedGif = await db
				.findLatest({
					type: 'please-create-gif',
					imageId: message.imageId,
				});

			// Next, find all images since the GIF
			const imagesSinceLastGif = await db
				.findByValidTime({
					type: 'did-fetch-image',
					imageId: message.imageId,
					minValidTime: lastCreatedGif ? lastCreatedGif.validTime : null
				});

			// If we have 5 images since our last GIF,
			// then we're ready to create a new GIF
			if (imagesSinceLastGif.length >= config.gifFrames) {
				outMessages.push({
					type: 'please-create-gif',
					dateCreated: Date.now(),
					target: process.env.GIF_CREATOR_ARN,
					// Payload
					imageId: message.imageId,
					validTime: Math.max(...imagesSinceLastGif.map(msg => msg.validTime)),
					location: imagesSinceLastGif.map(msg => msg.location),
					gifDelay: config.gifDelay,
					gifLoop: config.gifLoop
				});
			}

			break;

		// When we create a GIF:
		// - Send an email out to SES
		case 'did-create-gif':
			// We're going to send an email with
			// all of the thumbnails, and the gif we created
			//
			// We'll need to find the thumbnail images in the DB.
			// Look for the 5 thumbnail images before our GIF's validTime
			const thumbImageMsgs = await db.findByValidTime({
				type: 'did-create-thumbnail',
				imageId: message.imageId,
				maxValidTime: message.validTime,
				limit: config.gif.frames
			});

			// Convert the message locations to http urls
			const thumbImageUrls = thumbImageMsgs.map(m =>
				`https://s3.amazonaws.com/${m.location.Bucket}/${m.location.Key}`
			);
			const gifImageUrl =
				`https://s3.amazonaws.com/${message.location.Bucket}/${message.location.Key}`;

			// Use our configured template to generate the email body/subjcet
			const templateContext = {
				imageId: message.imageId,
				validTime: message.validTime,
				gifUrl: gifImageUrl,
				thumbnailUrls: thumbImageUrls
			};
			const body = config.email.bodyTemplate(templateContext);
			const subject = config.email.subjectTemplate(templateContext);

			outMessages.push({
				type: 'please-send-email',
				dateCreated: Date.now(),
				target: process.env.EMAIL_SENDER,
				// Payload
				to: config.email.to,
				from: config.email.from,
				body: body,
				subject: subject
			});
			break;
	}

	return outMessages;
}

function locationToUrl({ Bucket, Key }) {
	return `https://s3.amazonaws.com/${Bucket}/${Key}`;
}