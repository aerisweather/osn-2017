exports.main = async function(event, context, callback) {
	try {
		// Save the incoming message to the DB
		db.insert(event);

		// Figure out which outgoing messages to send
		const outMessages = Controller(event);

		// Save the outgoing messages to the DB
		await Promise.all(
			outMessages.map(
				msg => db.insert(msg)
			)
		);

		// Publish the messages to SNS
		await Promise.all(
			outMessages.map(
				msg => snsClient.publish({
					TopicArn: `arn:aws:sns:us-east-1:1234567:${msg.target}`,
					Message: JSON.stringify(msg)
				}).promise()
			)
		);

		// Tell Lambda we're all done
		callback();
	}
	catch (err) {
		callback(err);
	}
};

async function Controller(msg) {
	switch (event.type) {
		// When we fetch an image from AMP,
		// - create thumbnails for each image
		// - create a GIF for every 5 images we get
		case 'did-fetch-image':
			// Create a thumbnail for every image
			const thumbnailMsg = {
				type: 'please-create-thumbnail',
				dateCreated: new Date(),
				target: 'thumbnail-creator',
				payload: {
					imageId: msg.payload.imageId,
					validTime: msg.payload.validTime,
					width: 100,
					height: 100,
					location: msg.payload.location
				}
			};


			// Question: Is it time to make a GIF?

			// Find the last GIF we created
			const lastCreatedGif = await db
				.findOne({
					type: 'please-create-gif',
					'payload.imageId': msg.payload.imageId
				})
				.sort({ dateCreated: -1 });

			// Find all images since the last GIF we created,
			// (or since forever, if we've never created a GIF)
			const imagesSinceLastGif = await db
				.find({
					type: 'did-fetch-image',
					dateCreated: {
						$gt: lastCreatedGif ? lastCreatedGif.dateCreated : new Date(0)
					},
					'payload.imageId': msg.payload.imageId
				})
				.sort({ dateCreated: -1 });

			// If we have 5 images since our last GIF,
			// create a new GIF
			if (imagesSinceLastGif.length >= 5) {
				return [thumbnailMsg].concat({
					type: 'please-create-gif',
					dateCreated: new Date(),
					target: 'gif-creator',
					payload: {
						imageId: msg.payload.imageId,
						minValidTime: _.min(imagesSinceLastGif.map(img => img.payload.validTime)),
						maxValidTime: _.max(imagesSinceLastGif.map(img => img.payload.validTime)),
						locations: imagesSinceLastGif.map(img => img.payload.location)
					}
				});
			}
			// Otherwise, just create the thumbnail
			else {
				return [thumbnailMsg];
			}

		// Send a notification to SNS, whenever a GIF is created
		case 'did-create-gif':
			return [{
				type: 'please-look-at-this-gif',
				target: 'osn-demo-recipient',
				dateCreated: new Date(),
				payload: {
					imageId: msg.payload.imageId,
					location: msg.payload.location,
					minValidTime: msg.payload.minValidTime,
					maxValidTime: msg.payload.maxValidTime,
				}
			}];

		default:
			return [];
	}
}